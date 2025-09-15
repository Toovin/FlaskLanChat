#!/usr/bin/env python3
"""
Test script to verify chicken command registration and basic functionality.
This script tests the command loading and registration without requiring a full server setup.
"""

import sys
import os
from pathlib import Path

# Add the project root to sys.path
project_root = Path(__file__).parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

def test_chicken_command_registration():
    """Test that the chicken command can be loaded and registered."""
    print("🐔 Testing chicken command registration...")

    try:
        # Import the command processor
        from lc_command_processor import CommandProcessor

        # Create a mock socketio object
        class MockSocketIO:
            pass

        # Create command processor
        socketio = MockSocketIO()
        users_db = {}
        command_processor = CommandProcessor(socketio, users_db)

        # Check if chicken command is registered
        if 'chicken' in command_processor.commands:
            print("✅ Chicken command is registered!")
            return True
        else:
            print("❌ Chicken command is NOT registered")
            print(f"Available commands: {list(command_processor.commands.keys())}")
            return False

    except Exception as e:
        print(f"❌ Error testing chicken command: {e}")
        return False

def test_chicken_config():
    """Test that the chicken config can be loaded."""
    print("🐔 Testing chicken config...")

    try:
        config_path = os.path.join(os.path.dirname(__file__), 'chicken_pic_config.json')
        if os.path.exists(config_path):
            import json
            with open(config_path, 'r') as f:
                config = json.load(f)
            print(f"✅ Config loaded: RTSP URL = {config.get('rtsp_url')}")
            print(f"✅ Config loaded: Timeout = {config.get('timeout_seconds')} seconds")
            return True
        else:
            print("❌ Config file not found")
            return False
    except Exception as e:
        print(f"❌ Error loading config: {e}")
        return False

def test_extension_loading():
    """Test that the chicken extension can be loaded."""
    print("🐔 Testing extension loading...")

    try:
        # Try to import the chicken_pic module
        import importlib.util
        spec = importlib.util.spec_from_file_location("chicken_pic", "extensions/chicken_pic.py")
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            print("✅ Chicken extension module loaded successfully")
            return True
        else:
            print("❌ Failed to load chicken extension module")
            return False
    except Exception as e:
        print(f"❌ Error loading extension: {e}")
        return False

if __name__ == "__main__":
    print("🐔 Chicken Command Test Suite")
    print("=" * 40)

    tests = [
        test_extension_loading,
        test_chicken_config,
        test_chicken_command_registration,
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        if test():
            passed += 1
        print()

    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Chicken command should work correctly.")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")