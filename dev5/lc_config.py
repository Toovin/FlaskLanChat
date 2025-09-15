import os

EXTENSIONS_DIR = 'extensions'
UPLOAD_DIR = 'static/uploads'
THUMBNAILS_DIR = 'static/thumbnails/uploads'
AVATAR_DIR = 'static/user_avatars'
DEFAULT_AVATAR_DIR = 'static/default_avatars'
MEDIA_DOWNLOAD_DIR = 'static/media_downloaded'
THUMBNAILS_MEDIA_DOWNLOADED_DIR = 'static/thumbnails/media_downloaded'

# LiveKit Configuration
LIVEKIT_API_KEY = os.getenv('LIVEKIT_API_KEY', 'devkey')
LIVEKIT_API_SECRET = os.getenv('LIVEKIT_API_SECRET', 'secret')
LIVEKIT_WS_URL = os.getenv('LIVEKIT_WS_URL', 'ws://192.168.1.101:7880')



