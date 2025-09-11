import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import uuid
import os


def init_db():
    db_path = 'devchat.db'
    try:
        # Check if database file is accessible
        if not os.path.exists(db_path):
            print(f"Creating new database file: {db_path}")
        else:
            print(f"Using existing database file: {db_path}")

        conn = sqlite3.connect(db_path)
        c = conn.cursor()

        # Check if messages table exists
        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'")
        table_exists = c.fetchone()
        if table_exists:
            print("Messages table exists, checking for replied_to column")
            c.execute("PRAGMA table_info(messages)")
            columns = [col[1] for col in c.fetchall()]
            if 'replied_to' not in columns:
                print("Adding replied_to column to messages table")
                c.execute("ALTER TABLE messages RENAME TO messages_old")
                c.execute('''CREATE TABLE messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel TEXT,
                    sender TEXT,
                    message TEXT,
                    is_media INTEGER,
                    timestamp TEXT,
                    replied_to INTEGER,
                    FOREIGN KEY (replied_to) REFERENCES messages(id) ON DELETE SET NULL
                )''')
                c.execute('''INSERT INTO messages (id, channel, sender, message, is_media, timestamp)
                             SELECT id, channel, sender, message, is_media, timestamp FROM messages_old''')
                c.execute("DROP TABLE messages_old")
                conn.commit()
        else:
            print("Creating messages table")
            c.execute('''CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel TEXT,
                sender TEXT,
                message TEXT,
                is_media INTEGER,
                timestamp TEXT,
                replied_to INTEGER,
                FOREIGN KEY (replied_to) REFERENCES messages(id) ON DELETE SET NULL
            )''')
            conn.commit()

        # Create other tables
        print("Creating users table if not exists")
        c.execute('''CREATE TABLE IF NOT EXISTS users (
            uuid TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            avatar_url TEXT,
            display_name TEXT,
            status TEXT DEFAULT 'online',
            custom_status TEXT,
            theme TEXT DEFAULT 'darker',
            compact_mode INTEGER DEFAULT 0,
            show_timestamps INTEGER DEFAULT 1,
            allow_dms INTEGER DEFAULT 1,
            show_online_status INTEGER DEFAULT 1,
            typing_indicators INTEGER DEFAULT 1
        )''')

        # Check if new columns exist and add them if they don't
        c.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in c.fetchall()]

        new_columns = [
            ('display_name', 'TEXT'),
            ('status', 'TEXT DEFAULT "online"'),
            ('custom_status', 'TEXT'),
            ('theme', 'TEXT DEFAULT "darker"'),
            ('compact_mode', 'INTEGER DEFAULT 0'),
            ('show_timestamps', 'INTEGER DEFAULT 1'),
            ('allow_dms', 'INTEGER DEFAULT 1'),
            ('show_online_status', 'INTEGER DEFAULT 1'),
            ('typing_indicators', 'INTEGER DEFAULT 1')
        ]

        for col_name, col_type in new_columns:
            if col_name not in columns:
                print(f"Adding {col_name} column to users table")
                c.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                conn.commit()

        print("Creating channels table if not exists")
        c.execute('''CREATE TABLE IF NOT EXISTS channels (
            name TEXT PRIMARY KEY
        )''')

        print("Creating reactions table if not exists")
        c.execute('''CREATE TABLE IF NOT EXISTS reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER,
            user_uuid TEXT,
            emoji TEXT,
            FOREIGN KEY (message_id) REFERENCES messages(id),
            FOREIGN KEY (user_uuid) REFERENCES users(uuid)
        )''')

        print("Cleaning up duplicate reactions")
        c.execute('''
            DELETE FROM reactions
            WHERE id NOT IN (
                SELECT MAX(id)
                FROM reactions
                GROUP BY message_id, user_uuid, emoji
            )
        ''')

        print("Creating unique index for reactions")
        c.execute(
            '''CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_reaction ON reactions (message_id, user_uuid, emoji)''')

        print("Inserting default 'general' channel")
        c.execute("INSERT OR IGNORE INTO channels (name) VALUES ('general')")

        conn.commit()
        print("Database initialization completed successfully")
    except Exception as e:
        print(f"Error during database initialization: {str(e)}")
        raise
    finally:
        conn.close()


def load_users():
    users_db = {}
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("""SELECT uuid, username, password_hash, avatar_url, display_name, status,
                     custom_status, theme, compact_mode, show_timestamps, allow_dms,
                     show_online_status, typing_indicators FROM users""")
        for row in c.fetchall():
            users_db[row[0]] = {
                'username': row[1],
                'password_hash': row[2],
                'avatar_url': row[3],
                'display_name': row[4],
                'status': row[5] or 'online',
                'custom_status': row[6],
                'theme': row[7] or 'darker',
                'compact_mode': bool(row[8]),
                'show_timestamps': bool(row[9]) if row[9] is not None else True,
                'allow_dms': bool(row[10]) if row[10] is not None else True,
                'show_online_status': bool(row[11]) if row[11] is not None else True,
                'typing_indicators': bool(row[12]) if row[12] is not None else True
            }
        conn.close()
        print(f"Loaded {len(users_db)} users from database")
        return users_db
    except Exception as e:
        print(f"Error loading users: {str(e)}")
        raise


def save_user(uuid, username, password, avatar_url=None):
    password_hash = generate_password_hash(password)
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("INSERT INTO users (uuid, username, password_hash, avatar_url) VALUES (?, ?, ?, ?)",
                  (uuid, username, password_hash, avatar_url))
        conn.commit()
        print(f"Saved user: {username}")
        return password_hash
    except sqlite3.IntegrityError as e:
        if "UNIQUE constraint failed" in str(e):
            raise ValueError("Username already taken")
        raise e
    except Exception as e:
        print(f"Error saving user {username}: {str(e)}")
        raise
    finally:
        conn.close()


def update_user_avatar(uuid, avatar_url):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("UPDATE users SET avatar_url = ? WHERE uuid = ?", (avatar_url, uuid))
        conn.commit()
        print(f"Updated avatar for user UUID: {uuid}")
    except Exception as e:
        print(f"Error updating avatar for user UUID {uuid}: {str(e)}")
        raise
    finally:
        conn.close()


def get_user_by_username(username):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("""SELECT uuid, username, password_hash, avatar_url, display_name, status,
                     custom_status, theme, compact_mode, show_timestamps, allow_dms,
                     show_online_status, typing_indicators FROM users WHERE username = ?""", (username,))
        row = c.fetchone()
        conn.close()
        if row:
            print(f"Retrieved user: {username}")
            return {
                'uuid': row[0],
                'username': row[1],
                'password_hash': row[2],
                'avatar_url': row[3],
                'display_name': row[4],
                'status': row[5] or 'online',
                'custom_status': row[6],
                'theme': row[7] or 'darker',
                'compact_mode': bool(row[8]),
                'show_timestamps': bool(row[9]) if row[9] is not None else True,
                'allow_dms': bool(row[10]) if row[10] is not None else True,
                'show_online_status': bool(row[11]) if row[11] is not None else True,
                'typing_indicators': bool(row[12]) if row[12] is not None else True
            }
        print(f"User not found: {username}")
        return None
    except Exception as e:
        print(f"Error retrieving user {username}: {str(e)}")
        raise


def load_channels():
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("SELECT name FROM channels")
        channels = [row[0] for row in c.fetchall()]
        conn.close()
        print(f"Loaded {len(channels)} channels from database")
        return channels
    except Exception as e:
        print(f"Error loading channels: {str(e)}")
        raise


def load_messages(channel):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute(
            """SELECT m.id, m.sender, m.message, m.is_media, m.timestamp, m.replied_to,
                      (SELECT COUNT(*) FROM messages r WHERE r.replied_to = m.id) as replies_count
               FROM messages m WHERE m.channel = ? ORDER BY m.timestamp ASC""",
            (channel,))
        messages = [
            {
                'id': row[0],
                'sender': row[1],
                'message': row[2],
                'is_media': row[3],
                'timestamp': row[4],
                'replied_to': row[5],
                'replies_count': row[6],
                'reactions': get_reactions(row[0])
            }
            for row in c.fetchall()
        ]
        conn.close()
        print(f"Loaded {len(messages)} messages for channel: {channel}")
        return messages
    except Exception as e:
        print(f"Error loading messages for channel {channel}: {str(e)}")
        raise


def add_reaction(message_id, user_uuid, emoji):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("INSERT OR IGNORE INTO reactions (message_id, user_uuid, emoji) VALUES (?, ?, ?)",
                  (message_id, user_uuid, emoji))
        conn.commit()
        print(f"Added reaction {emoji} to message ID {message_id} by user UUID {user_uuid}")
    except Exception as e:
        print(f"Error adding reaction to message ID {message_id}: {str(e)}")
        raise
    finally:
        conn.close()


def remove_reaction(message_id, user_uuid, emoji):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("DELETE FROM reactions WHERE message_id = ? AND user_uuid = ? AND emoji = ?",
                  (message_id, user_uuid, emoji))
        conn.commit()
        print(f"Removed reaction {emoji} from message ID {message_id} by user UUID {user_uuid}")
    except Exception as e:
        print(f"Error removing reaction from message ID {message_id}: {str(e)}")
        raise
    finally:
        conn.close()


def get_reactions(message_id):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("SELECT user_uuid, emoji FROM reactions WHERE message_id = ?", (message_id,))
        reactions = [{'user_uuid': row[0], 'emoji': row[1]} for row in c.fetchall()]
        conn.close()
        print(f"Retrieved {len(reactions)} reactions for message ID {message_id}")
        return reactions
    except Exception as e:
        print(f"Error retrieving reactions for message ID {message_id}: {str(e)}")
        raise


def update_user_settings(uuid, settings):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()

        # Build dynamic query based on provided settings
        updates = []
        values = []

        allowed_fields = [
            'display_name', 'status', 'custom_status', 'theme',
            'compact_mode', 'show_timestamps', 'allow_dms',
            'show_online_status', 'typing_indicators', 'avatar_url'
        ]

        for field, value in settings.items():
            if field in allowed_fields:
                updates.append(f"{field} = ?")
                values.append(value)

        if updates:
            values.append(uuid)  # Add uuid for WHERE clause
            query = f"UPDATE users SET {', '.join(updates)} WHERE uuid = ?"
            c.execute(query, values)
            conn.commit()
            print(f"Updated settings for user UUID: {uuid}")

    except Exception as e:
        print(f"Error updating settings for user UUID {uuid}: {str(e)}")
        raise
    finally:
        conn.close()


def get_user_settings(uuid):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("""SELECT display_name, status, custom_status, theme, compact_mode,
                     show_timestamps, allow_dms, show_online_status, typing_indicators, avatar_url
                     FROM users WHERE uuid = ?""", (uuid,))
        row = c.fetchone()
        if row:
            return {
                'display_name': row[0],
                'status': row[1] or 'online',
                'custom_status': row[2],
                'theme': row[3] or 'darker',
                'compact_mode': bool(row[4]),
                'show_timestamps': bool(row[5]) if row[5] is not None else True,
                'allow_dms': bool(row[6]) if row[6] is not None else True,
                'show_online_status': bool(row[7]) if row[7] is not None else True,
                'typing_indicators': bool(row[8]) if row[8] is not None else True,
                'avatar_url': row[9]
            }
        return None
    except Exception as e:
        print(f"Error retrieving settings for user UUID {uuid}: {str(e)}")
        raise
    finally:
        conn.close()


def create_channel(channel_name):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("INSERT INTO channels (name) VALUES (?)", (channel_name,))
        conn.commit()
        print(f"Created channel: {channel_name}")
        return True
    except sqlite3.IntegrityError:
        print(f"Channel {channel_name} already exists")
        return False
    except Exception as e:
        print(f"Error creating channel {channel_name}: {str(e)}")
        raise
    finally:
        conn.close()


def delete_channel(channel_name):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        # Delete all messages in the channel first
        c.execute("DELETE FROM messages WHERE channel = ?", (channel_name,))
        # Delete the channel
        c.execute("DELETE FROM channels WHERE name = ?", (channel_name,))
        conn.commit()
        print(f"Deleted channel: {channel_name}")
        return True
    except Exception as e:
        print(f"Error deleting channel {channel_name}: {str(e)}")
        raise
    finally:
        conn.close()


def get_standard_timestamp():
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    return timestamp
