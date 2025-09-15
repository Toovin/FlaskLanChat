import sqlite3
conn = sqlite3.connect('devchat.db')
c = conn.cursor()
c.execute("SELECT id, message, is_media, image_url, thumbnail_url FROM messages WHERE message LIKE '%Chicken%' ORDER BY id DESC LIMIT 1")
print(c.fetchone())  # Should show (ID, 'Chicken image captured!', 1, '/static/uploads/chicken_YYYYMMDD_HHMMSS.jpg', '/static/uploads/chicken_YYYYMMDD_HHMMSS.jpg')
conn.close()