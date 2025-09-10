from flask_socketio import emit, join_room, leave_room
from werkzeug.security import check_password_hash
from flask import request
from lc_database import save_user, get_user_by_username, update_user_avatar, load_messages, add_reaction, remove_reaction, get_reactions, get_standard_timestamp, create_poll, get_poll, get_channel_polls, vote_on_poll, close_poll
import sqlite3
import uuid
import threading


typing_users = {}  # Added for handling multiple typing people! 9-6-2025 1947PM
processed_requests = set()  # Track processed request IDs

def register_socket_handlers(socketio, users_db, channels, command_processor, livekit_manager):  # Added livekit_manager
    users = {}  # sid -> user_uuid

    @socketio.on('connect')
    def handle_connect():
        print(f"Client connected: {request.sid}")

    @socketio.on('test_event')
    def handle_test_event(data):
        print(f"Test event received: {data}")
        emit('test_response', {'msg': 'Test successful'})

    @socketio.on('join_voice')
    def handle_join_voice(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'Not authenticated'})
            return
        channel = data.get('channel', 'general')
        username = users_db[user_uuid]['username']
        room_name = f'voice-{channel}'

        token = livekit_manager.create_room_token(room_name, username)
        config = livekit_manager.get_room_config(room_name)

        emit('voice_token', {
            'token': token,
            'ws_url': config['ws_url'],
            'room': room_name
        })
        print(f"Sent voice token for {username} in {room_name}")

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
        if not message:
            print("Empty message, ignoring")
            return
        if message == '!image' and form_data.get('cancel') is True:
            print(f"Skipping !image command with cancel=true from {sender}")
            return
        response = command_processor.process_command(data, user_uuid)
        if response:
            if 'modal_data' in response:
                print(f"Emitting show_modal for {sender} in channel {channel}")
                emit('show_modal', {
                    'modal_data': response['modal_data'],
                    'channel': channel
                }, room=request.sid)
            else:
                conn = sqlite3.connect('devchat.db')
                c = conn.cursor()
                timestamp = get_standard_timestamp()
                message_content = response.get('message', '')
                if not isinstance(message_content, str):
                    message_content = str(message_content)
                c.execute("INSERT INTO messages (channel, sender, message, is_media, timestamp, replied_to) VALUES (?, ?, ?, ?, ?, ?)",
                          (channel, response['sender'], message_content, response['is_media'], timestamp, replied_to))
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
                    'timestamp': timestamp,
                    'replied_to': replied_to,
                    'reactions': []
                }, room=channel)
            return
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        timestamp = get_standard_timestamp()
        c.execute("INSERT INTO messages (channel, sender, message, is_media, timestamp, replied_to) VALUES (?, ?, ?, ?, ?, ?)",
                  (channel, sender, message, is_media, timestamp, replied_to))
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
            c.execute("DELETE FROM messages WHERE id = ? AND channel = ?", (message_id, channel))
            c.execute("DELETE FROM reactions WHERE message_id = ?", (message_id,))
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
            c.execute("SELECT id, sender, message, is_media, timestamp, replied_to FROM messages WHERE channel = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT 50",
                      (channel, before_timestamp))
            messages = [
                {
                    'id': row[0],
                    'sender': row[1],
                    'message': row[2],
                    'is_media': row[3],
                    'timestamp': row[4],
                    'replied_to': row[5],
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

    @socketio.on('create_channel')
    def handle_create_channel(data):
        channel = data['channel'].strip()
        if not channel or channel in channels:
            emit('error', {'msg': 'Invalid or duplicate channel name'})
            return
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("INSERT INTO channels (name) VALUES (?)", (channel,))
        conn.commit()
        conn.close()
        channels.append(channel)
        socketio.emit('update_channels', {'channels': channels})

    @socketio.on('delete_channel')
    def handle_delete_channel(data):
        channel = data['channel'].strip()
        if channel == 'general' or channel not in channels:
            emit('error', {'msg': 'Cannot delete general channel or invalid channel'})
            return
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("DELETE FROM channels WHERE name = ?", (channel,))
        c.execute("DELETE FROM messages WHERE channel = ?", (channel,))
        conn.commit()
        conn.close()
        channels.remove(channel)
        socketio.emit('update_channels', {'channels': channels})

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

    @socketio.on('create_poll')
    def handle_create_poll(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        
        channel = data.get('channel', '').strip()
        question = data.get('question', '').strip()
        options = data.get('options', [])
        expires_at = data.get('expires_at')
        
        if not channel or not question or len(options) < 2:
            emit('error', {'msg': 'Invalid poll data: need channel, question, and at least 2 options'})
            return
        
        if len(options) > 10:
            emit('error', {'msg': 'Maximum 10 options allowed'})
            return
        
        try:
            poll_id = create_poll(channel, user_uuid, question, options, expires_at)
            poll_data = get_poll(poll_id)
            
            socketio.emit('poll_created', {
                'poll': poll_data,
                'channel': channel
            }, room=channel)
            
            print(f"Poll {poll_id} created by {users_db[user_uuid]['username']} in {channel}")
        except Exception as e:
            emit('error', {'msg': f'Failed to create poll: {str(e)}'})

    @socketio.on('vote_poll')
    def handle_vote_poll(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        
        poll_id = data.get('poll_id')
        option_index = data.get('option_index')
        channel = data.get('channel')
        
        if poll_id is None or option_index is None or not channel:
            emit('error', {'msg': 'Invalid vote data'})
            return
        
        try:
            poll = get_poll(poll_id)
            if not poll or not poll['is_active']:
                emit('error', {'msg': 'Poll not found or not active'})
                return
            
            if option_index < 0 or option_index >= len(poll['options']):
                emit('error', {'msg': 'Invalid option index'})
                return
            
            vote_on_poll(poll_id, user_uuid, option_index)
            updated_poll = get_poll(poll_id)
            
            socketio.emit('poll_updated', {
                'poll': updated_poll,
                'channel': channel
            }, room=channel)
            
            print(f"User {users_db[user_uuid]['username']} voted on poll {poll_id}")
        except Exception as e:
            emit('error', {'msg': f'Failed to vote: {str(e)}'})

    @socketio.on('get_channel_polls')
    def handle_get_channel_polls(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        
        channel = data.get('channel', '').strip()
        if not channel:
            emit('error', {'msg': 'Channel required'})
            return
        
        try:
            polls = get_channel_polls(channel)
            emit('channel_polls', {
                'polls': polls,
                'channel': channel
            })
        except Exception as e:
            emit('error', {'msg': f'Failed to get polls: {str(e)}'})

    @socketio.on('close_poll')
    def handle_close_poll(data):
        user_uuid = users.get(request.sid)
        if not user_uuid:
            emit('error', {'msg': 'User not authenticated'})
            return
        
        poll_id = data.get('poll_id')
        channel = data.get('channel')
        
        if not poll_id or not channel:
            emit('error', {'msg': 'Poll ID and channel required'})
            return
        
        try:
            poll = get_poll(poll_id)
            if not poll:
                emit('error', {'msg': 'Poll not found'})
                return
            
            if poll['creator_uuid'] != user_uuid:
                emit('error', {'msg': 'Only poll creator can close the poll'})
                return
            
            close_poll(poll_id)
            updated_poll = get_poll(poll_id)
            
            socketio.emit('poll_updated', {
                'poll': updated_poll,
                'channel': channel
            }, room=channel)
            
            print(f"Poll {poll_id} closed by {users_db[user_uuid]['username']}")
        except Exception as e:
            emit('error', {'msg': f'Failed to close poll: {str(e)}'})

    @socketio.on('disconnect')
    def handle_disconnect():
        user_uuid = users.pop(request.sid, None)
        if user_uuid:
            socketio.emit('update_users', {
                'users': [users_db[uuid] for uuid in users.values() if uuid in users_db]
            })