#!/usr/bin/env python3
"""
Test script to verify command execution through socket handlers
"""

import sys
import os
from pathlib import Path

# Add the project root to sys.path
project_root = Path(__file__).parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

def test_command_processing():
    """Test that commands are processed correctly by the socket handler logic"""
    print("Testing command processing logic...")

    # Import the command processor
    from lc_command_processor import CommandProcessor

    # Create a mock socketio object
    class MockSocketIO:
        pass

    # Create command processor
    socketio = MockSocketIO()
    users_db = {}
    command_processor = CommandProcessor(socketio, users_db)

    # Test chicken command
    print("Testing !chicken command...")
    response = command_processor.process_command("!chicken", "test_user", "general", None)
    print(f"Response: {response}")

    if response and isinstance(response, dict):
        print("✅ Chicken command processed successfully")
        if 'is_media' in response and response['is_media']:
            print("✅ Chicken command returned media response")
        else:
            print("⚠️ Chicken command did not return media response")
    else:
        print("❌ Chicken command failed to process")

    # Test image command without args (should open modal)
    print("\nTesting !image command (no args)...")
    response = command_processor.process_command("!image", "test_user", "general", None)
    print(f"Response: {response}")

    if response and isinstance(response, dict):
        print("✅ Image command processed successfully")
        if 'open_modal' in response and response['open_modal']:
            print("✅ Image command correctly opened modal")
        else:
            print("⚠️ Image command did not open modal")
    else:
        print("❌ Image command failed to process")

    # Test image command with args
    print("\nTesting !image command (with args)...")
    response = command_processor.process_command("!image test prompt", "test_user", "general", None)
    print(f"Response: {response}")

    if response and isinstance(response, dict):
        print("✅ Image command with args processed successfully")
    else:
        print("❌ Image command with args failed to process")

    print("\nCommand processing test completed!")

if __name__ == "__main__":
    test_command_processing()