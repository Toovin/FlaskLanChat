from flask_socketio import emit, join_room, leave_room
from werkzeug.security import check_password_hash
from flask import request, session
from lc_database import save_user, get_user_by_username, update_user_avatar, load_messages, add_reaction, remove_reaction, get_reactions, get_standard_timestamp, update_user_settings, get_user_settings, create_channel, delete_channel, load_channels
import sqlite3
import uuid
import threading


typing_users = {}  # Added for handling multiple typing people! 9-6-2025 1947PM
processed_requests = set()  # Track processed request IDs


def validate_media_response(response):
    """
    Validate a media response to ensure it contains valid image_url and thumbnail_url or attachments.
    Returns True if valid, False otherwise.
    """
    if not response.get('is_media', False):
        return True
    valid_extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'avi', 'mov']
    if 'image_url' in response and 'thumbnail_url' in response:
        image_url = response.get('image_url')
        thumbnail_url = response.get('thumbnail_url')
        # Allow thumbnail_url to be None for videos and other files without thumbnails
        is_valid = (image_url and
                   isinstance(image_url, str) and
                   image_url.strip() and
                   image_url.split('.')[-1].lower() in valid_extensions and
                   (thumbnail_url is None or
                    (isinstance(thumbnail_url, str) and thumbnail_url.strip())))
        if not is_valid:
            print(f"Invalid media response: image_url={image_url}, thumbnail_url={thumbnail_url}")
        return is_valid
    elif 'message' in response and isinstance(response['message'], str):
        try:
            import json
            parsed = json.loads(response['message'])
            attachments = parsed.get('attachments', [])
            is_valid = all(
                isinstance(att, dict) and
                'url' in att and
                isinstance(att['url'], str) and
                att['url'].strip() and
                att['url'].split('.')[-1].lower() in valid_extensions and
                # Allow thumbnail_url to be None or a valid string
                ('thumbnail_url' not in att or
                 att['thumbnail_url'] is None or
                 (isinstance(att['thumbnail_url'], str) and att['thumbnail_url'].strip()))
                for att in attachments
            )
            if not is_valid:
                print(f"Invalid attachments in media response: {attachments}")
            return is_valid
        except json.JSONDecodeError:
            print(f"Invalid JSON in media response message: {response['message']}")
            return False
    print(f"Invalid media response format: {response}")
    return False


def register_socket_handlers(socketio, users_db, channels, command_processor):
    users = {}  # sid -> user_uuid

    @socketio.on('connect')
    def handle_connect():
        print(f"Client connected: {request.sid}")
        if 'user_uuid' in session and request.sid not in users:
            users[request.sid] = session['user_uuid']
            print(f"Restored user {session['user_uuid']} for sid {request.sid}")

    @socketio.on('test_event')
    def handle_test_event(data):
        print(f"Test event received: {data}")
        emit('test_response', {'msg': 'Test successful'})

    @socketio.on('register_user_with_password')
    def handle_register(data):
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        avatar_url = data.get('avatar_url')
        if not username or not password:
            emit('register_error', {'msg': 'Username and password are required'})
            return
        if len(username) < 3 or len(password) < 6:
            emit('register_error', {'msg': 'Username must be at least 3 characters and password at least 6 characters'})
            return
        try:
            user_uuid = str(uuid.uuid4())
            password_hash = save_user(user_uuid, username, password, avatar_url)
            users_db[user_uuid] = {
                'username': username,
                'password_hash': password_hash,
                'avatar_url': avatar_url
            }
            users[request.sid] = user_uuid
            session['user_uuid'] = user_uuid
            emit('user_registered', {})
            socketio.emit('update_users', {
                'users': [users_db[uuid] for uuid in users.values() if uuid in users_db]
            })
            socketio.emit('update_channels', {'channels': channels})
        except ValueError as e:
            emit('register_error', {'msg': str(e)})
        except Exception as e:
            emit('register_error', {'msg': f'Registration failed: {str(e)}'})

    @socketio.on('login_user')
    def handle_login(data):
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        avatar_url = data.get('avatar_url')
        user = get_user_by_username(username)
        if not user or not check_password_hash(user['password_hash'], password):
            emit('login_error', {'msg': 'Invalid username or password'})
            return
        users[request.sid] = user['uuid']
        session['user_uuid'] = user['uuid']
        if avatar_url:
            update_user_avatar(user['uuid'], avatar_url)
            users_db[user['uuid']]['avatar_url'] = avatar_url
        emit('user_registered', {})
        socketio.emit('update_users', {
            'users': [users_db[uuid] for uuid in users.values() if uuid in users_db]
        })
        socketio.emit('update_channels', {'channels': channels})

    @socketio.on('update_avatar')
    def handle_update_avatar(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        avatar_url = data.get('avatar_url')
        if not avatar_url:
            emit('error', {'msg': 'No avatar URL provided'})
            return
        update_user_avatar(user_uuid, avatar_url)
        users_db[user_uuid]['avatar_url'] = avatar_url
        socketio.emit('update_users', {
            'users': [users_db[uuid] for uuid in users.values() if uuid in users_db]
        })

    @socketio.on('start_typing')
    def handle_start_typing(data):
        channel = data.get('channel', '').strip()
        if not channel or request.sid not in users:
            return
        username = users_db[users[request.sid]]['username']

        def remove_typing():
            if channel in typing_users and username in typing_users[channel]:
                typing_users[channel].remove(username)
                if not typing_users[channel]:
                    del typing_users[channel]
                socketio.emit('typing', {'users': list(typing_users.get(channel, set()))}, room=channel)

        if channel not in typing_users:
            typing_users[channel] = set()
        typing_users[channel].add(username)

        threading.Timer(3.0, remove_typing).start()

        socketio.emit('typing', {'users': list(typing_users[channel])}, room=channel)

    @socketio.on('send_message')
    def handle_send_message(data):
        request_id = data.get('request_id', str(uuid.uuid4()))
        print(f"Received send_message with request_id: {request_id}, data: {data}")
        if request_id in processed_requests:
            print(f"Skipping duplicate request: {request_id}")
            return
        processed_requests.add(request_id)
        print(f"Processing send_message with request_id: {request_id}")
        channel = data['channel'].strip()
        message = data['message'].strip()
        user_uuid = users.get(request.sid)
        sender = users_db[user_uuid]['username'] if user_uuid and user_uuid in users_db else 'Anonymous'
        is_media = data.get('is_media', 0)
        replied_to = data.get('reply_to')
        form_data = data.get('form_data', {})
        initial_prompt = data.get('initial_prompt')
        if not message:
            print("Empty message, ignoring")
            return
        if message == '!image' and form_data.get('cancel') is True:
            print(f"Skipping !image command with cancel=true from {sender}")
            return
        # Use initial_prompt as args if provided (for !image command with prompt)
        args = form_data if form_data else (initial_prompt if initial_prompt else None)
        response = command_processor.process_command(message, user_uuid, sender, channel, args)
        if response:
            if 'modal_data' in response:
                print(f"Emitting show_modal for {sender} in channel {channel}")
                emit('show_modal', {
                    'modal_data': response['modal_data'],
                    'channel': channel
                }, room=request.sid)
            else:
                if not validate_media_response(response):
                    print(f"Invalid media response from command: {response}")
                    emit('error', {'msg': 'Invalid media data from command'}, room=request.sid)
                    return
                conn = sqlite3.connect('devchat.db')
                c = conn.cursor()
                timestamp = get_standard_timestamp()
                message_content = response.get('message', '')
                if not isinstance(message_content, str):
                    message_content = str(message_content)
                c.execute("INSERT INTO messages (channel, sender, message, is_media, timestamp, replied_to, image_url, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                          (channel, response['sender'], message_content, response['is_media'], timestamp, replied_to, response.get('image_url'), response.get('thumbnail_url')))
                message_id = c.lastrowid
                conn.commit()
                conn.close()
                print(f"Saved message ID {message_id} for {sender} in channel {channel}")
                socketio.emit('receive_message', {
                    'id': message_id,
                    'channel': channel,
                    'sender': response['sender'],
                    'message': message_content,
                    'is_media': response['is_media'],
                    'image_url': response.get('image_url'),
                    'thumbnail_url': response.get('thumbnail_url'),
                    'timestamp': timestamp,
                    'replied_to': replied_to,
                    'replies_count': 0,
                    'reactions': []
                }, room=channel)
            return
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        timestamp = get_standard_timestamp()
        c.execute("INSERT INTO messages (channel, sender, message, is_media, timestamp, replied_to, image_url, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  (channel, sender, message, is_media, timestamp, replied_to, None, None))
        message_id = c.lastrowid
        conn.commit()
        conn.close()
        print(f"Saved message ID {message_id} for {sender} in channel {channel}")
        socketio.emit('receive_message', {
            'id': message_id,
            'channel': channel,
            'sender': sender,
            'message': message,
            'is_media': is_media,
            'timestamp': timestamp,
            'replied_to': replied_to,
            'replies_count': 0,
            'reactions': []
         }, room=channel)

    @socketio.on('submit_image_form')
    def handle_submit_image_form(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        command = data.get('command', '').strip()
        args = data.get('args', {})
        channel = data.get('channel', '').strip()
        sender = users_db[user_uuid]['username'] if user_uuid and user_uuid in users_db else 'Anonymous'
        if not command or not channel:
            emit('error', {'msg': 'Missing command or channel'})
            return
        # Process the command with form data
        response = command_processor.process_command('!' + command, user_uuid, sender, channel, args)
        if response:
            if 'modal_data' in response:
                # This shouldn't happen for form submission, but handle it
                emit('show_modal', {
                    'modal_data': response['modal_data'],
                    'channel': channel
                }, room=request.sid)
            else:
                if not validate_media_response(response):
                    print(f"Invalid media response from command: {response}")
                    emit('error', {'msg': 'Invalid media data from command'}, room=request.sid)
                    return
                conn = sqlite3.connect('devchat.db')
                c = conn.cursor()
                timestamp = get_standard_timestamp()
                message_content = response.get('message', '')
                if not isinstance(message_content, str):
                    message_content = str(message_content)

                # For batch responses (JSON with attachments), don't store individual image URLs in DB
                # They are embedded in the message JSON
                image_url = response.get('image_url')
                thumbnail_url = response.get('thumbnail_url')

                c.execute("INSERT INTO messages (channel, sender, message, is_media, timestamp, replied_to, image_url, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                          (channel, sender, message_content, response['is_media'], timestamp, None, image_url, thumbnail_url))
                message_id = c.lastrowid
                conn.commit()
                conn.close()
                print(f"Saved message ID {message_id} for {sender} in channel {channel}")
                socketio.emit('receive_message', {
                    'id': message_id,
                    'channel': channel,
                    'sender': sender,
                    'message': message_content,
                    'is_media': response['is_media'],
                    'image_url': image_url,
                    'thumbnail_url': thumbnail_url,
                    'timestamp': timestamp,
                    'replied_to': None,
                    'replies_count': 0,
                    'reactions': []
                }, room=channel)

    @socketio.on('delete_message')
    def handle_delete_message(data):
        message_id = data.get('message_id')
        channel = data.get('channel')
        user_uuid = users.get(request.sid)
        if not user_uuid or not message_id or not channel:
            emit('error', {'msg': 'User not authenticated, missing message ID, or missing channel'})
            return
        try:
            conn = sqlite3.connect('devchat.db')
            c = conn.cursor()
            c.execute("SELECT sender FROM messages WHERE id = ? AND channel = ?", (message_id, channel))
            row = c.fetchone()
            if not row:
                emit('error', {'msg': 'Message not found'})
                conn.close()
                return
            sender = row[0]
            if sender != users_db[user_uuid]['username']:
                emit('error', {'msg': 'You can only delete your own messages'})
                conn.close()
                return
            # Delete reactions first to avoid foreign key constraint issues
            c.execute("DELETE FROM reactions WHERE message_id = ?", (message_id,))
            # Then delete the message
            c.execute("DELETE FROM messages WHERE id = ? AND channel = ?", (message_id, channel))
            conn.commit()
            conn.close()
            socketio.emit('message_deleted', {
                'message_id': message_id,
                'channel': channel
            }, room=channel)
        except Exception as e:
            emit('error', {'msg': f'Failed to delete message: {str(e)}'})

    @socketio.on('load_more_messages')
    def handle_load_more_messages(data):
        channel = data.get('channel')
        before_message_id = data.get('before_message_id')
        if not channel or not before_message_id:
            emit('error', {'msg': 'User not authenticated, missing channel, or missing message ID'})
            return
        try:
            conn = sqlite3.connect('devchat.db')
            c = conn.cursor()
            c.execute("SELECT timestamp FROM messages WHERE id = ? AND channel = ?", (before_message_id, channel))
            row = c.fetchone()
            if not row:
                emit('error', {'msg': 'Message not found'})
                conn.close()
                return
            before_timestamp = row[0]
            c.execute("""SELECT m.id, m.sender, m.message, m.is_media, m.timestamp, m.replied_to,
                              m.image_url, m.thumbnail_url,
                              (SELECT COUNT(*) FROM messages r WHERE r.replied_to = m.id) as replies_count
                       FROM messages m WHERE m.channel = ? AND m.timestamp < ? ORDER BY m.timestamp DESC LIMIT 50""",
                      (channel, before_timestamp))
            messages = [
                {
                    'id': row[0],
                    'sender': row[1],
                    'message': row[2],
                    'is_media': row[3],
                    'timestamp': row[4],
                    'replied_to': row[5],
                    'image_url': row[6],
                    'thumbnail_url': row[7],
                    'replies_count': row[8],
                    'reactions': get_reactions(row[0])
                }
                for row in c.fetchall()
            ]
            conn.close()
            emit('channel_history', {
                'channel': channel,
                'messages': messages[::-1],
                'is_load_more': True
            })
        except Exception as e:
            emit('error', {'msg': f'Failed to load more messages: {str(e)}'})

    @socketio.on('join_channel')
    def handle_join_channel(data):
        channel = data['channel'].strip()
        if channel not in channels:
            emit('error', {'msg': 'Channel does not exist'})
            return
        for old_channel in channels:
            if old_channel != channel:
                leave_room(old_channel)
        join_room(channel)
        messages = load_messages(channel)[-100:]
        emit('channel_history', {
            'channel': channel,
            'messages': [{
                'id': m['id'],
                'sender': m['sender'],
                'message': m['message'],
                'is_media': m['is_media'],
                'timestamp': m['timestamp'],
                'replied_to': m['replied_to'],
                'image_url': m['image_url'],
                'thumbnail_url': m['thumbnail_url'],
                'replies_count': m['replies_count'],
                'reactions': m['reactions']
            } for m in messages],
            'is_load_more': False
        })

    @socketio.on('get_reactions')
    def handle_get_reactions(data):
        message_id = data['message_id']
        channel = data['channel']
        user_uuid = users.get(request.sid)
        if not user_uuid or not message_id or not channel:
            emit('error', {'msg': 'User not authenticated, missing message ID, or missing channel'})
            return
        try:
            reactions = get_reactions(message_id)
            emit('receive_reactions', {
                'message_id': message_id,
                'reactions': reactions,
                'channel': channel
            })
        except Exception as e:
            emit('error', {'msg': f'Failed to fetch reactions: {str(e)}'})

    @socketio.on('add_reaction')
    def handle_add_reaction(data):
        message_id = data['message_id']
        user_uuid = users.get(request.sid)
        emoji = data['emoji']
        channel = data.get('channel')
        if not user_uuid or not message_id or not channel:
            emit('error', {'msg': 'User not authenticated, missing message ID, or missing channel'})
            return
        try:
            add_reaction(message_id, user_uuid, emoji)
            reactions = get_reactions(message_id)
            socketio.emit('receive_reactions', {
                'message_id': message_id,
                'reactions': reactions,
                'channel': channel
            }, room=channel)
        except Exception as e:
            emit('error', {'msg': f'Failed to add reaction: {str(e)}'})

    @socketio.on('remove_reaction')
    def handle_remove_reaction(data):
        message_id = data['message_id']
        user_uuid = users.get(request.sid)
        emoji = data['emoji']
        channel = data.get('channel')
        if not user_uuid or not message_id or not channel:
            emit('error', {'msg': 'User not authenticated, missing message ID, or missing channel'})
            return
        try:
            remove_reaction(message_id, user_uuid, emoji)
            reactions = get_reactions(message_id)
            socketio.emit('receive_reactions', {
                'message_id': message_id,
                'reactions': reactions,
                'channel': channel
            }, room=channel)
        except Exception as e:
            emit('error', {'msg': f'Failed to remove reaction: {str(e)}'})

    @socketio.on('get_user_settings')
    def handle_get_user_settings():
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        try:
            settings = get_user_settings(user_uuid)
            if settings:
                emit('user_settings', settings)
            else:
                emit('error', {'msg': 'Failed to retrieve user settings'})
        except Exception as e:
            emit('error', {'msg': f'Failed to get user settings: {str(e)}'})

    @socketio.on('update_user_settings')
    def handle_update_user_settings(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        settings = data.get('settings', {})
        if not settings:
            emit('error', {'msg': 'No settings provided'})
            return
        try:
            update_user_settings(user_uuid, settings)
            # Update the in-memory user data
            if user_uuid in users_db:
                users_db[user_uuid].update(settings)
            emit('settings_updated', {'success': True})
            # Notify all users of the update
            socketio.emit('update_users', {
                'users': [users_db[uuid] for uuid in users.values() if uuid in users_db]
            })
        except Exception as e:
            emit('error', {'msg': f'Failed to update settings: {str(e)}'})

    @socketio.on('create_channel')
    def handle_create_channel(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        channel_name = data.get('channel', '').strip()
        if not channel_name:
            emit('error', {'msg': 'Channel name is required'})
            return
        # Sanitize channel name
        import re
        channel_name = re.sub(r'[^a-zA-Z0-9-_]', '-', channel_name).lower()
        channel_name = re.sub(r'-+', '-', channel_name).strip('-')
        if not channel_name or len(channel_name) > 50:
            emit('error', {'msg': 'Invalid channel name'})
            return
        try:
            if create_channel(channel_name):
                # Reload channels and notify all users
                channels.clear()
                channels.extend(load_channels())
                socketio.emit('update_channels', {'channels': channels})
                emit('channel_created', {'channel': channel_name})
            else:
                emit('error', {'msg': 'Channel already exists'})
        except Exception as e:
            emit('error', {'msg': f'Failed to create channel: {str(e)}'})

    @socketio.on('delete_channel')
    def handle_delete_channel(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        channel_name = data.get('channel', '').strip()
        if not channel_name:
            emit('error', {'msg': 'Channel name is required'})
            return
        if channel_name == 'general':
            emit('error', {'msg': 'Cannot delete the general channel'})
            return
        try:
            if delete_channel(channel_name):
                # Reload channels and notify all users
                channels.clear()
                channels.extend(load_channels())
                socketio.emit('update_channels', {'channels': channels})
                emit('channel_deleted', {'channel': channel_name})
            else:
                emit('error', {'msg': 'Failed to delete channel'})
        except Exception as e:
            emit('error', {'msg': f'Failed to delete channel: {str(e)}'})

    @socketio.on('get_message')
    def handle_get_message(data):
        message_id = data.get('message_id')
        channel = data.get('channel')
        if not message_id or not channel:
            emit('error', {'msg': 'Missing message ID or channel'})
            return
        try:
            conn = sqlite3.connect('devchat.db')
            c = conn.cursor()
            c.execute("SELECT sender, message, is_media, timestamp, replied_to FROM messages WHERE id = ? AND channel = ?", (message_id, channel))
            row = c.fetchone()
            conn.close()
            if row:
                emit('message_data', {
                    'message': {
                        'sender': row[0],
                        'message': row[1],
                        'is_media': row[2],
                        'timestamp': row[3],
                        'replied_to': row[4]
                    }
                })
            else:
                emit('error', {'msg': 'Message not found'})
        except Exception as e:
            emit('error', {'msg': f'Failed to fetch message: {str(e)}'})

    @socketio.on('disconnect')
    def handle_disconnect():
        user_uuid = users.pop(request.sid, None)
        if user_uuid:
            socketio.emit('update_users', {
                'users': [users_db[uuid] for uuid in users.values() if uuid in users_db]
            })