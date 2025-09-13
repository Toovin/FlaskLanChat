from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from lc_socket_handlers import validate_media_response
from lc_config import UPLOAD_DIR, THUMBNAILS_DIR, AVATAR_DIR, DEFAULT_AVATAR_DIR, MEDIA_DOWNLOAD_DIR, THUMBNAILS_MEDIA_DOWNLOADED_DIR
from lc_database import create_folder, get_folder_structure, get_folder_by_id, get_files_in_folder, add_file_to_folder, delete_folder, rename_folder, delete_file_from_folder
import os
from datetime import datetime
import sqlite3
import uuid
import yt_dlp
from PIL import Image
import cv2
import numpy as np
import re
import time

routes = Blueprint('routes', __name__)

def generate_thumbnail(image_path, thumbnail_path, size=(200, 200)):
    """Generate a thumbnail for an image using OpenCV or PIL as fallback"""
    try:
        os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)
        print(f"Attempting to generate thumbnail for {image_path} at {thumbnail_path}")

        if not os.path.exists(image_path):
            print(f"Error: Source image {image_path} does not exist")
            return False

        img = cv2.imread(image_path)
        if img is None:
            print(f"OpenCV failed to load image: {image_path}, trying PIL")
            try:
                with Image.open(image_path) as pil_img:
                    if pil_img.mode in ('RGBA', 'LA'):
                        pil_img = pil_img.convert('RGB')
                    pil_img.thumbnail(size, Image.Resampling.LANCZOS)
                    pil_img.save(thumbnail_path, 'JPEG', quality=85)
                print(f"Thumbnail generated (PIL): {thumbnail_path}")
                return True
            except Exception as pil_error:
                print(f"PIL failed to process image {image_path}: {str(pil_error)}")
                return False

        height, width = img.shape[:2]
        if height == 0 or width == 0:
            print(f"Error: Invalid image dimensions for {image_path}")
            return False

        aspect_ratio = width / height
        if width > height:
            new_width = size[0]
            new_height = int(size[0] / aspect_ratio)
        else:
            new_height = size[1]
            new_width = int(size[1] * aspect_ratio)

        resized = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
        canvas = np.full((size[1], size[0], 3), 255, dtype=np.uint8)
        x_offset = (size[0] - new_width) // 2
        y_offset = (size[1] - new_height) // 2
        canvas[y_offset:y_offset+new_height, x_offset:x_offset+new_width] = resized

        success = cv2.imwrite(thumbnail_path, canvas, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if success:
            print(f"Thumbnail generated (OpenCV): {thumbnail_path}")
            return True
        else:
            print(f"Error: Failed to save thumbnail at {thumbnail_path}")
            return False

    except Exception as e:
        print(f"Error generating thumbnail for {image_path}: {str(e)}")
        return False

def register_routes(app, socketio):
    @app.route('/download-media', methods=['POST'])
    def download_media():
        print(f"Media download request received from {request.remote_addr} at {datetime.now()}")
        data = request.get_json()
        url = data.get('url')
        channel = data.get('channel', 'general')
        sender = data.get('sender', 'Anonymous')
        if not url:
            print("Media download failed: No URL provided")
            return jsonify({'error': 'No URL provided'}), 400

        output_name = data.get('output_name', '')
        storage_dir = 'media_downloaded'
        upload_path = MEDIA_DOWNLOAD_DIR
        os.makedirs(upload_path, exist_ok=True)
        download_id = str(uuid.uuid4())

        def progress_hook(d):
            if d['status'] == 'downloading':
                total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                downloaded_bytes = d.get('downloaded_bytes', 0)
                if total_bytes > 0:
                    progress = (downloaded_bytes / total_bytes) * 100
                    socketio.emit('download_progress', {
                        'download_id': download_id,
                        'progress': progress,
                        'speed': d.get('speed', 0),
                        'eta': d.get('eta', 0)
                    }, room=channel)
            elif d['status'] == 'finished':
                socketio.emit('download_progress', {
                    'download_id': download_id,
                    'progress': 100,
                    'status': 'finished'
                }, room=channel)

        # Sanitize output name if provided
        if output_name:
            output_name = re.sub(r'[^\w\s\-_]', '', str(output_name)).replace(' ', '_').strip('_')
            if not output_name:
                output_name = f"download_{int(time.time())}"

        ydl_opts = {
            'outtmpl': os.path.join(upload_path, '%(title)s.%(ext)s') if not output_name else os.path.join(upload_path, f'{output_name}.%(ext)s'),
            'format': 'best',
            'noplaylist': True,
            'quiet': True,
            'progress_hooks': [progress_hook],
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                filename = ydl.prepare_filename(info)
                socketio.emit('download_progress', {
                    'download_id': download_id,
                    'progress': 0,
                    'status': 'started',
                    'filename': os.path.basename(filename)
                }, room=channel)
                ydl.download([url])

            downloaded_url = f'/static/{storage_dir}/{os.path.basename(filename)}'.replace('\\', '/')
            thumbnail_url = None
            file_ext = os.path.splitext(filename)[1].lower()
            is_media = file_ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.avi', '.mov']
            if is_media and file_ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
                thumbnails_path = THUMBNAILS_MEDIA_DOWNLOADED_DIR
                os.makedirs(thumbnails_path, exist_ok=True)
                base_name = os.path.splitext(os.path.basename(filename))[0]
                thumbnail_filename = f"{base_name}_thumb.jpg"
                thumbnail_filepath = os.path.join(thumbnails_path, thumbnail_filename)
                if generate_thumbnail(filename, thumbnail_filepath):
                    thumbnail_url = f'/static/thumbnails/{storage_dir}/{thumbnail_filename}'.replace('\\', '/')
                else:
                    print(f"Thumbnail generation failed for {filename}")
                    thumbnail_url = downloaded_url  # Fallback to full image

            response = {
                'message': f"Media downloaded: {os.path.basename(filename)}",
                'is_media': is_media,
                'image_url': downloaded_url if is_media else None,
                'thumbnail_url': thumbnail_url if is_media and thumbnail_url else downloaded_url if is_media else None,
                'sender': sender
            }

            if not validate_media_response(response):
                print(f"Invalid media response for download: {response}")
                # Disabled channel toasting for media downloads - keep download functional but silent
                # socketio.emit('receive_message', {
                #     'id': None,
                #     'channel': channel,
                #     'sender': 'System',
                #     'message': f"Error: Invalid media data from download",
                #     'is_media': False,
                #     'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                #     'replied_to': None,
                #     'replies_count': 0,
                #     'reactions': []
                # }, room=channel)
                return jsonify({'error': 'Invalid media data'}), 400

            try:
                # Still save to database for file management, but don't send to chat
                conn = sqlite3.connect('devchat.db')
                c = conn.cursor()
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                c.execute(
                    "INSERT INTO messages (channel, sender, message, is_media, timestamp, replied_to) VALUES (?, ?, ?, ?, ?, ?)",
                    (channel, response['sender'], response['message'], response['is_media'], timestamp, None)
                )
                message_id = c.lastrowid
                conn.commit()
                conn.close()

                # Disabled channel toasting for media downloads - keep download functional but silent
                # socketio.emit('receive_message', {
                #     'id': message_id,
                #     'channel': channel,
                #     'sender': response['sender'],
                #     'message': response['message'],
                #     'is_media': response['is_media'],
                #     'image_url': response['image_url'],
                #     'thumbnail_url': response['thumbnail_url'],
                #     'timestamp': timestamp,
                #     'replied_to': None,
                #     'replies_count': 0,
                #     'reactions': []
                # }, room=channel)

                print(f"Media downloaded: {filename}, URL: {downloaded_url}, Thumbnail: {thumbnail_url}")
                return jsonify({'url': downloaded_url, 'thumbnail_url': thumbnail_url, 'download_id': download_id}), 200
            except Exception as e:
                print(f"Error saving downloaded media to database: {e}")
                return jsonify({'error': f"Error saving media: {str(e)}"}), 500

        except Exception as e:
            print(f"Media download failed: {str(e)}")
            socketio.emit('download_progress', {
                'download_id': download_id,
                'status': 'error',
                'error': str(e)
            }, room=channel)
            return jsonify({'error': f'Download failed: {str(e)}'}), 400

    @app.route('/upload-avatar', methods=['POST'])
    def upload_avatar():
        print(f"Avatar upload request from {request.remote_addr}")
        if 'avatar' not in request.files:
            print("Avatar upload failed: No avatar file provided")
            return jsonify({'error': 'No avatar file provided'}), 400
        file = request.files['avatar']
        if file.filename == '':
            print("Avatar upload failed: No selected file")
            return jsonify({'error': 'No selected file'}), 400
        if file:
            filename = str(uuid.uuid4()) + os.path.splitext(file.filename)[1]
            filepath = os.path.join(AVATAR_DIR, filename)
            try:
                os.makedirs(AVATAR_DIR, exist_ok=True)  # Ensure directory exists
                file.save(filepath)
                print(f"Avatar saved: {filepath}")
                return jsonify({'url': f'/static/user_avatars/{filename}'}), 200
            except Exception as e:
                print(f"Avatar upload failed: {str(e)}")
                return jsonify({'error': f'File upload failed: {str(e)}'}), 400
        print("Avatar upload failed: File save error")
        return jsonify({'error': 'File upload failed'}), 400

    @app.route('/upload-media', methods=['POST'])
    def upload_media():
        print(f"Media upload request from {request.remote_addr}")
        if 'file' not in request.files:
            print("Media upload failed: No file provided")
            return jsonify({'error': 'No file provided'}), 400
        file = request.files['file']
        if file.filename == '':
            print("Media upload failed: No selected file")
            return jsonify({'error': 'No selected file'}), 400
        if file:
            # Validate file type
            allowed_extensions = {'mp4', 'webm', 'avi', 'mov', 'mp3', 'wav', 'ogg'}
            if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
                return jsonify({'error': 'Invalid file type. Only video and audio files are allowed.'}), 400

            filename = secure_filename(file.filename)
            filepath = os.path.join(MEDIA_DOWNLOAD_DIR, filename)
            try:
                os.makedirs(MEDIA_DOWNLOAD_DIR, exist_ok=True)
                file.save(filepath)
                print(f"Media file saved: {filepath}")
                return jsonify({'filename': filename}), 200
            except Exception as e:
                print(f"Media upload failed: {str(e)}")
                return jsonify({'error': f'File upload failed: {str(e)}'}), 400
        print("Media upload failed: File save error")
        return jsonify({'error': 'File upload failed'}), 400

    @app.route('/upload-file', methods=['POST'])
    def upload_file():
        print(f"DEBUG: upload_file route called from {request.remote_addr} at {datetime.now()}")
        if 'file' not in request.files:
            print("File upload failed: No file provided")
            return jsonify({'error': 'No file provided'}), 400
        files = request.files.getlist('file')
        if not files or all(f.filename == '' for f in files):
            print("File upload failed: No selected files")
            return jsonify({'error': 'No selected files'}), 400

        # Get folder information
        folder_id = request.form.get('folder_id')
        folder_path = None
        if folder_id:
            try:
                folder_info = get_folder_by_id(int(folder_id))
                if folder_info:
                    folder_path = folder_info['path']
                else:
                    return jsonify({'error': 'Invalid folder selected'}), 400
            except ValueError:
                return jsonify({'error': 'Invalid folder ID'}), 400

        storage_dir = request.form.get('storage_dir', 'uploads')
        if storage_dir == 'uploads':
            upload_path = UPLOAD_DIR
            thumbnails_path = THUMBNAILS_DIR
        elif storage_dir == 'media_downloaded':
            upload_path = MEDIA_DOWNLOAD_DIR
            thumbnails_path = THUMBNAILS_MEDIA_DOWNLOADED_DIR
        elif storage_dir == 'file_share_uploads':
            # Handle folder-based uploads for file sharing
            if folder_path:
                upload_path = os.path.join('static', folder_path)
                thumbnails_path = os.path.join('static', 'thumbnails', folder_path)
            else:
                upload_path = os.path.join('static', 'file_share_uploads')
                thumbnails_path = os.path.join('static', 'thumbnails', 'file_share_uploads')
        else:
            upload_path = os.path.join('static', storage_dir)
            thumbnails_path = os.path.join('static', 'thumbnails', storage_dir)

        os.makedirs(upload_path, exist_ok=True)
        os.makedirs(thumbnails_path, exist_ok=True)

        responses = []
        for file in files:
            original_name = secure_filename(file.filename)
            base, ext = os.path.splitext(original_name)

            # Check for existing files with same base name and append (1), (2), etc. for duplicates
            filename = original_name
            filepath = os.path.join(upload_path, filename)
            counter = 1
            while os.path.exists(filepath):
                filename = f"{base} ({counter}){ext}"
                filepath = os.path.join(upload_path, filename)
                counter += 1

            try:
                file.save(filepath)
                url = f'/static/{folder_path or "file_share_uploads"}/{filename}'.replace('\\', '/')
                thumbnail_url = None
                is_media = ext.lower() in ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.jfif', '.mp4', '.webm', '.avi', '.mov']
                should_generate_thumb = is_media and ext.lower() in ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.jfif']
                print(f"DEBUG: File {filename}, ext='{ext}', is_media={is_media}, should_generate_thumb={should_generate_thumb}")
                if should_generate_thumb:
                    # Generate thumbnails for images
                    thumbnail_filename = f"{os.path.splitext(filename)[0]}_thumb.jpg"
                    thumbnail_filepath = os.path.join(thumbnails_path, thumbnail_filename)
                    print(f"DEBUG: Attempting thumbnail generation: {filepath} -> {thumbnail_filepath}")
                    try:
                        thumb_result = generate_thumbnail(filepath, thumbnail_filepath)
                        print(f"DEBUG: generate_thumbnail returned: {thumb_result}")
                        if thumb_result:
                            if os.path.exists(thumbnail_filepath) and os.path.getsize(thumbnail_filepath) > 0:
                                thumbnail_url = f'/static/thumbnails/{folder_path or "file_share_uploads"}/{thumbnail_filename}'.replace('\\', '/')
                                print(f"Thumbnail generated successfully: {thumbnail_url}")
                                # Validate the thumbnail URL by checking if file exists at expected path
                                full_thumbnail_path = os.path.join('static', 'thumbnails', folder_path or 'file_share_uploads', thumbnail_filename)
                                if not os.path.exists(full_thumbnail_path):
                                    print(f"WARNING: Thumbnail URL constructed but file not found at: {full_thumbnail_path}")
                                    thumbnail_url = url
                            else:
                                print(f"Thumbnail file missing or empty after generation: {thumbnail_filepath}")
                                thumbnail_url = url
                        else:
                            print(f"Thumbnail generation failed for {filename}")
                            thumbnail_url = url
                    except Exception as e:
                        print(f"DEBUG: Exception during thumbnail generation: {e}")
                        import traceback
                        traceback.print_exc()
                        thumbnail_url = url
                elif is_media and ext.lower() in ['.mp4', '.webm', '.avi', '.mov']:
                    # For videos, don't set thumbnail_url - let client show video icon
                    thumbnail_url = None

                # Get file size
                file_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0

                  # No database save for files - filesystem only

                responses.append({'url': url, 'thumbnail_url': thumbnail_url, 'size': file_size})
                print(f"File saved: {filepath}, URL: {url}, Thumbnail: {thumbnail_url}")
            except Exception as e:
                print(f"File upload failed for {original_name}: {str(e)}")
                responses.append({'error': f"File upload failed for {original_name}: {str(e)}"})

        if all('error' in r for r in responses):
            return jsonify({'error': 'All file uploads failed', 'details': responses}), 400
        return jsonify({'urls': responses}), 200

    @app.route('/files', methods=['GET'])
    def list_files():
        storage_dir = request.args.get('storage_dir', 'uploads')
        if storage_dir == 'uploads':
            upload_path = UPLOAD_DIR
        elif storage_dir == 'media_downloaded':
            upload_path = MEDIA_DOWNLOAD_DIR
        else:
            upload_path = os.path.join('static', storage_dir)
        try:
            files = []
            for filename in os.listdir(upload_path):
                filepath = os.path.join(upload_path, filename)
                if os.path.isfile(filepath):
                    stat = os.stat(filepath)
                    lazy_url = f'/lazy-file/{storage_dir}/{filename}'
                    file_info = {
                        'name': filename,
                        'size': stat.st_size,
                        'lazy_url': lazy_url,
                        'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                    }
                    files.append(file_info)
            print(f"Listed {len(files)} files from {upload_path} with lazy URLs")
            return jsonify({'files': files}), 200
        except FileNotFoundError:
            print(f"Directory {upload_path} not found, returning empty list")
            return jsonify({'files': []}), 200
        except Exception as e:
            print(f"File list failed: {str(e)}")
            return jsonify({'error': f'Failed to list files: {str(e)}'}), 500

    @app.route('/lazy-file/<path:filepath>')
    def serve_lazy_file(filepath):
        print(f"Lazy loading file: {filepath}")
        return send_from_directory('static', filepath)

    @app.route('/rename-media', methods=['POST'])
    def rename_media():
        print(f"Media rename request received from {request.remote_addr}")
        data = request.get_json()
        old_name = data.get('old_name')
        new_name = data.get('new_name')
        storage_dir = data.get('storage_dir', 'media_downloaded')
        if not old_name or not new_name:
            print("Media rename failed: Missing old_name or new_name")
            return jsonify({'error': 'Missing old_name or new_name'}), 400
        upload_path = os.path.join('static', storage_dir)
        old_path = os.path.join(upload_path, old_name)
        new_path = os.path.join(upload_path, new_name)
        if not os.path.exists(old_path):
            print(f"Media rename failed: File {old_name} not found")
            return jsonify({'error': f'File {old_name} not found'}), 404
        if os.path.exists(new_path):
            print(f"Media rename failed: File {new_name} already exists")
            return jsonify({'error': f'File {new_name} already exists'}), 400
        try:
            os.rename(old_path, new_path)
            new_url = f'/static/{storage_dir}/{new_name}'.replace('\\', '/')
            print(f"File renamed: {old_name} -> {new_name}, URL: {new_url}")
            return jsonify({'success': True, 'new_url': new_url}), 200
        except Exception as e:
            print(f"Media rename failed: {str(e)}")
            return jsonify({'error': f'Rename failed: {str(e)}'}), 500

    @app.route('/delete-media', methods=['POST'])
    def delete_media():
        print(f"Media delete request received from {request.remote_addr}")
        data = request.get_json()
        filename = data.get('filename')
        storage_dir = data.get('storage_dir', 'media_downloaded')
        if not filename:
            print("Media delete failed: Missing filename")
            return jsonify({'error': 'Missing filename'}), 400
        upload_path = os.path.join('static', storage_dir)
        file_path = os.path.join(upload_path, filename)
        if not os.path.exists(file_path):
            print(f"Media delete failed: File {filename} not found")
            return jsonify({'error': f'File {filename} not found'}), 404
        try:
            os.remove(file_path)
            print(f"File deleted: {filename}")
            return jsonify({'success': True}), 200
        except Exception as e:
            print(f"Media delete failed: {str(e)}")
            return jsonify({'error': f'Delete failed: {str(e)}'}), 500

    @app.route('/static/<path:path>')
    def serve_static(path):
        print(f"Serving static file: {path}")
        try:
            full_path = os.path.join('static', path)
            if not os.path.exists(full_path):
                print(f"File not found: {full_path}")
                return jsonify({'error': 'File not found'}), 404
            return send_from_directory('static', path)
        except Exception as e:
            print(f"Error serving static file {path}: {str(e)}")
            return jsonify({'error': f'File not found: {str(e)}'}), 404

    @app.route('/')
    def index():
        return send_from_directory('static', 'index.html')

    @app.route('/check-thumbnail/<path:filename>')
    def check_thumbnail(filename):
        thumbnail_path = os.path.join('static', 'thumbnails', filename)
        if os.path.exists(thumbnail_path):
            return jsonify({'exists': True, 'url': f'/static/thumbnails/{filename}'}), 200
        return jsonify({'exists': False}), 404

    @app.route('/list-default-avatars')
    def list_default_avatars():
        try:
            avatars = []
            for filename in os.listdir(DEFAULT_AVATAR_DIR):
                filepath = os.path.join(DEFAULT_AVATAR_DIR, filename)
                if os.path.isfile(filepath):
                    url = f'/static/default_avatars/{filename}'.replace('\\', '/')
                    avatars.append({'name': filename, 'url': url})
            return jsonify({'avatars': avatars}), 200
        except FileNotFoundError:
            return jsonify({'avatars': []}), 200
        except Exception as e:
            return jsonify({'error': f'Failed to list default avatars: {str(e)}'}), 500

    # Folder management routes
    @app.route('/create-folder', methods=['POST'])
    def create_folder_route():
        print(f"Create folder request from {request.remote_addr}")
        data = request.get_json()
        name = data.get('name')
        parent_id = data.get('parent_id')
        created_by = data.get('created_by', 'system')

        if not name:
            print("Create folder failed: Missing folder name")
            return jsonify({'error': 'Missing folder name'}), 400

        # Validate folder name (no special characters that could cause issues)
        if any(char in name for char in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']):
            return jsonify({'error': 'Folder name contains invalid characters'}), 400

        try:
            # Create folder in database
            folder_id = create_folder(name, parent_id, created_by)

            # Create actual directory
            folder_info = get_folder_by_id(folder_id)
            if folder_info:
                os.makedirs(os.path.join('static', folder_info['path']), exist_ok=True)
                print(f"Created folder directory: {folder_info['path']}")

            return jsonify({'success': True, 'folder_id': folder_id, 'folder': folder_info}), 200
        except Exception as e:
            print(f"Create folder failed: {str(e)}")
            return jsonify({'error': f'Failed to create folder: {str(e)}'}), 500

    @app.route('/folders', methods=['GET'])
    def get_folders():
        print(f"Get folders request from {request.remote_addr}")
        try:
            folders = get_folder_structure()
            return jsonify({'folders': folders}), 200
        except Exception as e:
            print(f"Get folders failed: {str(e)}")
            return jsonify({'error': f'Failed to get folders: {str(e)}'}), 500

    @app.route('/folder-files/<int:folder_id>', methods=['GET'])
    def get_folder_files(folder_id):
        print(f"Get folder files request from {request.remote_addr} for folder {folder_id}")
        try:
            if folder_id == 0:
                # Root folder
                folder_path = 'file_share_uploads'
            else:
                # Get folder path from database
                folder_info = get_folder_by_id(folder_id)
                if not folder_info:
                    return jsonify({'files': []}), 200
                folder_path = folder_info['path']
            
            # List files from directory
            import os
            full_path = os.path.join('static', folder_path)
            files = []
            if os.path.exists(full_path):
                for filename in os.listdir(full_path):
                    filepath = os.path.join(full_path, filename)
                    if os.path.isfile(filepath):
                        stat = os.stat(filepath)
                        # Check for thumbnail
                        thumbnail_filename = f"{os.path.splitext(filename)[0]}_thumb.jpg"
                        thumbnail_path = os.path.join('static', 'thumbnails', folder_path, thumbnail_filename)
                        thumbnail_url = f'/static/thumbnails/{folder_path}/{thumbnail_filename}' if os.path.exists(thumbnail_path) else None
                        file_info = {
                            'filename': filename,
                            'filepath': filepath,
                            'size': stat.st_size,
                            'created_at': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                            'thumbnail_url': thumbnail_url,
                            'folder_id': folder_id
                        }
                        files.append(file_info)
            return jsonify({'files': files}), 200
        except Exception as e:
            print(f"Get folder files failed: {str(e)}")
            return jsonify({'error': f'Failed to get folder files: {str(e)}'}), 500

    @app.route('/delete-folder/<int:folder_id>', methods=['DELETE'])
    def delete_folder_route(folder_id):
        print(f"Delete folder request from {request.remote_addr} for folder {folder_id}")
        try:
            # Get folder info before deletion
            folder_info = get_folder_by_id(folder_id)
            if not folder_info:
                return jsonify({'error': 'Folder not found'}), 404

            # Delete folder and all contents
            delete_folder(folder_id)

            # Try to remove directory (will fail if not empty, but that's ok)
            try:
                folder_path = os.path.join('static', folder_info['path'])
                if os.path.exists(folder_path):
                    os.rmdir(folder_path)
                    print(f"Removed folder directory: {folder_info['path']}")
            except OSError:
                print(f"Could not remove folder directory (may not be empty): {folder_info['path']}")

            return jsonify({'success': True}), 200
        except Exception as e:
            print(f"Delete folder failed: {str(e)}")
            return jsonify({'error': f'Failed to delete folder: {str(e)}'}), 500

    @app.route('/rename-folder/<int:folder_id>', methods=['PUT'])
    def rename_folder_route(folder_id):
        print(f"Rename folder request from {request.remote_addr} for folder {folder_id}")
        data = request.get_json()
        new_name = data.get('name')

        if not new_name:
            return jsonify({'error': 'Missing new folder name'}), 400

        # Validate folder name
        if any(char in new_name for char in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']):
            return jsonify({'error': 'Folder name contains invalid characters'}), 400

        try:
            rename_folder(folder_id, new_name)
            return jsonify({'success': True}), 200
        except Exception as e:
            print(f"Rename folder failed: {str(e)}")
            return jsonify({'error': f'Failed to rename folder: {str(e)}'}), 500

    @app.route('/delete-file', methods=['DELETE'])
    def delete_file_route():
        print(f"Delete file request from {request.remote_addr}")
        data = request.get_json()
        filename = data.get('filename')
        folder_id = data.get('folder_id')
        if not filename or folder_id is None:
            return jsonify({'error': 'Missing filename or folder_id'}), 400
        try:
            if folder_id == 0:
                folder_path = 'file_share_uploads'
            else:
                folder_info = get_folder_by_id(folder_id)
                if not folder_info:
                    return jsonify({'error': 'Folder not found'}), 404
                folder_path = folder_info['path']
            
            import os
            file_path = os.path.join('static', folder_path, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                # Also remove thumbnail if exists
                thumbnail_filename = f"{os.path.splitext(filename)[0]}_thumb.jpg"
                thumbnail_path = os.path.join('static', 'thumbnails', folder_path, thumbnail_filename)
                if os.path.exists(thumbnail_path):
                    os.remove(thumbnail_path)
                print(f"Deleted file: {file_path}")
                return jsonify({'success': True}), 200
            else:
                return jsonify({'error': 'File not found'}), 404
        except Exception as e:
            print(f"Delete file failed: {str(e)}")
            return jsonify({'error': f'Failed to delete file: {str(e)}'}), 500