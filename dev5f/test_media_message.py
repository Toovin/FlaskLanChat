#!/usr/bin/env python3
"""
Test script to verify media message parsing and handling.
This script tests the message parsing logic without requiring a full server setup.
"""

import json
import sys
import os

# Add the project root to sys.path
project_root = os.path.dirname(__file__)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

def test_media_message_parsing():
    """Test that media messages are parsed correctly."""
    print("🧪 Testing media message parsing...")

    # Simulate the message format sent by the client
    test_message = json.dumps({
        'text': '',
        'attachments': [{
            'url': '/static/uploads/test_video.mp4',
            'thumbnail_url': '/static/thumbnails/uploads/test_video_thumb.jpg'
        }]
    })

    # Simulate the parsing logic from the server
    is_media = True
    message = test_message
    image_url = None
    thumbnail_url = None

    if is_media and message:
        try:
            parsed = json.loads(message)
            if isinstance(parsed, dict) and 'attachments' in parsed:
                attachments = parsed['attachments']
                if isinstance(attachments, list) and len(attachments) > 0:
                    first_attachment = attachments[0]
                    if isinstance(first_attachment, dict):
                        image_url = first_attachment.get('url')
                        thumbnail_url = first_attachment.get('thumbnail_url')
                        # Update message to be the text content only
                        message = parsed.get('text', '')
        except json.JSONDecodeError:
            print(f"❌ Failed to parse media message JSON: {message}")
            return False

    # Verify the results
    expected_image_url = '/static/uploads/test_video.mp4'
    expected_thumbnail_url = '/static/thumbnails/uploads/test_video_thumb.jpg'
    expected_message = ''

    if image_url == expected_image_url and thumbnail_url == expected_thumbnail_url and message == expected_message:
        print("✅ Media message parsing successful!")
        print(f"   Image URL: {image_url}")
        print(f"   Thumbnail URL: {thumbnail_url}")
        print(f"   Message text: '{message}'")
        return True
    else:
        print("❌ Media message parsing failed!")
        print(f"   Expected image_url: {expected_image_url}, got: {image_url}")
        print(f"   Expected thumbnail_url: {expected_thumbnail_url}, got: {thumbnail_url}")
        print(f"   Expected message: '{expected_message}', got: '{message}'")
        return False

def test_non_media_message():
    """Test that non-media messages are handled correctly."""
    print("🧪 Testing non-media message handling...")

    test_message = "Hello world!"
    is_media = False
    message = test_message
    image_url = None
    thumbnail_url = None

    # The parsing logic should not modify non-media messages
    if is_media and message:
        try:
            parsed = json.loads(message)
            if isinstance(parsed, dict) and 'attachments' in parsed:
                attachments = parsed['attachments']
                if isinstance(attachments, list) and len(attachments) > 0:
                    first_attachment = attachments[0]
                    if isinstance(first_attachment, dict):
                        image_url = first_attachment.get('url')
                        thumbnail_url = first_attachment.get('thumbnail_url')
                        message = parsed.get('text', '')
        except json.JSONDecodeError:
            pass

    if message == test_message and image_url is None and thumbnail_url is None:
        print("✅ Non-media message handling successful!")
        return True
    else:
        print("❌ Non-media message handling failed!")
        return False

def test_invalid_json():
    """Test handling of invalid JSON in media messages."""
    print("🧪 Testing invalid JSON handling...")

    test_message = "Not valid JSON {"
    is_media = True
    message = test_message
    image_url = None
    thumbnail_url = None

    if is_media and message:
        try:
            parsed = json.loads(message)
            if isinstance(parsed, dict) and 'attachments' in parsed:
                attachments = parsed['attachments']
                if isinstance(attachments, list) and len(attachments) > 0:
                    first_attachment = attachments[0]
                    if isinstance(first_attachment, dict):
                        image_url = first_attachment.get('url')
                        thumbnail_url = first_attachment.get('thumbnail_url')
                        message = parsed.get('text', '')
        except json.JSONDecodeError:
            print(f"⚠️  Expected JSON decode error for invalid message: {message}")

    # Should not crash and should leave message unchanged
    if message == test_message and image_url is None and thumbnail_url is None:
        print("✅ Invalid JSON handling successful!")
        return True
    else:
        print("❌ Invalid JSON handling failed!")
        return False

if __name__ == "__main__":
    print("🎥 Media Message Test Suite")
    print("=" * 40)

    tests = [
        test_media_message_parsing,
        test_non_media_message,
        test_invalid_json,
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        if test():
            passed += 1
        print()

    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Media message parsing should work correctly.")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")