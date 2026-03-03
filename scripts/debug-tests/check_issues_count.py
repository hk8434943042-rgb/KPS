import sqlite3
import json

DB_PATH = r"c:/Users/Himanshu kumar/OneDrive/Desktop/school-admin-portal/database/school.db"

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
rows = conn.execute(
    """
    SELECT
      p.id,
      p.payment_date,
      p.status,
      p.amount,
      p.payment_method,
      p.transaction_id,
      s.roll_no,
      s.name
    FROM payments p
    LEFT JOIN students s ON p.student_id = s.id
    WHERE lower(coalesce(p.status, '')) IN ('pending', 'failed')
    ORDER BY p.payment_date DESC, p.id DESC
    """
).fetchall()

print("ISSUE_COUNT=", len(rows))
print(json.dumps([dict(r) for r in rows], indent=2))

conn.close()
