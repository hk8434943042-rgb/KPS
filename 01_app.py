import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Use DATABASE_URL from environment (for Railway), fallback to local
DB_PATH = os.environ.get("DATABASE_URL", "").replace("sqlite:///", "") or "school.db"

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
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
    conn.commit()
    conn.close()

# ===========================
# STUDENTS ENDPOINTS
# ===========================

@app.route('/api/students', methods=['POST'])
def create_student():
    try:
        data = request.json
        conn = get_db()
        conn.execute(
            """INSERT INTO students (roll_no, name, email, phone, class_name, section, 
               date_of_birth, address, parent_name, parent_phone) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.get('roll_no'), data.get('name'), data.get('email'), data.get('phone'),
             data.get('class_name'), data.get('section'), data.get('date_of_birth'),
             data.get('address'), data.get('parent_name'), data.get('parent_phone'))
        )
        conn.commit()
        student_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()
        data['id'] = student_id
        return jsonify(data), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/students', methods=['GET'])
def get_students():
    try:
        conn = get_db()
        rows = conn.execute("SELECT * FROM students ORDER BY roll_no").fetchall()
        students = [dict(row) for row in rows]
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
        return jsonify(dict(row))
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    try:
        data = request.json
        conn = get_db()
        conn.execute(
            """UPDATE students SET name = ?, email = ?, phone = ?, class_name = ?, 
               section = ?, date_of_birth = ?, address = ?, parent_name = ?, 
               parent_phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
            (data.get('name'), data.get('email'), data.get('phone'), data.get('class_name'),
             data.get('section'), data.get('date_of_birth'), data.get('address'),
             data.get('parent_name'), data.get('parent_phone'), student_id)
        )
        conn.commit()
        conn.close()
        return jsonify(data)
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
        total_revenue = conn.execute("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'Completed'").fetchone()['total']
        pending_payments = conn.execute("SELECT COUNT(*) as count FROM payments WHERE status = 'Pending'").fetchone()['count']
        conn.close()
        return jsonify({
            'total_students': total_students,
            'total_teachers': total_teachers,
            'total_revenue': total_revenue,
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
