import os
from flask import Flask, request, jsonify, session
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime, timedelta
import hashlib
import secrets

app = Flask(__name__)
# Allow CORS from all origins in development (more permissive than production)
CORS(app,
    resources={r"/api/*": {"origins": "*"}, r"/health": {"origins": "*"}},
    supports_credentials=True,
    allow_headers=['Content-Type', 'Authorization', 'X-Requested-With', 'Access-Control-Allow-Origin'],
    methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
app.secret_key = os.environ.get('SECRET_KEY', 'school-admin-portal-secret-key-change-in-production')

# Use DATABASE_URL from environment (for Railway), fallback to local
# Get the database path, resolving relative paths correctly
_raw_db_path = os.environ.get("DATABASE_URL", "").replace("sqlite:///", "") or "database/school.db"
if not os.path.isabs(_raw_db_path) and not _raw_db_path.startswith("sqlite"):
    # Relative path - resolve from parent directory of this script
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), _raw_db_path)
else:
    DB_PATH = _raw_db_path

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@app.after_request
def add_cors_headers(response):
    # Be explicit about CORS headers to satisfy browser preflight checks
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With,Access-Control-Allow-Origin'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

def init_db():
    conn = get_db()
    
    # Users/Authentication table
    conn.execute(
        """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        role TEXT DEFAULT 'admin' CHECK(role IN ('admin', 'teacher', 'accountant')),
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """
    )
    
    conn.execute(
        """
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        class_name TEXT,
        section TEXT,
        date_of_birth TEXT,
        address TEXT,
        parent_name TEXT,
        parent_phone TEXT,
        -- new fields added later via ALTER if needed
        aadhar_number TEXT,
        admission_date TEXT,
        father_name TEXT,
        mother_name TEXT,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """
    )
    conn.execute(
        """
    CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emp_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        subject TEXT,
        qualification TEXT,
        date_of_joining TEXT,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """
    )
    conn.execute(
        """
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        attendance_date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Leave')),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id),
        UNIQUE(student_id, attendance_date)
    )
    """
    )
    conn.execute(
        """
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT,
        transaction_id TEXT,
        purpose TEXT,
        status TEXT DEFAULT 'Completed' CHECK(status IN ('Pending', 'Completed', 'Failed')),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id)
    )
    """
    )
    # ensure additional columns exist (safe to run even if they already do)
    cursor = conn.execute("PRAGMA table_info(students)")
    existing = {row['name'] for row in cursor.fetchall()}
    extras = {
        'aadhar_number': "ALTER TABLE students ADD COLUMN aadhar_number TEXT",
        'admission_date': "ALTER TABLE students ADD COLUMN admission_date TEXT",
        'father_name': "ALTER TABLE students ADD COLUMN father_name TEXT",
        'mother_name': "ALTER TABLE students ADD COLUMN mother_name TEXT",
        'status': "ALTER TABLE students ADD COLUMN status TEXT DEFAULT 'Active'",
        'parent_id': "ALTER TABLE students ADD COLUMN parent_id INTEGER"
    }
    # Create parents table to support multi-child -> one-parent relationships
    conn.execute(
        """
    CREATE TABLE IF NOT EXISTS parents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        relation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """
    )
    for col, stmt in extras.items():
        if col not in existing:
            try:
                conn.execute(stmt)
            except Exception:
                pass
    conn.commit()
    conn.close()

# ===========================
# AUTHENTICATION HELPERS
# ===========================

def hash_password(password):
    """Hash password using SHA256 with salt"""
    salt = secrets.token_hex(32)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}${pwd_hash.hex()}"

def verify_password(password, password_hash):
    """Verify password against hash"""
    try:
        salt, pwd_hash = password_hash.split('$')
        new_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return new_hash.hex() == pwd_hash
    except:
        return False

def get_current_user():
    """Get the current authenticated user from session"""
    user_id = session.get('user_id')
    if not user_id:
        return None
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ? AND is_active = 1", (user_id,)).fetchone()
    conn.close()
    return dict(user) if user else None

# ===========================
# AUTHENTICATION ENDPOINTS
# ===========================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.json
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        full_name = data.get('full_name', '').strip()
        
        if not all([username, email, password]):
            return jsonify({'error': 'Username, email, and password are required'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        conn = get_db()
        
        # Check if user exists
        existing = conn.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email)).fetchone()
        if existing:
            conn.close()
            return jsonify({'error': 'Username or email already exists'}), 400
        
        password_hash = hash_password(password)
        
        conn.execute(
            """INSERT INTO users (username, email, password_hash, full_name, role, is_active)
               VALUES (?, ?, ?, ?, 'admin', 1)""",
            (username, email, password_hash, full_name)
        )
        conn.commit()
        user_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user_id': user_id
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user with username/email and password"""
    try:
        data = request.json
        username_or_email = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username_or_email or not password:
            return jsonify({'error': 'Username/email and password are required'}), 400
        
        conn = get_db()
        user = conn.execute(
            "SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1",
            (username_or_email, username_or_email)
        ).fetchone()
        conn.close()
        
        if not user or not verify_password(password, user['password_hash']):
            return jsonify({'error': 'Invalid username/email or password'}), 401
        
        # Create session
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['full_name'] = user['full_name']
        session['role'] = user['role']
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'full_name': user['full_name'],
                'role': user['role']
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logout user"""
    try:
        session.clear()
        return jsonify({'success': True, 'message': 'Logged out successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/auth/me', methods=['GET'])
def get_current_user_info():
    """Get current logged-in user info"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Not authenticated'}), 401
        
        # Remove password hash from response
        user.pop('password_hash', None)
        return jsonify(user), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/auth/verify', methods=['GET'])
def verify_auth():
    """Verify if user is authenticated"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'authenticated': False}), 401
        
        user.pop('password_hash', None)
        return jsonify({'authenticated': True, 'user': user}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===========================
# STUDENTS ENDPOINTS
# ===========================

@app.route('/api/students', methods=['POST'])

# helper to convert a user-supplied date into ISO (YYYY-MM-DD).  Accepts
# either the correct ISO form or common `DD-MM-YYYY` used in India, as well
# as a value that's already None/empty.
def _normalize_date(val):
    if not val:
        return None
    # strip whitespace
    val = val.strip()
    # if dj format
    parts = val.split('-')
    if len(parts) == 3:
        d0, d1, d2 = parts
        # if first part is day and last is year
        if len(d0) == 2 and len(d2) == 4:
            try:
                day = int(d0); mon = int(d1); yr = int(d2)
                return f"{yr:04d}-{mon:02d}-{day:02d}"
            except Exception:
                pass
    # otherwise leave as‑is (might already be yyyy-mm-dd)
    return val

@app.route('/api/students', methods=['POST'])
def create_student():
    try:
        data = request.json or {}
        # normalize admission_date before inserting
        data['admission_date'] = _normalize_date(data.get('admission_date'))
        conn = get_db()
        conn.execute(
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
        student_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        row = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/students', methods=['GET'])
def get_students():
    try:
        conn = get_db()
        rows = conn.execute("SELECT * FROM students ORDER BY roll_no").fetchall()
        students = []
        for row in rows:
            stu = dict(row)
            # make sure the date is returned in ISO form so the <input type=date>
            # control can render it.  normalize any old DD-MM-YYYY records.
            stu['admission_date'] = _normalize_date(stu.get('admission_date'))
            students.append(stu)
        conn.close()
        return jsonify(students)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/students/<int:student_id>', methods=['GET'])
def get_student(student_id):
    try:
        conn = get_db()
        row = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        conn.close()
        if not row:
            return jsonify({'error': 'Student not found'}), 404
        stu = dict(row)
        stu['admission_date'] = _normalize_date(stu.get('admission_date'))
        return jsonify(stu)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    try:
        data = request.json or {}
        # normalize incoming date
        data['admission_date'] = _normalize_date(data.get('admission_date'))
        conn = get_db()
        conn.execute(
            """UPDATE students SET
                   roll_no = ?, name = ?, email = ?, phone = ?, class_name = ?,
                   section = ?, date_of_birth = ?, address = ?, parent_name = ?,
                   parent_phone = ?, aadhar_number = ?, admission_date = ?,
                   father_name = ?, mother_name = ?, status = ?,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (data.get('roll_no'), data.get('name'), data.get('email'),
             data.get('phone'), data.get('class_name'), data.get('section'),
             data.get('date_of_birth'), data.get('address'), data.get('parent_name'),
             data.get('parent_phone'), data.get('aadhar_number'), data.get('admission_date'),
             data.get('father_name'), data.get('mother_name'), data.get('status') or 'Active', student_id))
        conn.commit()
        row = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        conn.close()
        if not row:
            return jsonify({'error': 'Student not found'}), 404
        stu = dict(row)
        stu['admission_date'] = _normalize_date(stu.get('admission_date'))
        return jsonify(stu)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    try:
        conn = get_db()
        conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/students/by-roll/<roll_no>', methods=['DELETE','OPTIONS'])
def delete_student_by_roll(roll_no):
    # Flask-CORS sometimes requires explicit OPTIONS handler for wildcard routes
    if request.method == 'OPTIONS':
        # Preflight request; just return success headers
        return jsonify({'success': True})
    try:
        conn = get_db()
        conn.execute("DELETE FROM students WHERE roll_no = ?", (roll_no,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===========================
# PARENTS ENDPOINTS (multi-child -> one-parent)
# ===========================

@app.route('/api/parents', methods=['POST'])
def create_parent():
    try:
        data = request.json or {}
        conn = get_db()
        conn.execute(
            """INSERT INTO parents (name, email, phone, address, relation) VALUES (?, ?, ?, ?, ?)""",
            (data.get('name'), data.get('email'), data.get('phone'), data.get('address'), data.get('relation'))
        )
        conn.commit()
        parent_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        row = conn.execute("SELECT * FROM parents WHERE id = ?", (parent_id,)).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/parents', methods=['GET'])
def get_parents():
    try:
        conn = get_db()
        rows = conn.execute("SELECT * FROM parents ORDER BY name").fetchall()
        parents = [dict(row) for row in rows]
        conn.close()
        return jsonify(parents)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/parents/<int:parent_id>', methods=['GET'])
def get_parent(parent_id):
    try:
        conn = get_db()
        parent = conn.execute("SELECT * FROM parents WHERE id = ?", (parent_id,)).fetchone()
        if not parent:
            conn.close()
            return jsonify({'error': 'Parent not found'}), 404
        children = conn.execute("SELECT * FROM students WHERE parent_id = ? ORDER BY roll_no", (parent_id,)).fetchall()
        parent_obj = dict(parent)
        parent_obj['children'] = [dict(c) for c in children]
        conn.close()
        return jsonify(parent_obj)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/parents/<int:parent_id>', methods=['PUT'])
def update_parent(parent_id):
    try:
        data = request.json or {}
        conn = get_db()
        conn.execute(
            """UPDATE parents SET name = ?, email = ?, phone = ?, address = ?, relation = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
            (data.get('name'), data.get('email'), data.get('phone'), data.get('address'), data.get('relation'), parent_id)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM parents WHERE id = ?", (parent_id,)).fetchone()
        conn.close()
        if not row:
            return jsonify({'error': 'Parent not found'}), 404
        return jsonify(dict(row))
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/parents/<int:parent_id>', methods=['DELETE'])
def delete_parent(parent_id):
    try:
        conn = get_db()
        # detach children
        conn.execute("UPDATE students SET parent_id = NULL WHERE parent_id = ?", (parent_id,))
        conn.execute("DELETE FROM parents WHERE id = ?", (parent_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/parents/<int:parent_id>/students', methods=['POST'])
def attach_student_to_parent(parent_id):
    try:
        data = request.json or {}
        student_id = data.get('student_id')
        if not student_id:
            return jsonify({'error': 'student_id is required'}), 400
        conn = get_db()
        # ensure parent exists
        parent = conn.execute("SELECT id FROM parents WHERE id = ?", (parent_id,)).fetchone()
        if not parent:
            conn.close()
            return jsonify({'error': 'Parent not found'}), 404
        # ensure student exists
        student = conn.execute("SELECT id FROM students WHERE id = ?", (student_id,)).fetchone()
        if not student:
            conn.close()
            return jsonify({'error': 'Student not found'}), 404
        conn.execute("UPDATE students SET parent_id = ? WHERE id = ?", (parent_id, student_id))
        conn.commit()
        row = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        conn.close()
        return jsonify(dict(row))
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/parents/<int:parent_id>/students/<int:student_id>', methods=['DELETE'])
def detach_student_from_parent(parent_id, student_id):
    try:
        conn = get_db()
        conn.execute("UPDATE students SET parent_id = NULL WHERE id = ? AND parent_id = ?", (student_id, parent_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===========================
# TEACHERS ENDPOINTS
# ===========================

@app.route('/api/teachers', methods=['POST'])
def create_teacher():
    try:
        data = request.json
        conn = get_db()
        conn.execute(
            """INSERT INTO teachers (emp_id, name, email, phone, subject, qualification, 
               date_of_joining, address) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.get('emp_id'), data.get('name'), data.get('email'), data.get('phone'),
             data.get('subject'), data.get('qualification'), data.get('date_of_joining'),
             data.get('address'))
        )
        conn.commit()
        teacher_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()
        data['id'] = teacher_id
        return jsonify(data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/teachers', methods=['GET'])
def get_teachers():
    try:
        conn = get_db()
        rows = conn.execute("SELECT * FROM teachers ORDER BY emp_id").fetchall()
        teachers = [dict(row) for row in rows]
        conn.close()
        return jsonify(teachers)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/teachers/<int:teacher_id>', methods=['GET'])
def get_teacher(teacher_id):
    try:
        conn = get_db()
        row = conn.execute("SELECT * FROM teachers WHERE id = ?", (teacher_id,)).fetchone()
        conn.close()
        if not row:
            return jsonify({'error': 'Teacher not found'}), 404
        return jsonify(dict(row))
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/teachers/<int:teacher_id>', methods=['PUT'])
def update_teacher(teacher_id):
    try:
        data = request.json
        conn = get_db()
        conn.execute(
            """UPDATE teachers SET name = ?, email = ?, phone = ?, subject = ?, 
               qualification = ?, date_of_joining = ?, address = ?, 
               updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
            (data.get('name'), data.get('email'), data.get('phone'), data.get('subject'),
             data.get('qualification'), data.get('date_of_joining'), data.get('address'),
             teacher_id)
        )
        conn.commit()
        conn.close()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/teachers/<int:teacher_id>', methods=['DELETE'])
def delete_teacher(teacher_id):
    try:
        conn = get_db()
        conn.execute("DELETE FROM teachers WHERE id = ?", (teacher_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===========================
# ATTENDANCE ENDPOINTS
# ===========================

@app.route('/api/attendance', methods=['POST'])
def create_attendance():
    try:
        data = request.json
        conn = get_db()
        conn.execute(
            """INSERT INTO attendance (student_id, attendance_date, status, remarks) 
               VALUES (?, ?, ?, ?)""",
            (data.get('student_id'), data.get('attendance_date'), data.get('status'),
             data.get('remarks'))
        )
        conn.commit()
        attendance_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()
        data['id'] = attendance_id
        return jsonify(data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    try:
        date_filter = request.args.get('date')
        student_id = request.args.get('student_id')
        conn = get_db()
        query = "SELECT a.*, s.name, s.roll_no FROM attendance a JOIN students s ON a.student_id = s.id WHERE 1=1"
        params = []
        if date_filter:
            query += " AND a.attendance_date = ?"
            params.append(date_filter)
        if student_id:
            query += " AND a.student_id = ?"
            params.append(student_id)
        query += " ORDER BY a.attendance_date DESC, s.roll_no"
        rows = conn.execute(query, params).fetchall()
        attendance = [dict(row) for row in rows]
        conn.close()
        return jsonify(attendance)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/attendance/<int:attendance_id>', methods=['PUT'])
def update_attendance(attendance_id):
    try:
        data = request.json
        conn = get_db()
        conn.execute(
            """UPDATE attendance SET status = ?, remarks = ? WHERE id = ?""",
            (data.get('status'), data.get('remarks'), attendance_id)
        )
        conn.commit()
        conn.close()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/attendance/<int:attendance_id>', methods=['DELETE'])
def delete_attendance(attendance_id):
    try:
        conn = get_db()
        conn.execute("DELETE FROM attendance WHERE id = ?", (attendance_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===========================
# PAYMENTS ENDPOINTS
# ===========================

@app.route('/api/payments', methods=['POST'])
def create_payment():
    try:
        data = request.json
        conn = get_db()
        conn.execute(
            """INSERT INTO payments (student_id, amount, payment_date, payment_method, 
               transaction_id, purpose, status, remarks) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.get('student_id'), data.get('amount'), data.get('payment_date'),
             data.get('payment_method'), data.get('transaction_id'), data.get('purpose'),
             data.get('status', 'Completed'), data.get('remarks'))
        )
        conn.commit()
        payment_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()
        data['id'] = payment_id
        return jsonify(data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/payments', methods=['GET'])
def get_payments():
    try:
        student_id = request.args.get('student_id')
        status = request.args.get('status')
        conn = get_db()
        query = "SELECT p.*, s.name, s.roll_no FROM payments p JOIN students s ON p.student_id = s.id WHERE 1=1"
        params = []
        if student_id:
            query += " AND p.student_id = ?"
            params.append(student_id)
        if status:
            query += " AND p.status = ?"
            params.append(status)
        query += " ORDER BY p.payment_date DESC"
        rows = conn.execute(query, params).fetchall()
        payments = [dict(row) for row in rows]
        conn.close()
        return jsonify(payments)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/payments/<int:payment_id>', methods=['GET'])
def get_payment(payment_id):
    try:
        conn = get_db()
        row = conn.execute(
            "SELECT p.*, s.name, s.roll_no FROM payments p JOIN students s ON p.student_id = s.id WHERE p.id = ?",
            (payment_id,)
        ).fetchone()
        conn.close()
        if not row:
            return jsonify({'error': 'Payment not found'}), 404
        return jsonify(dict(row))
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/payments/<int:payment_id>', methods=['PUT'])
def update_payment(payment_id):
    try:
        data = request.json
        conn = get_db()
        conn.execute(
            """UPDATE payments SET amount = ?, payment_date = ?, payment_method = ?, 
               transaction_id = ?, purpose = ?, status = ?, remarks = ?, 
               updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
            (data.get('amount'), data.get('payment_date'), data.get('payment_method'),
             data.get('transaction_id'), data.get('purpose'), data.get('status'),
             data.get('remarks'), payment_id)
        )
        conn.commit()
        conn.close()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/payments/<int:payment_id>', methods=['DELETE'])
def delete_payment(payment_id):
    try:
        conn = get_db()
        conn.execute("DELETE FROM payments WHERE id = ?", (payment_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===========================
# STATISTICS ENDPOINTS
# ===========================

@app.route('/api/stats/dashboard', methods=['GET'])
def get_dashboard_stats():
    try:
        conn = get_db()
        total_students = conn.execute("SELECT COUNT(*) as count FROM students").fetchone()['count']
        total_teachers = conn.execute("SELECT COUNT(*) as count FROM teachers").fetchone()['count']
        # lifetime revenue (all completed payments)
        total_revenue = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'Completed'"
        ).fetchone()['total']
        # revenue for the current month only (used by dashboard KPI)
        current_month = datetime.now().strftime('%Y-%m')
        month_revenue = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) as total FROM payments \
             WHERE status = 'Completed' AND substr(payment_date,1,7) = ?",
            (current_month,)
        ).fetchone()['total']
        pending_payments = conn.execute("SELECT COUNT(*) as count FROM payments WHERE status = 'Pending'").fetchone()['count']
        conn.close()
        return jsonify({
            'total_students': total_students,
            'total_teachers': total_teachers,
            'total_revenue': total_revenue,
            'month_revenue': month_revenue,
            'pending_payments': pending_payments
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===========================
# HEALTH CHECK
# ===========================

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'School Admin Portal API is running'})


# ===========================
# STATIC FRONTEND SERVING
# ===========================
# Convenience route so developers can open the UI simply by
# visiting http://localhost:5000/ after starting the Flask server.
# This avoids having to run a separate `python -m http.server`.
from flask import send_from_directory

FRONTEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    # if requested file exists in the frontend folder, return it;
    # otherwise fall back to index.html so client-side routing continues
    if path and os.path.isfile(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')

# ===========================
# THERMAL PRINTER RECEIPT ENDPOINTS
# ===========================

@app.route('/api/receipt/thermal', methods=['POST'])
def generate_thermal_receipt():
    """
    Generate ESC/POS thermal printer receipt format
    
    Request body:
    {
        "payment_id": 1,
        "student_name": "John Doe",
        "roll_no": "ADM001",
        "amount": 5000,
        "payment_method": "Cash/Online",
        "purpose": "Monthly Fee",
        "receipt_number": "RCP001",
        "payment_date": "2026-02-26"
    }
    """
    try:
        data = request.json
        
        # ESC/POS commands for thermal printer (80mm width)
        receipt = []
        
        # Initialize printer
        receipt.append(b'\x1b\x40')  # Reset printer
        
        # Center align
        receipt.append(b'\x1b\x61\x01')  # Center text
        
        # Header - School Name
        receipt.append(b'\x1b\x21\x08')  # Large text
        receipt.append("KHUSHI PUBLIC SCHOOL\n".encode('utf-8'))
        receipt.append(b'\x1b\x21\x00')  # Normal text
        
        # Address
        receipt.append("Fee Receipt\n".encode('utf-8'))
        receipt.append("================================\n".encode('utf-8'))
        
        # Left align for details
        receipt.append(b'\x1b\x61\x00')  # Left align
        receipt.append("\n".encode('utf-8'))
        
        # Receipt details
        receipt_num = data.get('receipt_number', 'N/A')
        payment_date = data.get('payment_date', datetime.now().strftime('%d-%m-%Y'))
        student_name = data.get('student_name', 'N/A')
        roll_no = data.get('roll_no', 'N/A')
        amount = data.get('amount', 0)
        method = data.get('payment_method', 'N/A')
        purpose = data.get('purpose', 'School Fee')
        
        # Details
        receipt.append(f"Receipt No.: {receipt_num}\n".encode('utf-8'))
        receipt.append(f"Date: {payment_date}\n".encode('utf-8'))
        receipt.append(f"Student: {student_name}\n".encode('utf-8'))
        receipt.append(f"Admission No.: {roll_no}\n".encode('utf-8'))
        receipt.append("\n".encode('utf-8'))
        
        # Item details
        receipt.append("--------------------------------\n".encode('utf-8'))
        receipt.append(f"Purpose: {purpose}\n".encode('utf-8'))
        receipt.append(f"Amount: Rs. {amount:,.2f}\n".encode('utf-8'))
        receipt.append(f"Method: {method}\n".encode('utf-8'))
        receipt.append("--------------------------------\n".encode('utf-8'))
        receipt.append("\n".encode('utf-8'))
        
        # Center align for signature
        receipt.append(b'\x1b\x61\x01')  # Center
        receipt.append("Thank You!\n".encode('utf-8'))
        receipt.append("For Payment\n".encode('utf-8'))
        receipt.append("\n".encode('utf-8'))
        receipt.append("(Original Receipt)\n".encode('utf-8'))
        receipt.append("\n".encode('utf-8'))
        receipt.append("================================\n".encode('utf-8'))
        
        # Cut paper
        receipt.append(b'\x1d\x56\x41')  # Partial cut
        receipt.append(b'\n\n\n')
        
        # Combine all bytes
        receipt_data = b''.join(receipt)
        
        return jsonify({
            'success': True,
            'receipt': receipt_data.decode('latin-1'),  # Send as string for JavaScript
            'message': 'Receipt generated successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/receipt/html', methods=['POST'])
def generate_html_receipt():
    """Generate HTML receipt for browser printing"""
    try:
        data = request.json
        
        receipt_num = data.get('receipt_number', 'N/A')
        payment_date = data.get('payment_date', datetime.now().strftime('%d-%m-%Y'))
        student_name = data.get('student_name', 'N/A')
        roll_no = data.get('roll_no', 'N/A')
        amount = data.get('amount', 0)
        method = data.get('payment_method', 'N/A')
        purpose = data.get('purpose', 'School Fee')
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Receipt #{receipt_num}</title>
            <style>
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                body {{ 
                    font-family: 'Courier New', monospace; 
                    background: white;
                    padding: 20px;
                }}
                .receipt {{
                    width: 80mm;
                    max-width: 100%;
                    margin: 0 auto;
                    border: 1px solid #333;
                    padding: 15px;
                    background: white;
                    line-height: 1.6;
                    font-size: 12px;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 10px;
                    border-bottom: 1px dashed #333;
                    padding-bottom: 10px;
                }}
                .header h1 {{
                    font-size: 14px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }}
                .header p {{
                    font-size: 11px;
                    margin: 2px 0;
                }}
                .details {{
                    margin: 10px 0;
                }}
                .detail-row {{
                    display: flex;
                    justify-content: space-between;
                    margin: 4px 0;
                    font-size: 11px;
                }}
                .label {{
                    font-weight: bold;
                    width: 60%;
                }}
                .value {{
                    text-align: right;
                    width: 40%;
                }}
                .separator {{
                    border-top: 1px dashed #333;
                    margin: 10px 0;
                }}
                .amount-section {{
                    margin: 10px 0;
                    text-align: center;
                    font-weight: bold;
                }}
                .amount {{
                    font-size: 16px;
                    margin: 5px 0;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 15px;
                    font-size: 10px;
                    border-top: 1px dashed #333;
                    padding-top: 10px;
                }}
                .original {{
                    text-align: center;
                    font-size: 9px;
                    margin-top: 5px;
                    font-weight: bold;
                }}
                @media print {{
                    body {{ padding: 0; }}
                    .receipt {{ border: none; width: 80mm; margin: 0; }}
                    .no-print {{ display: none; }}
                }}
                .print-button {{
                    display: block;
                    margin: 20px auto;
                    padding: 10px 20px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }}
                .print-button:hover {{
                    background: #0056b3;
                }}
            </style>
        </head>
        <body>
            <button class="print-button no-print" onclick="window.print()">Print Receipt</button>
            
            <div class="receipt">
                <div class="header">
                    <h1>KHUSHI PUBLIC SCHOOL</h1>
                    <p>Fee Receipt</p>
                </div>
                
                <div class="details">
                    <div class="detail-row">
                        <span class="label">Receipt No.:</span>
                        <span class="value">{receipt_num}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Date:</span>
                        <span class="value">{payment_date}</span>
                    </div>
                </div>
                
                <div class="separator"></div>
                
                <div class="details">
                    <div class="detail-row">
                        <span class="label">Student Name:</span>
                        <span class="value">{student_name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Admission No.:</span>
                        <span class="value">{roll_no}</span>
                    </div>
                </div>
                
                <div class="separator"></div>
                
                <div class="details">
                    <div class="detail-row">
                        <span class="label">Purpose:</span>
                        <span class="value">{purpose}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Method:</span>
                        <span class="value">{method}</span>
                    </div>
                </div>
                
                <div class="separator"></div>
                
                <div class="amount-section">
                    <div>Amount Paid</div>
                    <div class="amount">Rs. {amount:,.2f}</div>
                </div>
                
                <div class="footer">
                    <p>Thank You For Payment</p>
                    <div class="original">(Original Receipt)</div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html_content, 200, {'Content-Type': 'text/html; charset=utf-8'}
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        'message': 'School Admin Portal API',
        'version': '1.0.0',
        'docs': 'See DATABASE_API.md for API documentation'
    })

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(port=port, debug=os.environ.get('FLASK_ENV') == 'development')
