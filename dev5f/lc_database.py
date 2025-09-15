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
            print("Messages table exists, checking for missing columns")
            c.execute("PRAGMA table_info(messages)")
            columns = [col[1] for col in c.fetchall()]

            # Check for replied_to column
            if 'replied_to' not in columns:
                print("Adding replied_to column to messages table")
                c.execute("ALTER TABLE messages ADD COLUMN replied_to INTEGER")
                c.execute("UPDATE messages SET replied_to = NULL")
                conn.commit()

            # Check for image_url column
            if 'image_url' not in columns:
                print("Adding image_url column to messages table")
                c.execute("ALTER TABLE messages ADD COLUMN image_url TEXT")
                conn.commit()

            # Check for thumbnail_url column
            if 'thumbnail_url' not in columns:
                print("Adding thumbnail_url column to messages table")
                c.execute("ALTER TABLE messages ADD COLUMN thumbnail_url TEXT")
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
                image_url TEXT,
                thumbnail_url TEXT,
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
            ('animated_bg', 'INTEGER DEFAULT 0'),
            ('cursor_effect', 'TEXT DEFAULT "orbiting"'),
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

        print("Creating folders table if not exists")
        c.execute('''CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            parent_id INTEGER,
            path TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_by TEXT,
            FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        )''')

        print("Creating file_folders table if not exists")
        c.execute('''CREATE TABLE IF NOT EXISTS file_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            folder_id INTEGER,
            filepath TEXT NOT NULL,
            size INTEGER,
            created_at TEXT NOT NULL,
            created_by TEXT,
            thumbnail_url TEXT,
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
        )''')

        # Add thumbnail_url column if it doesn't exist
        c.execute("PRAGMA table_info(file_folders)")
        columns = [col[1] for col in c.fetchall()]
        if 'thumbnail_url' not in columns:
            print("Adding thumbnail_url column to file_folders table")
            c.execute("ALTER TABLE file_folders ADD COLUMN thumbnail_url TEXT")
            conn.commit()

        # Create root folder if it doesn't exist
        c.execute("SELECT id FROM folders WHERE parent_id IS NULL AND name = 'Share'")
        root_folder = c.fetchone()
        if not root_folder:
            print("Creating root 'Share' folder")
            c.execute('''INSERT INTO folders (name, parent_id, path, created_at, created_by)
                        VALUES (?, ?, ?, ?, ?)''',
                     ('Share', None, 'file_share_uploads', datetime.now().strftime('%Y-%m-%d %H:%M:%S'), 'system'))
            root_folder_id = c.lastrowid

            # Create default subfolder
            print("Creating default 'Subfolder' under root")
            c.execute('''INSERT INTO folders (name, parent_id, path, created_at, created_by)
                        VALUES (?, ?, ?, ?, ?)''',
                     ('Subfolder', root_folder_id, 'file_share_uploads/Subfolder', datetime.now().strftime('%Y-%m-%d %H:%M:%S'), 'system'))
        else:
            root_folder_id = root_folder[0]
            # Check if Subfolder exists, create if not
            c.execute("SELECT id FROM folders WHERE parent_id = ? AND name = 'Subfolder'", (root_folder_id,))
            if not c.fetchone():
                print("Creating default 'Subfolder' under root")
                c.execute('''INSERT INTO folders (name, parent_id, path, created_at, created_by)
                            VALUES (?, ?, ?, ?, ?)''',
                         ('Subfolder', root_folder_id, 'file_share_uploads/Subfolder', datetime.now().strftime('%Y-%m-%d %H:%M:%S'), 'system'))

        print("Creating reactions table if not exists")
        c.execute('''CREATE TABLE IF NOT EXISTS reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER,
            user_uuid TEXT,
            emoji TEXT,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
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
        # Migrate avatar URLs from old path to new user_avatars path
        try:
            c.execute("UPDATE users SET avatar_url = REPLACE(avatar_url, '/static/avatars/', '/static/user_avatars/') WHERE avatar_url LIKE '/static/avatars/%'")
            migrated_count = c.rowcount
            if migrated_count > 0:
                print(f"Migrated {migrated_count} user avatar URLs to new user_avatars path")
            conn.commit()
        except Exception as e:
            print(f"Error during avatar URL migration: {str(e)}")

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
                     custom_status, theme, compact_mode, show_timestamps, animated_bg, cursor_effect, allow_dms,
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
                'animated_bg': bool(row[10]) if row[10] is not None else False,
                'cursor_effect': row[11] or 'orbiting',
                'allow_dms': bool(row[12]) if row[12] is not None else True,
                'show_online_status': bool(row[13]) if row[13] is not None else True,
                'typing_indicators': bool(row[14]) if row[14] is not None else True
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
                     custom_status, theme, compact_mode, show_timestamps, animated_bg, cursor_effect, allow_dms,
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
                'animated_bg': bool(row[10]) if row[10] is not None else False,
                'cursor_effect': row[11] or 'orbiting',
                'allow_dms': bool(row[12]) if row[12] is not None else True,
                'show_online_status': bool(row[13]) if row[13] is not None else True,
                'typing_indicators': bool(row[14]) if row[14] is not None else True
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


def load_messages(channel, limit=None):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()

        if limit:
            c.execute(
                """SELECT m.id, m.sender, m.message, m.is_media, m.timestamp, m.replied_to,
                           m.image_url, m.thumbnail_url,
                           (SELECT COUNT(*) FROM messages r WHERE r.replied_to = m.id) as replies_count
                    FROM messages m WHERE m.channel = ? ORDER BY m.timestamp DESC LIMIT ?""",
                (channel, limit))
        else:
            c.execute(
                """SELECT m.id, m.sender, m.message, m.is_media, m.timestamp, m.replied_to,
                           m.image_url, m.thumbnail_url,
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
                'image_url': row[6],
                'thumbnail_url': row[7],
                'replies_count': row[8],
                'reactions': get_reactions(row[0])
            }
            for row in c.fetchall()
        ]

        # Reverse messages when using LIMIT to get most recent first
        if limit:
            messages.reverse()

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
    conn = None
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute("SELECT user_uuid, emoji FROM reactions WHERE message_id = ?", (message_id,))
        reactions = [{'user_uuid': row[0], 'emoji': row[1]} for row in c.fetchall()]
        print(f"Retrieved {len(reactions)} reactions for message ID {message_id}")
        return reactions
    except Exception as e:
        print(f"Error retrieving reactions for message ID {message_id}: {str(e)}")
        raise
    finally:
        if conn:
            conn.close()


def update_user_settings(uuid, settings):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()

        # Build dynamic query based on provided settings
        updates = []
        values = []

        allowed_fields = [
            'display_name', 'status', 'custom_status', 'theme',
            'compact_mode', 'show_timestamps', 'animated_bg', 'cursor_effect', 'allow_dms',
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
                     show_timestamps, animated_bg, cursor_effect, allow_dms, show_online_status, typing_indicators, avatar_url
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
                'animated_bg': bool(row[6]) if row[6] is not None else False,
                'cursor_effect': row[7] or 'orbiting',
                'allow_dms': bool(row[8]) if row[8] is not None else True,
                'show_online_status': bool(row[9]) if row[9] is not None else True,
                'typing_indicators': bool(row[10]) if row[10] is not None else True,
                'avatar_url': row[11]
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

        # Get all message IDs in the channel before deleting them
        c.execute("SELECT id FROM messages WHERE channel = ?", (channel_name,))
        message_ids = [row[0] for row in c.fetchall()]

        # Delete reactions for all messages in the channel
        if message_ids:
            placeholders = ','.join('?' * len(message_ids))
            c.execute(f"DELETE FROM reactions WHERE message_id IN ({placeholders})", message_ids)

        # Delete all messages in the channel
        c.execute("DELETE FROM messages WHERE channel = ?", (channel_name,))

        # Delete the channel
        c.execute("DELETE FROM channels WHERE name = ?", (channel_name,))
        conn.commit()
        print(f"Deleted channel: {channel_name} (including {len(message_ids)} messages and their reactions)")
        return True
    except Exception as e:
        print(f"Error deleting channel {channel_name}: {str(e)}")
        raise
    finally:
        conn.close()


def get_standard_timestamp():
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    return timestamp


# Folder management functions
def create_folder(name, parent_id=None, created_by='system'):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()

        # Build path
        if parent_id is None:
            path = 'file_share_uploads'
        else:
            # Get parent path
            c.execute("SELECT path FROM folders WHERE id = ?", (parent_id,))
            parent_row = c.fetchone()
            if not parent_row:
                raise ValueError("Parent folder not found")
            parent_path = parent_row[0]
            path = f"{parent_path}/{name}"

        timestamp = get_standard_timestamp()
        c.execute('''INSERT INTO folders (name, parent_id, path, created_at, created_by)
                    VALUES (?, ?, ?, ?, ?)''',
                 (name, parent_id, path, timestamp, created_by))

        folder_id = c.lastrowid
        conn.commit()
        print(f"Created folder: {name} (ID: {folder_id})")
        return folder_id
    except Exception as e:
        print(f"Error creating folder {name}: {str(e)}")
        raise
    finally:
        conn.close()


def get_folder_structure():
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute('''SELECT id, name, parent_id, path, created_at, created_by
                    FROM folders ORDER BY parent_id, name''')
        folders = c.fetchall()
        conn.close()

        # Build hierarchical structure
        folder_dict = {}
        root_folders = []

        for folder in folders:
            folder_id, name, parent_id, path, created_at, created_by = folder
            folder_info = {
                'id': folder_id,
                'name': name,
                'parent_id': parent_id,
                'path': path,
                'created_at': created_at,
                'created_by': created_by,
                'children': []
            }
            folder_dict[folder_id] = folder_info

            if parent_id is None:
                root_folders.append(folder_info)
            else:
                if parent_id in folder_dict:
                    folder_dict[parent_id]['children'].append(folder_info)

        print(f"Retrieved {len(folders)} folders")
        return root_folders
    except Exception as e:
        print(f"Error getting folder structure: {str(e)}")
        raise


def get_folder_by_id(folder_id):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()
        c.execute('''SELECT id, name, parent_id, path, created_at, created_by
                    FROM folders WHERE id = ?''', (folder_id,))
        row = c.fetchone()
        conn.close()

        if row:
            return {
                'id': row[0],
                'name': row[1],
                'parent_id': row[2],
                'path': row[3],
                'created_at': row[4],
                'created_by': row[5]
            }
        return None
    except Exception as e:
        print(f"Error getting folder {folder_id}: {str(e)}")
        raise


def get_files_in_folder(folder_id=None):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()

        if folder_id is None:
            # Get files in root folder
            c.execute('''SELECT id, filename, folder_id, filepath, size, created_at, created_by, thumbnail_url
                        FROM file_folders WHERE folder_id IS NULL ORDER BY created_at DESC''')
        else:
            c.execute('''SELECT id, filename, folder_id, filepath, size, created_at, created_by, thumbnail_url
                        FROM file_folders WHERE folder_id = ? ORDER BY created_at DESC''', (folder_id,))

        files = c.fetchall()
        conn.close()

        file_list = []
        for file_row in files:
            file_list.append({
                'id': file_row[0],
                'filename': file_row[1],
                'folder_id': file_row[2],
                'filepath': file_row[3],
                'size': file_row[4],
                'created_at': file_row[5],
                'created_by': file_row[6],
                'thumbnail_url': file_row[7]
            })

        print(f"Retrieved {len(file_list)} files in folder {folder_id}")
        return file_list
    except Exception as e:
        print(f"Error getting files in folder {folder_id}: {str(e)}")
        raise


def add_file_to_folder(filename, filepath, folder_id=None, size=0, created_by='system', thumbnail_url=None):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()

        timestamp = get_standard_timestamp()
        c.execute('''INSERT INTO file_folders (filename, folder_id, filepath, size, created_at, created_by, thumbnail_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?)''',
                 (filename, folder_id, filepath, size, timestamp, created_by, thumbnail_url))

        file_id = c.lastrowid
        conn.commit()
        print(f"Added file to folder: {filename} (ID: {file_id})")
        return file_id
    except Exception as e:
        print(f"Error adding file {filename} to folder: {str(e)}")
        raise
    finally:
        conn.close()


def delete_folder(folder_id):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()

        # Get folder info before deletion
        c.execute("SELECT name, path FROM folders WHERE id = ?", (folder_id,))
        folder_info = c.fetchone()

        if not folder_info:
            raise ValueError("Folder not found")

        # Delete folder (cascade will delete subfolders and files)
        c.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
        conn.commit()

        print(f"Deleted folder: {folder_info[0]} (ID: {folder_id})")
        return True
    except Exception as e:
        print(f"Error deleting folder {folder_id}: {str(e)}")
        raise
    finally:
        conn.close()


def rename_folder(folder_id, new_name):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()

        # Update folder name
        c.execute("UPDATE folders SET name = ? WHERE id = ?", (new_name, folder_id))

        # Update path for this folder and all subfolders
        c.execute("SELECT path FROM folders WHERE id = ?", (folder_id,))
        old_path_row = c.fetchone()
        if old_path_row:
            old_path = old_path_row[0]
            path_parts = old_path.split('/')
            path_parts[-1] = new_name
            new_path = '/'.join(path_parts)

            c.execute("UPDATE folders SET path = ? WHERE id = ?", (new_path, folder_id))

            # Update paths for all subfolders
            old_path_prefix = old_path + '/'
            new_path_prefix = new_path + '/'
            c.execute("UPDATE folders SET path = REPLACE(path, ?, ?) WHERE path LIKE ?",
                     (old_path_prefix, new_path_prefix, old_path_prefix + '%'))

        conn.commit()
        print(f"Renamed folder ID {folder_id} to: {new_name}")
        return True
    except Exception as e:
        print(f"Error renaming folder {folder_id}: {str(e)}")
        raise
    finally:
        conn.close()


def delete_file_from_folder(file_id):
    try:
        conn = sqlite3.connect('devchat.db')
        c = conn.cursor()

        # Get file info before deletion
        c.execute("SELECT filename, filepath FROM file_folders WHERE id = ?", (file_id,))
        file_info = c.fetchone()

        if not file_info:
            raise ValueError("File not found")

        # Delete file from database
        c.execute("DELETE FROM file_folders WHERE id = ?", (file_id,))
        conn.commit()

        # Try to delete the physical file
        try:
            if os.path.exists(file_info[1]):
                os.remove(file_info[1])
                print(f"Deleted physical file: {file_info[1]}")
        except Exception as e:
            print(f"Warning: Could not delete physical file {file_info[1]}: {str(e)}")

        print(f"Deleted file from folder: {file_info[0]} (ID: {file_id})")
        return True
    except Exception as e:
        print(f"Error deleting file {file_id}: {str(e)}")
        raise
    finally:
        conn.close()

# ===== ADVENTURE SYSTEM DATABASE FUNCTIONS =====

def get_adventure_conn():
    """Get connection to adventure database."""
    return sqlite3.connect('adventure.db')

def init_user_city(user_id):
    """Initialize a city for a new user."""
    conn = get_adventure_conn()
    c = conn.cursor()

    try:
        # Create city
        c.execute('INSERT INTO cities (user_id) VALUES (?)', (user_id,))

        city_id = c.lastrowid

        # Create initial resources
        c.execute('INSERT INTO resources (city_id) VALUES (?)', (city_id,))

        # Create initial villager
        c.execute('INSERT INTO villagers (city_id, name) VALUES (?, ?)', (city_id, 'Villager'))

        conn.commit()
        return city_id
    except Exception as e:
        print(f"Error initializing user city: {str(e)}")
        raise
    finally:
        conn.close()

def get_city_data(user_id):
    """Get all city data for a user."""
    conn = get_adventure_conn()
    c = conn.cursor()

    try:
        # Get city info
        c.execute('SELECT * FROM cities WHERE user_id = ?', (user_id,))
        city_row = c.fetchone()

        if not city_row:
            # Initialize city if it doesn't exist
            city_id = init_user_city(user_id)
            # Re-query after initialization since the connection was committed and closed
            c.execute('SELECT * FROM cities WHERE id = ?', (city_id,))
            city_row = c.fetchone()

        city = {
            'id': city_row[0],
            'user_id': city_row[1],
            'name': city_row[2],
            'level': city_row[3],
            'experience': city_row[4],
            'created_at': city_row[5],
            'last_active': city_row[6]
        }

        # Get resources
        c.execute('SELECT * FROM resources WHERE city_id = ?', (city['id'],))
        res_row = c.fetchone()
        city['resources'] = {
            'gold': res_row[2],
            'wood': res_row[3],
            'stone': res_row[4],
            'food': res_row[5]
        }

        # Get villagers
        c.execute('SELECT * FROM villagers WHERE city_id = ?', (city['id'],))
        city['villagers'] = [{
            'id': row[0],
            'name': row[2],
            'task': row[3],
            'efficiency': row[4]
        } for row in c.fetchall()]

        # Get adventurers
        c.execute('SELECT * FROM adventurers WHERE city_id = ?', (city['id'],))
        city['adventurers'] = [{
            'id': row[0],
            'name': row[2],
            'class': row[3],
            'subclass': row[4],
            'level': row[5],
            'experience': row[6],
            'hp': row[7],
            'max_hp': row[8],
            'mp': row[9],
            'max_mp': row[10],
            'strength': row[11],
            'dexterity': row[12],
            'intelligence': row[13],
            'wisdom': row[14],
            'charisma': row[15],
            'constitution': row[16]
        } for row in c.fetchall()]

        # Get guards
        c.execute('SELECT * FROM guards WHERE city_id = ?', (city['id'],))
        city['guards'] = [{
            'id': row[0],
            'level': row[3],  # level is column 3 (0-indexed: id=0, city_id=1, level=2, hp=3, max_hp=4, defense=5, created_at=6)
            'hp': row[4],      # hp is column 4
            'max_hp': row[5],  # max_hp is column 5
            'defense': row[6]  # defense is column 6
        } for row in c.fetchall()]

        return city
    except Exception as e:
        print(f"Error getting city data: {str(e)}")
        raise
    finally:
        conn.close()

def recruit_unit(user_id, unit_type, unit_class=None):
    """Recruit a new unit for the user's city."""
    conn = get_adventure_conn()
    c = conn.cursor()

    try:
        # Get city
        c.execute('SELECT id FROM cities WHERE user_id = ?', (user_id,))
        city_row = c.fetchone()
        if not city_row:
            return {'success': False, 'message': 'City not found'}

        city_id = city_row[0]

        # Get current resources
        c.execute('SELECT gold FROM resources WHERE city_id = ?', (city_id,))
        gold = c.fetchone()[0]

        # Determine cost and validate
        if unit_type == 'villager':
            cost = 10
        elif unit_type == 'guard':
            cost = 25
        elif unit_type == 'adventurer':
            if not unit_class:
                return {'success': False, 'message': 'Adventurer class required'}
            c.execute('SELECT base_cost FROM adventurer_classes WHERE class = ?', (unit_class,))
            cost_row = c.fetchone()
            if not cost_row:
                return {'success': False, 'message': 'Invalid adventurer class'}
            cost = cost_row[0]
        else:
            return {'success': False, 'message': 'Invalid unit type'}

        # Check if enough gold
        if gold < cost:
            return {'success': False, 'message': f'Not enough gold. Need {cost}, have {gold}'}

        # Deduct gold
        c.execute('UPDATE resources SET gold = gold - ? WHERE city_id = ?', (cost, city_id))

        # Create unit
        unit_name = 'Unknown'
        if unit_type == 'villager':
            c.execute('INSERT INTO villagers (city_id, name) VALUES (?, ?)', (city_id, f'Villager {datetime.now().strftime("%H%M%S")}'))
            unit_name = 'Villager'
        elif unit_type == 'guard':
            c.execute('INSERT INTO guards (city_id) VALUES (?)', (city_id,))
            unit_name = 'Guard'
        elif unit_type == 'adventurer':
            # Generate adventurer name
            names = ['Aldric', 'Bryn', 'Ciaran', 'Dara', 'Eamon', 'Fiona', 'Galen', 'Hana', 'Ivor', 'Jara']
            class_title = unit_class.title() if unit_class else 'Unknown'
            name = f'{names[city_id % len(names)]} the {class_title}'

            # Get base stats (simplified)
            base_stats = {
                'hp': 100, 'max_hp': 100, 'mp': 50, 'max_mp': 50,
                'strength': 10, 'dexterity': 10, 'intelligence': 10,
                'wisdom': 10, 'charisma': 10, 'constitution': 10
            }

            c.execute('''INSERT INTO adventurers
                        (city_id, name, class, subclass, hp, max_hp, mp, max_mp,
                         strength, dexterity, intelligence, wisdom, charisma, constitution)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                     (city_id, name, 'adventurer', unit_class,
                      base_stats['hp'], base_stats['max_hp'], base_stats['mp'], base_stats['max_mp'],
                      base_stats['strength'], base_stats['dexterity'], base_stats['intelligence'],
                      base_stats['wisdom'], base_stats['charisma'], base_stats['constitution']))
            unit_name = name

        conn.commit()
        return {'success': True, 'message': f'Successfully recruited {unit_name} for {cost} gold'}

    except Exception as e:
        print(f"Error recruiting unit: {str(e)}")
        return {'success': False, 'message': 'Recruitment failed'}
    finally:
        conn.close()

def assign_villager_task(user_id, villager_id, task):
    """Assign a task to a villager."""
    conn = get_adventure_conn()
    c = conn.cursor()

    try:
        # Verify villager belongs to user
        c.execute('''
            SELECT v.id FROM villagers v
            JOIN cities c ON v.city_id = c.id
            WHERE c.user_id = ? AND v.id = ?
        ''', (user_id, villager_id))

        if not c.fetchone():
            return {'success': False, 'message': 'Villager not found'}

        # Update task
        c.execute('UPDATE villagers SET task = ? WHERE id = ?', (task, villager_id))
        conn.commit()

        return {'success': True, 'message': f'Villager assigned to {task} task'}

    except Exception as e:
        print(f"Error assigning villager task: {str(e)}")
        return {'success': False, 'message': 'Task assignment failed'}
    finally:
        conn.close()

def process_resource_generation():
    """Process resource generation from villagers (called periodically)."""
    conn = get_adventure_conn()
    c = conn.cursor()

    try:
        # Get all villagers with tasks
        c.execute('SELECT city_id, task, COUNT(*) as count FROM villagers WHERE task != "idle" GROUP BY city_id, task')

        updates = {}
        for row in c.fetchall():
            city_id, task, count = row
            if city_id not in updates:
                updates[city_id] = {'wood': 0, 'stone': 0, 'food': 0}

            # Simple resource generation (1 resource per villager per cycle)
            if task == 'wood':
                updates[city_id]['wood'] += count
            elif task == 'stone':
                updates[city_id]['stone'] += count
            elif task == 'food':
                updates[city_id]['food'] += count

        # Apply updates
        for city_id, resources in updates.items():
            c.execute('''
                UPDATE resources
                SET wood = wood + ?, stone = stone + ?, food = food + ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE city_id = ?
            ''', (resources['wood'], resources['stone'], resources['food'], city_id))

        conn.commit()
        return len(updates)

    except Exception as e:
        print(f"Error processing resource generation: {str(e)}")
        return 0
    finally:
        conn.close()