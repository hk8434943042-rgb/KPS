#!/usr/bin/env python3
"""
Clear all data from the database - removes all students, fees, and receipts.
Use this to start fresh with real data.
"""
import sqlite3
import os

# Get database path
db_path = os.path.join(os.path.dirname(__file__), 'school.db')

def clear_database():
    """Clear all data from all tables"""
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return
    
    print(f"📂 Database: {db_path}")
    print("\n⚠️  Clearing all demo data from database...")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get row counts before deletion
        cursor.execute("SELECT COUNT(*) FROM students")
        student_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM fees")
        fee_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM receipts")
        receipt_count = cursor.fetchone()[0]
        
        print(f"\n📊 Current data:")
        print(f"   Students: {student_count}")
        print(f"   Fee records: {fee_count}")
        print(f"   Receipts: {receipt_count}")
        
        # Delete all data
        print("\n🗑️  Deleting all data...")
        cursor.execute("DELETE FROM students")
        cursor.execute("DELETE FROM fees")
        cursor.execute("DELETE FROM receipts")
        
        # Reset auto-increment counters
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='students'")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='fees'")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='receipts'")
        
        conn.commit()
        
        print("✅ All data cleared successfully!")
        print("\n📝 Database is now empty and ready for real data.")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error clearing database: {e}")

if __name__ == '__main__':
    clear_database()
