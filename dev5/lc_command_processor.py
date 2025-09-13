from pathlib import Path
import importlib.util
import sys
import io
import requests
from datetime import datetime
import uuid
from lc_config import EXTENSIONS_DIR
import os
import logging as logger

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
        project_root = extensions_path.parent
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))
        for file_path in extensions_path.glob("*.py"):
            module_name = file_path.stem
            try:
                spec = importlib.util.spec_from_file_location(module_name, file_path)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    sys.modules[module_name] = module
                    spec.loader.exec_module(module)
                    if hasattr(module, 'setup'):
                        module.setup(self)
                        print(f"Loaded extension: {module_name}")
            except Exception as e:
                print(f"Failed to load extension {module_name}: {e}")

    def process_command(self, message, user_uuid, sender, channel, provided_args=None):
        if message.startswith('!'):
            command_name = message[1:].split()[0].lower()
            args = provided_args if provided_args is not None else message[len(command_name) + 2:].strip()
            handler = self.commands.get(command_name)
            if handler:
                try:
                    response = handler(args, sender, channel)
                    if response and isinstance(response, dict):
                        return response
                    else:
                        logger.error(f"Command {command_name} returned invalid response: {response}")
                        return {'message': f'Error processing command {command_name}'}
                except Exception as e:
                    logger.error(f"Error executing command {command_name}: {str(e)}")
                    return {'message': f'Error: {str(e)}'}
        return None