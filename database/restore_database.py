#!/usr/bin/env python3
"""
Database Restore Script for School Admin Portal
Restores a database backup
"""

import os
import shutil
from datetime import datetime
from pathlib import Path

def list_backups(backup_dir):
    """List all available backups"""
    backups = sorted(backup_dir.glob("school_backup_*.db"), 
                    key=lambda x: x.stat().st_mtime, 
                    reverse=True)
    return backups

def restore_backup():
    """Restore a database backup"""
    
    # Get paths
    script_dir = Path(__file__).parent
    db_path = script_dir / "school.db"
    backup_dir = script_dir / "backups"
    
    # Check if backups directory exists
    if not backup_dir.exists():
        print("❌ ERROR: No backups directory found!")
        return False
    
    # List available backups
    backups = list_backups(backup_dir)
    
    if not backups:
        print("❌ ERROR: No backup files found!")
        return False
    
    print("\n" + "="*50)
    print("📋 Available Database Backups:")
    print("="*50)
    
    for idx, backup in enumerate(backups, 1):
        backup_size_kb = round(backup.stat().st_size / 1024, 2)
        modified_time = datetime.fromtimestamp(backup.stat().st_mtime)
        print(f"\n{idx}. {backup.name}")
        print(f"   Size: {backup_size_kb} KB")
        print(f"   Date: {modified_time}")
    
    print("\n" + "="*50)
    
    # Get user selection
    try:
        choice = input("\nEnter backup number to restore (or 'q' to quit): ").strip()
        
        if choice.lower() == 'q':
            print("❌ Restore cancelled.")
            return False
        
        choice_num = int(choice)
        
        if choice_num < 1 or choice_num > len(backups):
            print("❌ Invalid selection!")
            return False
        
        selected_backup = backups[choice_num - 1]
        
        # Confirm restore
        print(f"\n⚠️  WARNING: This will replace the current database with:")
        print(f"   {selected_backup.name}")
        confirm = input("\nType 'YES' to confirm: ").strip()
        
        if confirm != 'YES':
            print("❌ Restore cancelled.")
            return False
        
        # Create backup of current database before restoring
        if db_path.exists():
            current_backup = backup_dir / f"school_before_restore_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.db"
            shutil.copy2(db_path, current_backup)
            print(f"\n✅ Created backup of current database: {current_backup.name}")
        
        # Restore the backup
        shutil.copy2(selected_backup, db_path)
        
        print("\n" + "="*50)
        print("✅ DATABASE RESTORE SUCCESSFUL!")
        print("="*50)
        print(f"📁 Restored from: {selected_backup.name}")
        print(f"📊 Database Size: {round(db_path.stat().st_size / 1024, 2)} KB")
        print("="*50 + "\n")
        
        print("💡 Please restart the backend server for changes to take effect.\n")
        
        return True
        
    except ValueError:
        print("❌ Invalid input! Please enter a number.")
        return False
    except KeyboardInterrupt:
        print("\n❌ Restore cancelled.")
        return False
    except Exception as e:
        print(f"❌ ERROR: Failed to restore backup!")
        print(f"Error details: {e}")
        return False

if __name__ == "__main__":
    restore_backup()
