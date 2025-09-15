#!/usr/bin/env python3
"""
Test script to verify the database schema fix for media messages.
This tests the image_url and thumbnail_url columns in the messages table.
"""

import sqlite3
from datetime import datetime

def test_database_schema():
    """Test that the database has the correct schema with new columns."""
    print("Testing database schema...")

    conn = sqlite3.connect('devchat.db')
    c = conn.cursor()

    # Check table structure
    c.execute("PRAGMA table_info(messages)")
    columns = [col[1] for col in c.fetchall()]

    required_columns = ['id', 'channel', 'sender', 'message', 'is_media', 'timestamp', 'replied_to', 'image_url', 'thumbnail_url']

    missing_columns = []
    for col in required_columns:
        if col not in columns:
            missing_columns.append(col)

    if missing_columns:
        print(f"❌ Missing columns: {missing_columns}")
        return False
    else:
        print("✅ All required columns present")
        return True

def test_insert_media_message():
    """Test inserting a media message with image_url and thumbnail_url."""
    print("\nTesting media message insertion...")

    conn = sqlite3.connect('devchat.db')
    c = conn.cursor()

    # Insert a test media message
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    test_data = {
        'channel': 'general',
        'sender': 'TestUser',
        'message': 'Test media message',
        'is_media': 1,
        'timestamp': timestamp,
        'replied_to': None,
        'image_url': '/static/uploads/test.jpg',
        'thumbnail_url': '/static/thumbnails/uploads/test_thumb.jpg'
    }

    try:
        c.execute("""
            INSERT INTO messages (channel, sender, message, is_media, timestamp, replied_to, image_url, thumbnail_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            test_data['channel'],
            test_data['sender'],
            test_data['message'],
            test_data['is_media'],
            test_data['timestamp'],
            test_data['replied_to'],
            test_data['image_url'],
            test_data['thumbnail_url']
        ))

        message_id = c.lastrowid
        conn.commit()
        print(f"✅ Successfully inserted media message with ID: {message_id}")
        return message_id

    except Exception as e:
        print(f"❌ Failed to insert media message: {e}")
        return None
    finally:
        conn.close()

def test_retrieve_media_message(message_id):
    """Test retrieving a media message with the new columns."""
    print(f"\nTesting media message retrieval for ID: {message_id}...")

    conn = sqlite3.connect('devchat.db')
    c = conn.cursor()

    try:
        c.execute("""
            SELECT id, sender, message, is_media, timestamp, replied_to, image_url, thumbnail_url
            FROM messages WHERE id = ?
        """, (message_id,))

        row = c.fetchone()
        if row:
            message_data = {
                'id': row[0],
                'sender': row[1],
                'message': row[2],
                'is_media': row[3],
                'timestamp': row[4],
                'replied_to': row[5],
                'image_url': row[6],
                'thumbnail_url': row[7]
            }

            # Verify the data
            if message_data['image_url'] == '/static/uploads/test.jpg' and message_data['thumbnail_url'] == '/static/thumbnails/uploads/test_thumb.jpg':
                print("✅ Media message retrieved successfully with correct URLs")
                print(f"   Image URL: {message_data['image_url']}")
                print(f"   Thumbnail URL: {message_data['thumbnail_url']}")
                return True
            else:
                print(f"❌ URLs don't match expected values: {message_data['image_url']}, {message_data['thumbnail_url']}")
                return False
        else:
            print("❌ No message found with the given ID")
            return False

    except Exception as e:
        print(f"❌ Failed to retrieve media message: {e}")
        return False
    finally:
        conn.close()

def test_backward_compatibility():
    """Test that existing messages without URLs still work."""
    print("\nTesting backward compatibility...")

    conn = sqlite3.connect('devchat.db')
    c = conn.cursor()

    # Insert a regular (non-media) message
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        c.execute("""
            INSERT INTO messages (channel, sender, message, is_media, timestamp, replied_to, image_url, thumbnail_url)
            VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
        """, ('general', 'TestUser', 'Regular message', 0, timestamp, None))

        message_id = c.lastrowid
        conn.commit()
        print(f"✅ Successfully inserted regular message with ID: {message_id}")

        # Retrieve it
        c.execute("""
            SELECT id, sender, message, is_media, image_url, thumbnail_url
            FROM messages WHERE id = ?
        """, (message_id,))

        row = c.fetchone()
        if row and row[4] is None and row[5] is None:
            print("✅ Backward compatibility maintained - NULL values handled correctly")
            return True
        else:
            print("❌ Backward compatibility issue - NULL values not handled correctly")
            return False

    except Exception as e:
        print(f"❌ Failed backward compatibility test: {e}")
        return False
    finally:
        conn.close()

def cleanup_test_data():
    """Clean up test messages."""
    print("\nCleaning up test data...")

    conn = sqlite3.connect('devchat.db')
    c = conn.cursor()

    try:
        c.execute("DELETE FROM messages WHERE sender = 'TestUser'")
        deleted_count = c.rowcount
        conn.commit()
        print(f"✅ Cleaned up {deleted_count} test messages")
    except Exception as e:
        print(f"❌ Failed to clean up test data: {e}")
    finally:
        conn.close()

def main():
    print("🧪 Database Schema Fix Test Suite")
    print("=" * 40)

    # Run tests
    schema_ok = test_database_schema()
    if not schema_ok:
        print("\n❌ Schema test failed. Aborting further tests.")
        return

    message_id = test_insert_media_message()
    if message_id:
        retrieve_ok = test_retrieve_media_message(message_id)
    else:
        retrieve_ok = False

    backward_ok = test_backward_compatibility()

    # Summary
    print("\n" + "=" * 40)
    print("📊 Test Results:")
    print(f"   Schema: {'✅' if schema_ok else '❌'}")
    print(f"   Insert: {'✅' if message_id else '❌'}")
    print(f"   Retrieve: {'✅' if retrieve_ok else '❌'}")
    print(f"   Backward Compatibility: {'✅' if backward_ok else '❌'}")

    all_passed = schema_ok and message_id and retrieve_ok and backward_ok
    print(f"\n🎯 Overall: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")

    # Cleanup
    cleanup_test_data()

    if all_passed:
        print("\n🎉 The database schema fix is working correctly!")
        print("   The 'Invalid media message JSON' error should now be resolved.")
    else:
        print("\n⚠️  Some tests failed. Please check the database setup.")

if __name__ == "__main__":
    main()