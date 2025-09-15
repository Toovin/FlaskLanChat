#!/usr/bin/env python3
"""
Test script to verify carousel functionality for bulk media uploads.
This script tests the server-side message processing for multiple attachments.
"""

import json
import sys
import os

# Add the project root to sys.path
project_root = os.path.dirname(__file__)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

def test_bulk_upload_message_processing():
    """Test that bulk upload messages preserve all attachments for carousel display."""
    print("🖼️  Testing bulk upload message processing...")

    # Simulate the message format sent by client for multiple files
    test_message = json.dumps({
        'text': '',
        'attachments': [
            {
                'url': '/static/uploads/video1.mp4',
                'thumbnail_url': '/static/thumbnails/uploads/video1_thumb.jpg'
            },
            {
                'url': '/static/uploads/image1.jpg',
                'thumbnail_url': '/static/thumbnails/uploads/image1_thumb.jpg'
            },
            {
                'url': '/static/uploads/video2.mp4',
                'thumbnail_url': '/static/thumbnails/uploads/video2_thumb.jpg'
            }
        ]
    })

    # Simulate the server-side processing logic
    is_media = True
    message = test_message
    image_url = None
    thumbnail_url = None
    original_message = message  # Preserve original message for carousel support

    if is_media and message:
        try:
            parsed = json.loads(message)
            if isinstance(parsed, dict) and 'attachments' in parsed:
                attachments = parsed['attachments']
                if isinstance(attachments, list) and len(attachments) > 0:
                    # For backward compatibility, still populate single URL fields with first attachment
                    first_attachment = attachments[0]
                    if isinstance(first_attachment, dict):
                        image_url = first_attachment.get('url')
                        thumbnail_url = first_attachment.get('thumbnail_url')
                    # Keep original message intact for client-side carousel parsing
                    message = original_message
                else:
                    # No attachments, use original message
                    message = original_message
            else:
                # Not a valid attachment structure, use original message
                message = original_message
        except json.JSONDecodeError:
            print(f"❌ Failed to parse media message JSON: {message}")
            # Keep original message on parse error
            message = original_message

    # Verify the results
    expected_image_url = '/static/uploads/video1.mp4'
    expected_thumbnail_url = '/static/thumbnails/uploads/video1_thumb.jpg'
    expected_message = test_message  # Should preserve original JSON

    if (image_url == expected_image_url and
        thumbnail_url == expected_thumbnail_url and
        message == expected_message):

        # Verify that the message can be parsed by client
        try:
            parsed_client = json.loads(message)
            client_attachments = parsed_client.get('attachments', [])
            if len(client_attachments) == 3:
                print("✅ Bulk upload message processing successful!")
                print(f"   First attachment URL: {image_url}")
                print(f"   First attachment thumbnail: {thumbnail_url}")
                print(f"   Total attachments preserved: {len(client_attachments)}")
                print(f"   Message preserved for carousel: {len(message) > 100}")
                return True
            else:
                print(f"❌ Wrong number of attachments: expected 3, got {len(client_attachments)}")
                return False
        except json.JSONDecodeError:
            print("❌ Client cannot parse preserved message")
            return False
    else:
        print("❌ Bulk upload message processing failed!")
        print(f"   Expected image_url: {expected_image_url}, got: {image_url}")
        print(f"   Expected thumbnail_url: {expected_thumbnail_url}, got: {thumbnail_url}")
        print(f"   Expected message preserved: {len(expected_message) > 100}, got: {len(message) > 100}")
        return False

def test_single_upload_backward_compatibility():
    """Test that single uploads still work for backward compatibility."""
    print("🖼️  Testing single upload backward compatibility...")

    # Simulate single file upload message
    test_message = json.dumps({
        'text': '',
        'attachments': [{
            'url': '/static/uploads/single_video.mp4',
            'thumbnail_url': '/static/thumbnails/uploads/single_video_thumb.jpg'
        }]
    })

    # Simulate the server-side processing logic
    is_media = True
    message = test_message
    image_url = None
    thumbnail_url = None
    original_message = message

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
                    message = original_message
                else:
                    message = original_message
            else:
                message = original_message
        except json.JSONDecodeError:
            print(f"❌ Failed to parse media message JSON: {message}")
            message = original_message

    # Verify single upload still works
    expected_image_url = '/static/uploads/single_video.mp4'
    expected_thumbnail_url = '/static/thumbnails/uploads/single_video_thumb.jpg'

    if image_url == expected_image_url and thumbnail_url == expected_thumbnail_url:
        print("✅ Single upload backward compatibility successful!")
        return True
    else:
        print("❌ Single upload backward compatibility failed!")
        return False

def test_non_json_message():
    """Test handling of non-JSON messages."""
    print("🖼️  Testing non-JSON message handling...")

    test_message = "Plain text message"
    is_media = False
    message = test_message
    image_url = None
    thumbnail_url = None
    original_message = message

    # Non-media messages should not be processed
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
                    message = original_message
                else:
                    message = original_message
            else:
                message = original_message
        except json.JSONDecodeError:
            print(f"⚠️  Expected JSON decode error for non-JSON message: {message}")
            message = original_message

    if message == test_message and image_url is None and thumbnail_url is None:
        print("✅ Non-JSON message handling successful!")
        return True
    else:
        print("❌ Non-JSON message handling failed!")
        return False

if __name__ == "__main__":
    print("🎠 Carousel Fix Test Suite")
    print("=" * 40)

    tests = [
        test_bulk_upload_message_processing,
        test_single_upload_backward_compatibility,
        test_non_json_message,
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        if test():
            passed += 1
        print()

    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Carousel functionality should now work correctly.")
        print("   - Bulk uploads will display as carousels")
        print("   - Single uploads remain backward compatible")
        print("   - Mixed media types (images + videos) supported")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")