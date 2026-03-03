#!/usr/bin/env python3
"""Direct test of database insertion"""
import sqlite3
import json
import os

db_path = "database/school.db"

data = {
    "roll_no": "1122",
    "name": "Mohit Kumar",
    "admission_date": "01-04-2025",
    "aadhar_number": "334721374969",
    "father_name": "Jitendra kumar sinha",
    "mother_name": "Reena Sinha",
    "class_name": "VII",
    "section": "A",
    "phone": "9801598020",
    "status": "Active",
    "date_of_birth": "12-08-2013"
}

print(f"Testing database insertion...")
print(f"Database: {db_path}")
print(f"Payload: {json.dumps(data, indent=2)}\n")

try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Mimic the insertion
    cursor.execute(
        """INSERT INTO students (
               roll_no, name, email, phone, class_name, section,
               date_of_birth, address, parent_name, parent_phone,
               aadhar_number, admission_date, father_name, mother_name, status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (data.get('roll_no'), data.get('name'), data.get('email'), data.get('phone'),
         data.get('class_name'), data.get('section'), data.get('date_of_birth'),
         data.get('address'), data.get('parent_name'), data.get('parent_phone'),
         data.get('aadhar_number'), data.get('admission_date'), data.get('father_name'),
         data.get('mother_name'), data.get('status') or 'Active'))
    
    conn.commit()
    print("SUCCESS: Student inserted into database")
    
    # Retrieve it
    student_id = cursor.execute("SELECT last_insert_rowid()").fetchone()[0]
    row = cursor.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
    
    if row:
        result = {key: row[key] for key in row.keys()}
        print(f"Retrieved: {json.dumps(result, indent=2)}")
    else:
        print("ERROR: Could not retrieve inserted student")
    
    conn.close()
    
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
