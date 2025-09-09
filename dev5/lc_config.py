import os

UPLOAD_DIR = 'static/uploads'
AVATAR_DIR = 'static/avatars'
EXTENSIONS_DIR = 'extensions'
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY', 'devkey')  # Default for boilerplate
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET', 'secret')  # Default for boilerplate
LIVEKIT_WS_URL = os.getenv('LIVEKIT_WS_URL', 'ws://192.168.1.101:7880')  # Configure for your LiveKit server
