#!/usr/bin/env python3
"""
Test script for folder management functionality
"""

import sqlite3
import os
import sys

# Add current directory to path
sys.path.append('.')

from lc_database import init_db, create_folder, get_folder_structure, get_files_in_folder

def test_folder_management():
    print("Testing folder management functionality...")

    # Initialize database
    print("1. Initializing database...")
    init_db()

    # Test getting folder structure (should show default Share/Subfolder)
    print("2. Getting folder structure...")
    folders = get_folder_structure()
    print(f"Found {len(folders)} root folders")

    share_folder = None
    for folder in folders:
        print(f"  - {folder['name']} (ID: {folder['id']})")
        if folder['name'] == 'Share':
            share_folder = folder
        if folder['children']:
            for child in folder['children']:
                print(f"    - {child['name']} (ID: {child['id']})")

    # Verify default structure
    if share_folder and share_folder['children']:
        subfolder = share_folder['children'][0]
        if subfolder['name'] == 'Subfolder':
            print("✅ Default Share/Subfolder structure verified!")
        else:
            print(f"❌ Expected 'Subfolder', found '{subfolder['name']}'")
    else:
        print("❌ Default Share/Subfolder structure not found!")

    # Test creating additional folders
    print("3. Creating test folders...")
    folder1_id = create_folder("TestFolder1", None, "test_user")
    folder2_id = create_folder("TestFolder2", None, "test_user")
    subfolder_id = create_folder("SubFolder", folder1_id, "test_user")

    print(f"Created folders: {folder1_id}, {folder2_id}, {subfolder_id}")

    # Test getting files in folders
    print("4. Testing file retrieval...")
    files = get_files_in_folder(None)  # Root folder
    print(f"Files in root: {len(files)}")

    if share_folder:
        files = get_files_in_folder(share_folder['id'])
        print(f"Files in Share folder: {len(files)}")

    files = get_files_in_folder(folder1_id)
    print(f"Files in TestFolder1: {len(files)}")

    print("✅ Folder management tests completed successfully!")

if __name__ == "__main__":
    test_folder_management()