#!/usr/bin/env python3
"""Clear all data from database without confirmation"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'school.db')

if not os.path.exists(db_path):
    print(f"❌ Database not found: {db_path}")
    exit(1)

print(f"📂 Database: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get counts
    cursor.execute("SELECT COUNT(*) FROM students")
    students = cursor.fetchone()[0]
    
    print(f"\n📊 Current data: {students} students")
    
    # Delete all students
    print("🗑️  Clearing all students...")
    cursor.execute("DELETE FROM students")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='students'")
    
    conn.commit()
    conn.close()
    
    print("✅ Database cleared! Ready for real data.")
    
except Exception as e:
    print(f"❌ Error: {e}")
