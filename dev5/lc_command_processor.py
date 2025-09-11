from pathlib import Path
import importlib.util
import sys
import io
import requests
from datetime import datetime
import uuid
from lc_config import EXTENSIONS_DIR
import os

UPLOAD_URL = os.getenv('UPLOAD_URL', 'http://localhost:6970/upload-file')

class CommandProcessor:

    def __init__(self, socketio, users_db):
        self.socketio = socketio
        self.users_db = users_db
        self.commands = {}
        self.load_extensions()

    def register_command(self, name, callback):
        self.commands[name] = callback
        print(f"Registered command: !{name}")

    def load_extensions(self):
        extensions_path = Path(EXTENSIONS_DIR)
        for file_path in extensions_path.glob("*.py"):
            module_name = file_path.stem
            try:
                spec = importlib.util.spec_from_file_location(module_name, file_path)
                module = importlib.util.module_from_spec(spec)
                sys.modules[module_name] = module
                spec.loader.exec_module(module)
                if hasattr(module, 'setup'):
                    module.setup(self)
                    print(f"Loaded extension: {module_name}")
            except Exception as e:
                print(f"Failed to load extension {module_name}: {e}")

    def process_command(self, data, user_uuid):
        message = data.get('message', '').strip()
        channel = data.get('channel', '').strip()
        if not message.startswith('!'):
            return None
        parts = message[1:].split(' ', 1)
        command_name = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ''
        sender = self.users_db[user_uuid]['username'] if user_uuid in self.users_db else 'Anonymous'
        initial_prompt = data.get('initial_prompt', '')
        form_data = data.get('form_data', {})
        if command_name in self.commands:
            try:
                response = self.commands[command_name](args if not form_data else form_data, sender, channel)
                if response is None:
                    return None
                if isinstance(response, dict):
                    if 'open_modal' in response:
                        response['prompt'] = initial_prompt
                        return {'modal_data': response}
                    elif 'cancel' in response and response['cancel']:
                        return None
                    elif 'image_data' in response and response.get('is_image', False):
                        image_data = response['image_data']
                        files = {'file': (f'generated_image_{uuid.uuid4()}.jpg', io.BytesIO(image_data), 'image/jpeg')}
                        try:
                            upload_response = requests.post(
                                UPLOAD_URL,
                                files=files,
                                timeout=30
                            )
                            upload_response.raise_for_status()  # Raise exception for bad status codes
                            data = upload_response.json()
                            url = data['urls'][0] if isinstance(data.get('urls'), list) else data.get('url')
                            return {
                                'sender': 'Bot',
                                'message': url,
                                'is_media': True,
                                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                            }
                        except requests.RequestException as e:
                            print(f"Image upload failed: {str(e)}")
                            return {
                                'sender': 'Bot',
                                'message': f"Failed to upload image: {str(e)}",
                                'is_media': False,
                                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                            }
                    elif 'message' in response:
                        return {
                            'sender': 'Bot',
                            'message': response['message'],
                            'is_media': response.get('is_media', False),
                            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        }
                    else:
                        return {
                            'sender': 'Bot',
                            'message': str(response),
                            'is_media': False,
                            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        }
                else:
                    return {
                        'sender': 'Bot',
                        'message': response if isinstance(response, str) else str(response),
                        'is_media': False,
                        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    }
            except Exception as e:
                print(f"Error executing command {command_name}: {e}")
                return {
                    'sender': 'Bot',
                    'message': f"Error: {e}",
                    'is_media': False,
                    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
        return None
