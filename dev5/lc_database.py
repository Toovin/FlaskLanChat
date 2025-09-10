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
            avatar_url TEXT
        )''')

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

        print("Creating polls table if not exists")
        c.execute('''CREATE TABLE IF NOT EXISTS polls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL,
            creator_uuid TEXT NOT NULL,
            question TEXT NOT NULL,
            options TEXT NOT NULL, -- JSON array of options
            created_at TEXT NOT NULL,
            expires_at TEXT,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (creator_uuid) REFERENCES users(uuid)
        )''')

        print("Creating poll_votes table if not exists")
        c.execute('''CREATE TABLE IF NOT EXISTS poll_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            poll_id INTEGER NOT NULL,
            user_uuid TEXT NOT NULL,
            option_index INTEGER NOT NULL,
            voted_at TEXT NOT NULL,
            FOREIGN KEY (poll_id) REFERENCES polls(id),
            FOREIGN KEY (user_uuid) REFERENCES users(uuid),
            UNIQUE(poll_id, user_uuid)
        )''')

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
        c.execute("SELECT uuid, username, password_hash, avatar_url FROM users")
        for row in c.fetchall():
            users_db[row[0]] = {
                'username': row[1],
                'password_hash': row[2],
                'avatar_url': row[3]
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
        c.execute("SELECT uuid, username, password_hash, avatar_url FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        conn.close()
        if row:
            print(f"Retrieved user: {username}")
            return {
                'uuid': row[0],
                'username': row[1],
                'password_hash': row[2],
                'avatar_url': row[3]
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
            "SELECT id, sender, message, is_media, timestamp, replied_to FROM messages WHERE channel = ? ORDER BY timestamp ASC",
            (channel,))
        messages = [
            {
                'id': row[0],
                'sender': row[1],
                'message': row[2],
                'is_media': row[3],
                'timestamp': row[4],
                'replied_to': row[5],
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


def get_standard_timestamp():
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    return timestamp


def create_poll(channel, creator_uuid, question, options, expires_at=None):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        import json
        options_json = json.dumps(options)
        created_at = get_standard_timestamp()
        c.execute("INSERT INTO polls (channel, creator_uuid, question, options, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                  (channel, creator_uuid, question, options_json, created_at, expires_at))
        poll_id = c.lastrowid
        conn.commit()
        print(f"Created poll ID {poll_id} in channel {channel}")
        return poll_id
    except Exception as e:
        print(f"Error creating poll: {str(e)}")
        raise
    finally:
        conn.close()


def get_poll(poll_id):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("SELECT id, channel, creator_uuid, question, options, created_at, expires_at, is_active FROM polls WHERE id = ?", (poll_id,))
        row = c.fetchone()
        if not row:
            return None
        import json
        poll = {
            'id': row[0],
            'channel': row[1],
            'creator_uuid': row[2],
            'question': row[3],
            'options': json.loads(row[4]),
            'created_at': row[5],
            'expires_at': row[6],
            'is_active': row[7],
            'votes': get_poll_votes(poll_id)
        }
        return poll
    except Exception as e:
        print(f"Error retrieving poll {poll_id}: {str(e)}")
        raise
    finally:
        conn.close()


def get_channel_polls(channel):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("SELECT id, channel, creator_uuid, question, options, created_at, expires_at, is_active FROM polls WHERE channel = ? AND is_active = 1 ORDER BY created_at DESC", (channel,))
        polls = []
        import json
        for row in c.fetchall():
            poll = {
                'id': row[0],
                'channel': row[1],
                'creator_uuid': row[2],
                'question': row[3],
                'options': json.loads(row[4]),
                'created_at': row[5],
                'expires_at': row[6],
                'is_active': row[7],
                'votes': get_poll_votes(row[0])
            }
            polls.append(poll)
        return polls
    except Exception as e:
        print(f"Error retrieving polls for channel {channel}: {str(e)}")
        raise
    finally:
        conn.close()


def vote_on_poll(poll_id, user_uuid, option_index):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        voted_at = get_standard_timestamp()
        c.execute("INSERT OR REPLACE INTO poll_votes (poll_id, user_uuid, option_index, voted_at) VALUES (?, ?, ?, ?)",
                  (poll_id, user_uuid, option_index, voted_at))
        conn.commit()
        print(f"User {user_uuid} voted on poll {poll_id}, option {option_index}")
        return True
    except Exception as e:
        print(f"Error voting on poll {poll_id}: {str(e)}")
        raise
    finally:
        conn.close()


def get_poll_votes(poll_id):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("SELECT user_uuid, option_index FROM poll_votes WHERE poll_id = ?", (poll_id,))
        votes = [{'user_uuid': row[0], 'option_index': row[1]} for row in c.fetchall()]
        return votes
    except Exception as e:
        print(f"Error retrieving votes for poll {poll_id}: {str(e)}")
        raise
    finally:
        conn.close()


def close_poll(poll_id):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("UPDATE polls SET is_active = 0 WHERE id = ?", (poll_id,))
        conn.commit()
        print(f"Closed poll {poll_id}")
        return True
    except Exception as e:
        print(f"Error closing poll {poll_id}: {str(e)}")
        raise
    finally:
        conn.close()