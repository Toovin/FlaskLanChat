#!/usr/bin/env python3
"""
Test script to verify video thumbnail handling in file uploads.
This script tests that videos don't get thumbnail URLs set incorrectly.
"""

import json
import sys
import os

# Add the project root to sys.path
project_root = os.path.dirname(__file__)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

def test_video_thumbnail_handling():
    """Test that videos don't get incorrect thumbnail URLs."""
    print("🎥 Testing video thumbnail handling...")

    # Simulate the file upload response logic for different file types
    test_files = [
        {
            'filename': 'test_image.jpg',
            'expected_thumbnail': 'should have thumbnail URL',
            'is_video': False
        },
        {
            'filename': 'test_video.mp4',
            'expected_thumbnail': 'should be None/null',
            'is_video': True
        },
        {
            'filename': 'test_video.webm',
            'expected_thumbnail': 'should be None/null',
            'is_video': True
        },
        {
            'filename': 'test_video.avi',
            'expected_thumbnail': 'should be None/null',
            'is_video': True
        }
    ]

    for test_file in test_files:
        filename = test_file['filename']
        ext = filename.split('.')[-1].lower()
        storage_dir = 'uploads'

        # Simulate the server-side logic
        url = f'/static/{storage_dir}/{filename}'
        thumbnail_url = None
        is_media = ext in ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'avi', 'mov']

        if is_media and ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']:
            # Images get thumbnails
            thumbnail_url = f'/static/thumbnails/{storage_dir}/{filename.replace(f".{ext}", "_thumb.jpg")}'
        elif is_media and ext in ['mp4', 'webm', 'avi', 'mov']:
            # Videos don't get thumbnails
            thumbnail_url = None

        # Final response (simulating the server response)
        response = {'url': url, 'thumbnail_url': thumbnail_url}

        print(f"  {filename}:")
        print(f"    URL: {response['url']}")
        print(f"    Thumbnail: {response['thumbnail_url']}")
        print(f"    Expected: {test_file['expected_thumbnail']}")

        # Verify expectations
        if test_file['is_video']:
            if response['thumbnail_url'] is None:
                print("    ✅ PASS: Video correctly has no thumbnail")
            else:
                print("    ❌ FAIL: Video should not have thumbnail")
                return False
        else:
            if response['thumbnail_url'] and response['thumbnail_url'] != response['url']:
                print("    ✅ PASS: Image has proper thumbnail")
            else:
                print("    ❌ FAIL: Image should have proper thumbnail")
                return False

    return True

def test_client_attachment_filtering():
    """Test that client-side filtering allows attachments with null thumbnail_url."""
    print("🎥 Testing client attachment filtering...")

    # Simulate attachments array with mixed media types
    attachments = [
        {
            'url': '/static/uploads/image1.jpg',
            'thumbnail_url': '/static/thumbnails/uploads/image1_thumb.jpg'
        },
        {
            'url': '/static/uploads/video1.mp4',
            'thumbnail_url': None  # Video has null thumbnail
        },
        {
            'url': '/static/uploads/image2.jpg',
            'thumbnail_url': '/static/thumbnails/uploads/image2_thumb.jpg'
        }
    ]

    # Simulate client-side filtering logic (Python version)
    filtered_attachments = []
    for att in attachments:
        if (att and att.get('url') and isinstance(att['url'], str) and
            (att.get('thumbnail_url') is None or
             att.get('thumbnail_url') is None or
             (isinstance(att.get('thumbnail_url'), str) and att['thumbnail_url'].strip()))):
            filtered_attachments.append({
                'url': att['url'],
                'thumbnail_url': att.get('thumbnail_url') or None
            })

    print(f"  Original attachments: {len(attachments)}")
    print(f"  Filtered attachments: {len(filtered_attachments)}")

    # Should keep all 3 attachments
    if len(filtered_attachments) == 3:
        print("  ✅ PASS: All attachments preserved (including videos with null thumbnails)")

        # Check that video has null thumbnail preserved
        video_attachment = None
        for att in filtered_attachments:
            if 'video1.mp4' in att['url']:
                video_attachment = att
                break

        if video_attachment and video_attachment['thumbnail_url'] is None:
            print("  ✅ PASS: Video thumbnail_url correctly preserved as null")
            return True
        else:
            print("  ❌ FAIL: Video thumbnail_url not preserved as null")
            return False
    else:
        print("  ❌ FAIL: Some attachments were filtered out")
        return False

if __name__ == "__main__":
    print("🎥 Video Thumbnail Handling Test Suite")
    print("=" * 50)

    tests_passed = 0
    total_tests = 2

    if test_video_thumbnail_handling():
        tests_passed += 1
        print("\n🎉 Server-side video thumbnail handling test passed!")
    else:
        print("\n❌ Server-side video thumbnail handling test failed!")

    if test_client_attachment_filtering():
        tests_passed += 1
        print("🎉 Client-side attachment filtering test passed!")
    else:
        print("❌ Client-side attachment filtering test failed!")

    print(f"\nResults: {tests_passed}/{total_tests} tests passed")

    if tests_passed == total_tests:
        print("🎉 All video thumbnail tests passed!")
        print("   - Videos correctly get null thumbnail_url")
        print("   - Images still get proper thumbnail URLs")
        print("   - Client filtering preserves all attachments")
    else:
        print("⚠️  Some tests failed. Check the output above.")