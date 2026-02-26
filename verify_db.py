import sqlite3
import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import and initialize
import importlib.util
spec = importlib.util.spec_from_file_location("app", "01_app.py")
app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_module)

# Initialize the database
app_module.init_db()

conn = sqlite3.connect('school.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]

print("Database tables created:")
for table in tables:
    print(f"\n✓ {table}")
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    for col in columns:
        print(f"  - {col[1]} ({col[2]})")

conn.close()
print("\n✅ Database initialized successfully!")
