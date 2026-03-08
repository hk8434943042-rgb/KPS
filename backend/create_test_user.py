import sqlite3
import hashlib
import secrets

def hash_password(password):
    """Hash password using SHA256 with salt"""
    salt = secrets.token_hex(32)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}${pwd_hash.hex()}"

conn = sqlite3.connect('../database/school.db')
cursor = conn.cursor()

# Delete existing test user for testing
cursor.execute("DELETE FROM users WHERE username = 'testadmin'")

# Create new test admin user
username = 'testadmin'
email = 'test@school.com'
password = 'test123'
full_name = 'Test Admin'

password_hash = hash_password(password)

cursor.execute(
    "INSERT INTO users (username, email, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 'admin', 1)",
    (username, email, password_hash, full_name)
)
conn.commit()
print(f"✅ Created user: {username} / {password}")
conn.close()
