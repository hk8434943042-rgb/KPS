import sqlite3
import os

db_path = 'database/school.db'
print(f"Checking: {os.path.abspath(db_path)}")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [t[0] for t in c.fetchall()]
    print(f"✅ Database found with {len(tables)} tables:")
    for t in tables:
        c.execute(f"SELECT COUNT(*) FROM {t}")
        count = c.fetchone()[0]
        print(f"   - {t}: {count} records")
    conn.close()
else:
    print(f"❌ Database not found at {db_path}")
