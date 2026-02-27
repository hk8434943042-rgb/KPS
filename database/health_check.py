#!/usr/bin/env python3
"""
Database Health Check and Maintenance Script
Checks database integrity, optimizes, and provides statistics
"""
import sqlite3
import os
from datetime import datetime

db_path = os.path.join(os.path.dirname(__file__), 'school.db')

def check_database_health():
    """Perform comprehensive database health check"""
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return False
    
    print(f"📂 Database: {db_path}")
    print(f"📊 Size: {os.path.getsize(db_path) / 1024:.2f} KB\n")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 1. Integrity Check
        print("🔍 Running integrity check...")
        cursor.execute("PRAGMA integrity_check")
        integrity = cursor.fetchone()[0]
        if integrity == "ok":
            print("✅ Database integrity: OK\n")
        else:
            print(f"⚠️ Database integrity issues: {integrity}\n")
        
        # 2. Get table statistics
        print("📈 Table Statistics:")
        print("-" * 60)
        
        tables = ['students', 'teachers', 'attendance', 'payments']
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"  {table:15s} : {count:6d} records")
            except sqlite3.OperationalError:
                print(f"  {table:15s} : Table not found")
        
        print()
        
        # 3. Index information
        print("🔑 Indexes:")
        print("-" * 60)
        cursor.execute("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
        indexes = cursor.fetchall()
        if indexes:
            for idx_name, tbl_name in indexes:
                print(f"  {idx_name:30s} on {tbl_name}")
        else:
            print("  No custom indexes found")
        print()
        
        # 4. Recent activity (if students exist)
        cursor.execute("SELECT COUNT(*) FROM students")
        if cursor.fetchone()[0] > 0:
            print("📅 Recent Activity:")
            print("-" * 60)
            cursor.execute("SELECT COUNT(*) FROM students WHERE date(created_at) = date('now')")
            today_count = cursor.fetchone()[0]
            print(f"  Students added today: {today_count}")
            
            cursor.execute("SELECT COUNT(*) FROM students WHERE date(updated_at) = date('now') AND date(created_at) < date('now')")
            updated_count = cursor.fetchone()[0]
            print(f"  Students updated today: {updated_count}")
            print()
        
        # 5. Optimize database
        print("🔧 Optimizing database...")
        cursor.execute("VACUUM")
        cursor.execute("ANALYZE")
        conn.commit()
        print("✅ Database optimized\n")
        
        conn.close()
        
        print("✅ Database health check completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error during health check: {e}")
        return False

if __name__ == '__main__':
    print(f"\n{'='*60}")
    print(f"  SCHOOL ADMIN DATABASE HEALTH CHECK")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    check_database_health()
