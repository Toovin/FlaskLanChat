from flask import request, jsonify, send_from_directory
import os
from datetime import datetime
from lc_config import UPLOAD_DIR, AVATAR_DIR
import uuid
def register_routes(app):
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
                file.save(filepath)
                print(f"Avatar saved: {filepath}")
                return jsonify({'url': f'/static/avatars/{filename}'}), 200
            except Exception as e:
                print(f"Avatar upload failed: {str(e)}")
                return jsonify({'error': f'File upload failed: {str(e)}'}), 400
        print("Avatar upload failed: File save error")
        return jsonify({'error': 'File upload failed'}), 400

    @app.route('/upload-file', methods=['POST'])
    def upload_file():
        print(f"File upload request received from {request.remote_addr} at {datetime.now()}")
        if 'file' not in request.files:
            print("File upload failed: No file provided")
            return jsonify({'error': 'No file provided'}), 400
        files = request.files.getlist('file')
        if not files or all(f.filename == '' for f in files):
            print("File upload failed: No selected files")
            return jsonify({'error': 'No selected files'}), 400
        storage_dir = request.form.get('storage_dir', 'uploads')  # Default to 'uploads'
        upload_path = os.path.join('static', storage_dir)
        os.makedirs(upload_path, exist_ok=True)
        urls = []
        for file in files:
            original_name = file.filename
            base, ext = os.path.splitext(original_name)
            filename = original_name
            filepath = os.path.join(upload_path, filename)
            counter = 1
            while os.path.exists(filepath):
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"{base}_{timestamp}_{counter}{ext}"
                filepath = os.path.join(upload_path, filename)
                counter += 1
            try:
                file.save(filepath)
                url = f'/{upload_path}/{filename}'.replace('\\', '/')  # Normalize to forward slashes
                print(f"File saved: {filepath}, URL: {url}")
                urls.append(url)
            except Exception as e:
                print(f"File upload failed for {original_name}: {str(e)}")
                return jsonify({'error': f'File upload failed: {str(e)}'}), 400
        return jsonify({'urls': urls}), 200

    @app.route('/files', methods=['GET'])
    def list_files():
        storage_dir = request.args.get('storage_dir', 'uploads')
        upload_path = os.path.join('static', storage_dir)
        try:
            files = []
            for filename in os.listdir(upload_path):
                filepath = os.path.join(upload_path, filename)
                if os.path.isfile(filepath):
                    stat = os.stat(filepath)
                    file_info = {
                        'name': filename,
                        'size': stat.st_size,
                        'url': f'/{upload_path}/{filename}'.replace('\\', '/'),
                        'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                    }
                    files.append(file_info)
            print(f"Listed {len(files)} files from {upload_path}: {files}")
            return jsonify({'files': files}), 200
        except FileNotFoundError:
            print(f"Directory {upload_path} not found, returning empty list")
            return jsonify({'files': []}), 200
        except Exception as e:
            print(f"File list failed: {str(e)}")
            return jsonify({'error': f'Failed to list files: {str(e)}'}), 500

    @app.route('/static/<path:path>')
    def serve_static(path):
        return send_from_directory('static', path)

    @app.route('/')
    def index():
        return send_from_directory('static', 'index.html')