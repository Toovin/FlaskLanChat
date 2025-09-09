from flask import Flask
from flask_socketio import SocketIO
from lc_config import UPLOAD_DIR, AVATAR_DIR, EXTENSIONS_DIR, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL
from lc_database import init_db, load_users, load_channels
from lc_routes import register_routes
from lc_socket_handlers import register_socket_handlers
from lc_command_processor import CommandProcessor
from livekit_room_manager import LiveKitRoomManager
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24).hex()
socketio = SocketIO(app, cors_allowed_origins="*", engineio_logger=False, manage_session=True)

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AVATAR_DIR, exist_ok=True)
os.makedirs(EXTENSIONS_DIR, exist_ok=True)

# Initialize LiveKit room manager
livekit_manager = LiveKitRoomManager(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL)

# Initialize database and load data
init_db()
users_db = load_users()
channels = load_channels()

# Initialize command processor
command_processor = CommandProcessor(socketio, users_db)

# Register routes and socket handlers
register_routes(app)
register_socket_handlers(socketio, users_db, channels, command_processor, livekit_manager)

if __name__ == '__main__':
    print("Starting server on port 6970...")
    socketio.run(app, host='0.0.0.0', port=6970, debug=True, allow_unsafe_werkzeug=True, use_reloader=False)