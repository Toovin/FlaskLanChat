from flask import Flask
from flask_socketio import SocketIO
from lc_config import UPLOAD_DIR, AVATAR_DIR, DEFAULT_AVATAR_DIR, EXTENSIONS_DIR, MEDIA_DOWNLOAD_DIR, THUMBNAILS_DIR, THUMBNAILS_MEDIA_DOWNLOADED_DIR
from lc_database import init_db, load_users, load_channels
from lc_routes import register_routes
from lc_socket_handlers import register_socket_handlers
from lc_command_processor import CommandProcessor

import os
import yt_dlp


app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24).hex()
app.config['SESSION_COOKIE_SECURE'] = False  # Allow cookies over HTTP for development
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_PATH'] = '/'  # Ensure cookie is available for all paths
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour session lifetime
app.config['SESSION_REFRESH_EACH_REQUEST'] = True  # Refresh session on each request
app.config['SESSION_TYPE'] = 'filesystem'  # Use filesystem for session storage
app.config['SESSION_FILE_DIR'] = './sessions'  # Directory for session files
app.config['SESSION_PERMANENT'] = True  # Make sessions permanent
socketio = SocketIO(app,
                    cors_allowed_origins="*",
                    engineio_logger=False,
                    manage_session=True,
                    ping_timeout=60,  # 60 seconds ping timeout
                    ping_interval=25,  # Send ping every 25 seconds
                    max_http_buffer_size=100000000,  # 100MB max buffer
                    async_mode='threading')

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AVATAR_DIR, exist_ok=True)
os.makedirs(DEFAULT_AVATAR_DIR, exist_ok=True)
os.makedirs(EXTENSIONS_DIR, exist_ok=True)
os.makedirs(MEDIA_DOWNLOAD_DIR, exist_ok=True)
os.makedirs(THUMBNAILS_DIR, exist_ok=True)
os.makedirs(THUMBNAILS_MEDIA_DOWNLOADED_DIR, exist_ok=True)
os.makedirs('./sessions', exist_ok=True)  # Flask session directory


# Initialize database and load data
init_db()
users_db = load_users()
channels = load_channels()

# Initialize command processor
command_processor = CommandProcessor(socketio, users_db)

# Register routes and socket handlers
register_routes(app, socketio)
register_socket_handlers(socketio, users_db, channels, command_processor)

if __name__ == '__main__':
    print("Starting server on port 6970...")
    socketio.run(app, host='0.0.0.0', port=6970, debug=True, allow_unsafe_werkzeug=True, use_reloader=False)