#!/usr/bin/env python3
"""
Initialize the adventure database for the city management system.
"""

import sqlite3
import os

def init_adventure_db():
    """Initialize the adventure database with required tables."""

    db_path = 'adventure.db'

    # Remove existing database if it exists (for development)
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create cities table
    cursor.execute('''
        CREATE TABLE cities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            name TEXT DEFAULT 'My City',
            level INTEGER DEFAULT 1,
            experience INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create resources table
    cursor.execute('''
        CREATE TABLE resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER NOT NULL,
            gold INTEGER DEFAULT 100,
            wood INTEGER DEFAULT 50,
            stone INTEGER DEFAULT 50,
            food INTEGER DEFAULT 50,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
        )
    ''')

    # Create villagers table
    cursor.execute('''
        CREATE TABLE villagers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER NOT NULL,
            name TEXT,
            task TEXT DEFAULT 'idle',
            efficiency REAL DEFAULT 1.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
        )
    ''')

    # Create adventurers table
    cursor.execute('''
        CREATE TABLE adventurers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            class TEXT NOT NULL,
            subclass TEXT NOT NULL,
            level INTEGER DEFAULT 1,
            experience INTEGER DEFAULT 0,
            hp INTEGER DEFAULT 100,
            max_hp INTEGER DEFAULT 100,
            mp INTEGER DEFAULT 50,
            max_mp INTEGER DEFAULT 50,
            strength INTEGER DEFAULT 10,
            dexterity INTEGER DEFAULT 10,
            intelligence INTEGER DEFAULT 10,
            wisdom INTEGER DEFAULT 10,
            charisma INTEGER DEFAULT 10,
            constitution INTEGER DEFAULT 10,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
        )
    ''')

    # Create guards table
    cursor.execute('''
        CREATE TABLE guards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER NOT NULL,
            level INTEGER DEFAULT 1,
            hp INTEGER DEFAULT 80,
            max_hp INTEGER DEFAULT 80,
            defense INTEGER DEFAULT 5,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
        )
    ''')

    # Create adventurer classes reference table
    cursor.execute('''
        CREATE TABLE adventurer_classes (
            class TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            base_cost INTEGER NOT NULL,
            description TEXT
        )
    ''')

    # Insert adventurer class data
    adventurer_classes = [
        # Melee
        ('stealth', 'melee', 50, 'Silent assassin specializing in surprise attacks'),
        ('finesse', 'melee', 50, 'Precise fighter with exceptional accuracy'),
        ('brute', 'melee', 50, 'Powerful warrior dealing massive damage'),

        # Healer
        ('cleric', 'healer', 60, 'Divine spellcaster devoted to healing and protection'),
        ('spirit', 'healer', 60, 'Shaman-like healer connecting with spiritual forces'),
        ('nature', 'healer', 60, 'Druidic healer drawing power from nature'),

        # Caster
        ('arcane', 'caster', 70, 'Master of destructive magical energy'),
        ('summoner', 'caster', 70, 'Conjurer of elemental and undead minions'),
        ('enchanter', 'caster', 70, 'Utility mage specializing in control and enhancement'),

        # Hybrid
        ('bard', 'hybrid', 80, 'Charismatic performer blending magic and inspiration'),
        ('knight', 'hybrid', 80, 'Holy or unholy warrior combining melee and divine power'),
        ('tamer', 'hybrid', 80, 'Beast master bonding with wildlife for combat and utility')
    ]

    cursor.executemany('INSERT INTO adventurer_classes VALUES (?, ?, ?, ?)', adventurer_classes)

    # Create indexes for better performance
    cursor.execute('CREATE INDEX idx_cities_user_id ON cities(user_id)')
    cursor.execute('CREATE INDEX idx_resources_city_id ON resources(city_id)')
    cursor.execute('CREATE INDEX idx_villagers_city_id ON villagers(city_id)')
    cursor.execute('CREATE INDEX idx_adventurers_city_id ON adventurers(city_id)')
    cursor.execute('CREATE INDEX idx_guards_city_id ON guards(city_id)')

    conn.commit()
    conn.close()

    print("Adventure database initialized successfully!")

if __name__ == '__main__':
    init_adventure_db()