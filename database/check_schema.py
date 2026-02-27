import sqlite3

conn = sqlite3.connect('school.db')
cursor = conn.cursor()

# Get table schema
cursor.execute('PRAGMA table_info(students)')
cols = cursor.fetchall()

#print('Columns in students table:')
for col in cols:
    print(f'  {col[1]:20s} {col[2]:10s} NULL={col[3]==0}  DEFAULT={col[4]}')

conn.close()
