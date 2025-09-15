#!/usr/bin/env python3
"""
Test script for connection stability improvements.
This script tests various aspects of the Socket.IO connection handling.
"""

import socketio
import time
import threading
import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.dirname(__file__))

from lc_config import UPLOAD_DIR
from lc_database import init_db, load_users, load_channels
from lc_command_processor import CommandProcessor

class ConnectionStabilityTester:
    def __init__(self, server_url='http://localhost:6970'):
        self.server_url = server_url
        self.sio = socketio.Client()
        self.connected = False
        self.reconnect_count = 0
        self.disconnect_count = 0
        self.message_count = 0
        self.command_responses = []

        # Set up event handlers
        self.setup_event_handlers()

    def setup_event_handlers(self):
        @self.sio.on('connect')
        def on_connect():
            print("✅ Connected to server")
            self.connected = True
            self.sio.emit('test_event', {'msg': 'Connection stability test'})

        @self.sio.on('disconnect')
        def on_disconnect():
            print("❌ Disconnected from server")
            self.connected = False
            self.disconnect_count += 1

        @self.sio.on('reconnect')
        def on_reconnect():
            print("🔄 Reconnected to server")
            self.reconnect_count += 1

        @self.sio.on('test_response')
        def on_test_response(data):
            print(f"📨 Test response: {data}")

        @self.sio.on('receive_message')
        def on_receive_message(data):
            print(f"💬 Message received: {data.get('message', '')[:50]}...")
            self.message_count += 1

        @self.sio.on('connection_status')
        def on_connection_status(data):
            print(f"🔗 Connection status: {data}")

        @self.sio.on('pong')
        def on_pong():
            print("🏓 Pong received")

    def connect(self):
        """Connect to the server"""
        try:
            print(f"🔌 Connecting to {self.server_url}...")
            self.sio.connect(self.server_url, wait_timeout=10)
            return True
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            return False

    def disconnect(self):
        """Disconnect from the server"""
        try:
            self.sio.disconnect()
            print("🔌 Disconnected")
        except Exception as e:
            print(f"❌ Error disconnecting: {e}")

    def test_basic_connection(self):
        """Test basic connection and disconnection"""
        print("\n🧪 Testing basic connection...")
        if self.connect():
            time.sleep(2)
            self.disconnect()
            return True
        return False

    def test_reconnection(self):
        """Test reconnection after disconnection"""
        print("\n🧪 Testing reconnection...")
        if self.connect():
            time.sleep(1)
            print("Simulating disconnection...")
            self.disconnect()
            time.sleep(2)
            if self.connect():
                time.sleep(1)
                self.disconnect()
                return True
        return False

    def test_heartbeat(self):
        """Test heartbeat/ping functionality"""
        print("\n🧪 Testing heartbeat...")
        if self.connect():
            # Send ping and wait for pong
            self.sio.emit('ping')
            time.sleep(2)
            self.disconnect()
            return True
        return False

    def test_command_processing(self):
        """Test command processing during connection"""
        print("\n🧪 Testing command processing...")
        if self.connect():
            # Wait for connection to stabilize
            time.sleep(2)

            # Test a simple command
            print("Sending test command...")
            self.sio.emit('send_message', {
                'channel': 'general',
                'message': '!test',
                'request_id': 'test_123'
            })

            time.sleep(3)
            self.disconnect()
            return True
        return False

    def run_all_tests(self):
        """Run all connection stability tests"""
        print("🚀 Starting Connection Stability Tests")
        print("=" * 50)

        tests = [
            ("Basic Connection", self.test_basic_connection),
            ("Reconnection", self.test_reconnection),
            ("Heartbeat", self.test_heartbeat),
            ("Command Processing", self.test_command_processing)
        ]

        results = []
        for test_name, test_func in tests:
            try:
                result = test_func()
                results.append((test_name, result))
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"{test_name}: {status}")
            except Exception as e:
                print(f"{test_name}: ❌ ERROR - {e}")
                results.append((test_name, False))

        print("\n" + "=" * 50)
        print("📊 Test Results Summary:")
        passed = sum(1 for _, result in results if result)
        total = len(results)
        print(f"Passed: {passed}/{total}")

        if passed == total:
            print("🎉 All tests passed!")
        else:
            print("⚠️  Some tests failed. Check the output above.")

        return passed == total

def main():
    """Main test function"""
    print("🔧 Connection Stability Test Suite")
    print("This script tests the Socket.IO connection improvements.")

    # Check if server is running
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(('localhost', 6970))
        sock.close()

        if result != 0:
            print("❌ Server is not running on port 6970")
            print("Please start the server first: python server_v5.py")
            return False
    except:
        print("❌ Cannot check server status")
        return False

    # Run tests
    tester = ConnectionStabilityTester()
    success = tester.run_all_tests()

    return success

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)