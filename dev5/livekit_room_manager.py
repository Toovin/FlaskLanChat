import jwt
from datetime import datetime, timedelta

class LiveKitRoomManager:
    def __init__(self, api_key, api_secret, ws_url):
        self.api_key = api_key
        self.api_secret = api_secret
        self.ws_url = ws_url

    def create_room_token(self, room_name, username):
        payload = {
            'exp': int((datetime.utcnow() + timedelta(hours=1)).timestamp()),  # 1-hour expiry
            'iss': self.api_key,  # API key
            'sub': username,  # Subject (user identity)
            'name': username,  # Display name
            'video': {
                'roomJoin': True,
                'room': room_name,
                'canPublish': True,
                'canSubscribe': True
            }
        }
        token = jwt.encode(payload, self.api_secret, algorithm='HS256')
        return token

    def get_room_config(self, room_name):
        return {
            'ws_url': self.ws_url,
            'room': room_name
        }