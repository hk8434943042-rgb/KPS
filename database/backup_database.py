#!/usr/bin/env python3
"""
Database Backup Script for School Admin Portal
Creates timestamped backups of the SQLite database
"""

import os
import shutil
from datetime import datetime
from pathlib import Path

def create_backup():
    """Create a timestamped backup of the database"""
    
    # Get paths
    script_dir = Path(__file__).parent
    db_path = script_dir / "school.db"
    backup_dir = script_dir / "backups"
    
    # Create backups directory if it doesn't exist
    if not backup_dir.exists():
        backup_dir.mkdir(parents=True)
        print(f"✅ Created backups directory: {backup_dir}")
    
    # Check if database exists
    if not db_path.exists():
        print(f"❌ ERROR: Database file not found at: {db_path}")
        return False
    
    # Create backup filename with timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_filename = f"school_backup_{timestamp}.db"
    backup_path = backup_dir / backup_filename
    
    # Copy database file
    try:
        shutil.copy2(db_path, backup_path)
        file_size = backup_path.stat().st_size
        file_size_kb = round(file_size / 1024, 2)
        
        print("\n" + "="*50)
        print("✅ DATABASE BACKUP SUCCESSFUL!")
        print("="*50)
        print(f"📁 Backup Location: {backup_path}")
        print(f"📊 Backup Size: {file_size_kb} KB")
        print(f"⏰ Timestamp: {timestamp}")
        print("="*50 + "\n")
        
        # List all backups
        all_backups = sorted(backup_dir.glob("school_backup_*.db"), 
                           key=lambda x: x.stat().st_mtime, 
                           reverse=True)
        
        print(f"📋 All Database Backups ({len(all_backups)} total):")
        print("-" * 50)
        
        for backup in all_backups:
            backup_size_kb = round(backup.stat().st_size / 1024, 2)
            modified_time = datetime.fromtimestamp(backup.stat().st_mtime)
            print(f"  • {backup.name}")
            print(f"    Size: {backup_size_kb} KB | Date: {modified_time}")
        
        print("\n💡 To restore a backup, copy the backup file over school.db\n")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: Failed to create backup!")
        print(f"Error details: {e}")
        return False

if __name__ == "__main__":
    create_backup()
