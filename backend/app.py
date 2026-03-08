import os
from flask import Flask, request, jsonify, session
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime, timedelta
import hashlib
import hmac
import secrets
import logging
import random
import smtplib
import base64
import urllib.parse
import urllib.request
import urllib.error
import html
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../flask_debug.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

logger.info("=== Flask App Starting ===")

OTP_REQUESTS = {}
OTP_TTL_SECONDS = int(os.environ.get('OTP_TTL_SECONDS', '300'))
OTP_STORE_BACKEND = 'memory'
OTP_REDIS = None

def _init_otp_store():
    global OTP_STORE_BACKEND, OTP_REDIS
    redis_url = os.environ.get('REDIS_URL', '').strip()
    if not redis_url:
        OTP_STORE_BACKEND = 'memory'
        return
    try:
        import redis
        OTP_REDIS = redis.from_url(redis_url, decode_responses=True)
        OTP_REDIS.ping()
        OTP_STORE_BACKEND = 'redis'
        logger.info('[OTP] Redis store enabled for OTP requests.')
    except Exception as e:
        OTP_STORE_BACKEND = 'memory'
        OTP_REDIS = None
        logger.warning(f'[OTP] Redis unavailable, falling back to memory store: {str(e)}')

_init_otp_store()

class OtpProviderError(Exception):
    def __init__(self, message, provider='unknown', code=None, status=None, details=None):
        super().__init__(message)
        self.provider = provider
        self.code = code
        self.status = status
        self.details = details or {}

app = Flask(__name__)
# Allow CORS from all origins in development (more permissive than production)
CORS(app,
    resources={r"/api/*": {"origins": "*"}, r"/health": {"origins": "*"}},
    supports_credentials=False,
    allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
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


def ensure_teacher_columns(conn):
    try:
        teacher_info = conn.execute("PRAGMA table_info(teachers)")
        teacher_existing = {row['name'] for row in teacher_info.fetchall()}
        if 'salary' not in teacher_existing:
            conn.execute("ALTER TABLE teachers ADD COLUMN salary REAL DEFAULT 0")
        if 'status' not in teacher_existing:
            conn.execute("ALTER TABLE teachers ADD COLUMN status TEXT DEFAULT 'active'")
        conn.commit()
    except Exception:
        pass


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

@app.errorhandler(Exception)
def handle_error(error):
    import traceback
    logger.error(f"[GLOBAL ERROR] {str(error)}\n{traceback.format_exc()}")
    print(f"[GLOBAL ERROR] {str(error)}")
    print(traceback.format_exc())
    return jsonify({'error': str(error), 'type': type(error).__name__}), 500

@app.before_request
def log_request():
    logger.info(f"[REQUEST] {request.method} {request.path} from {request.remote_addr}")
    logger.info(f"[REQUEST] Content-Type: {request.content_type}")
    print(f"[DEBUG] {request.method} {request.path}")
    if request.method == 'POST':
        print(f"[DEBUG] POST to {request.path}: content_type={request.content_type}")
        try:
            body = request.get_json()
            logger.info(f"[REQUEST] Body: {body}")
            print(f"[DEBUG] Body: {body}")
        except Exception as e:
            logger.warning(f"[REQUEST] Failed to parse JSON: {str(e)}")
            print(f"[DEBUG] Failed to parse JSON: {str(e)}")


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
        discount REAL DEFAULT 0,
        late_fee REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id)
    )
    """
    )
    # Create indexes for better performance
    conn.execute("CREATE INDEX IF NOT EXISTS idx_students_roll_no ON students(roll_no)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_students_name ON students(name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name, section)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date)")
    
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

    # ensure teacher columns exist for frontend Teachers module
    teacher_info = conn.execute("PRAGMA table_info(teachers)")
    teacher_existing = {row['name'] for row in teacher_info.fetchall()}
    teacher_extras = {
        'salary': "ALTER TABLE teachers ADD COLUMN salary REAL DEFAULT 0",
        'status': "ALTER TABLE teachers ADD COLUMN status TEXT DEFAULT 'active'"
    }

    # ensure payment columns exist for fee module consistency
    payment_info = conn.execute("PRAGMA table_info(payments)")
    payment_existing = {row['name'] for row in payment_info.fetchall()}
    payment_extras = {
        'discount': "ALTER TABLE payments ADD COLUMN discount REAL DEFAULT 0",
        'late_fee': "ALTER TABLE payments ADD COLUMN late_fee REAL DEFAULT 0"
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

    for col, stmt in teacher_extras.items():
        if col not in teacher_existing:
            try:
                conn.execute(stmt)
            except Exception:
                pass

    for col, stmt in payment_extras.items():
        if col not in payment_existing:
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

def _hash_otp_value(otp_value, salt=None):
    _salt = salt or secrets.token_hex(16)
    digest = hashlib.sha256(f"{_salt}:{otp_value}".encode('utf-8')).hexdigest()
    return _salt, digest

def _verify_otp_hash(otp_value, otp_salt, otp_hash):
    _, check_hash = _hash_otp_value(otp_value, otp_salt)
    return hmac.compare_digest(check_hash, otp_hash)

def _otp_store_set(request_id, payload, ttl_seconds=OTP_TTL_SECONDS):
    if OTP_STORE_BACKEND == 'redis' and OTP_REDIS is not None:
        OTP_REDIS.setex(f"otp:{request_id}", int(ttl_seconds), json.dumps(payload))
        return
    payload = dict(payload)
    payload['expires_at'] = datetime.utcnow() + timedelta(seconds=int(ttl_seconds))
    OTP_REQUESTS[request_id] = payload

def _otp_store_get(request_id):
    if OTP_STORE_BACKEND == 'redis' and OTP_REDIS is not None:
        raw = OTP_REDIS.get(f"otp:{request_id}")
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    item = OTP_REQUESTS.get(request_id)
    if not item:
        return None
    if item.get('expires_at') and item['expires_at'] < datetime.utcnow():
        OTP_REQUESTS.pop(request_id, None)
        return None
    return item

def _otp_store_delete(request_id):
    if OTP_STORE_BACKEND == 'redis' and OTP_REDIS is not None:
        OTP_REDIS.delete(f"otp:{request_id}")
        return
    OTP_REQUESTS.pop(request_id, None)

def _otp_store_update(request_id, payload, ttl_seconds=OTP_TTL_SECONDS):
    if OTP_STORE_BACKEND == 'redis' and OTP_REDIS is not None:
        ttl = OTP_REDIS.ttl(f"otp:{request_id}")
        keep_ttl = ttl if isinstance(ttl, int) and ttl > 0 else int(ttl_seconds)
        OTP_REDIS.setex(f"otp:{request_id}", keep_ttl, json.dumps(payload))
        return
    OTP_REQUESTS[request_id] = payload

def _cleanup_expired_otp_requests():
    if OTP_STORE_BACKEND == 'redis' and OTP_REDIS is not None:
        return
    now = datetime.utcnow()
    expired = [request_id for request_id, item in OTP_REQUESTS.items() if item.get('expires_at') and item['expires_at'] < now]
    for request_id in expired:
        OTP_REQUESTS.pop(request_id, None)

def _send_otp_email(to_email, otp_code, purpose='Password Reset'):
    smtp_host = os.environ.get('SMTP_HOST', '').strip()
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_user = os.environ.get('SMTP_USER', '').strip()
    smtp_pass = os.environ.get('SMTP_PASS', '').strip()
    smtp_from = os.environ.get('SMTP_FROM', smtp_user).strip()
    smtp_use_tls = os.environ.get('SMTP_USE_TLS', 'true').strip().lower() != 'false'

    if not smtp_host or not smtp_user or not smtp_pass or not smtp_from:
        raise RuntimeError('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.')

    msg = EmailMessage()
    msg['Subject'] = f'Your OTP Code ({purpose})'
    msg['From'] = smtp_from
    msg['To'] = to_email
    msg.set_content(
        f"Your OTP code is: {otp_code}\n\n"
        "This OTP is valid for 5 minutes.\n"
        "If you did not request this, please ignore this email."
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        if smtp_use_tls:
            server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)

def _normalize_phone(phone):
    digits = ''.join(ch for ch in str(phone or '') if ch.isdigit())
    if not digits:
        return ''
    if len(digits) == 10:
        return f'+91{digits}'
    if len(digits) == 12 and digits.startswith('91'):
        return f'+{digits}'
    if str(phone).strip().startswith('+'):
        return str(phone).strip()
    return f'+{digits}'

def _send_otp_sms(to_phone, otp_code, purpose='Password Reset'):
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN', '').strip()
    twilio_from = os.environ.get('TWILIO_FROM_NUMBER', '').strip()

    if not account_sid or not auth_token or not twilio_from:
        raise RuntimeError('Twilio SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.')

    destination = _normalize_phone(to_phone)
    if not destination:
        raise RuntimeError('Valid phone number is required for SMS OTP.')

    message = f"Your OTP code is {otp_code}. Valid for 5 minutes. ({purpose})"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    payload = urllib.parse.urlencode({'To': destination, 'From': twilio_from, 'Body': message}).encode('utf-8')

    token = base64.b64encode(f"{account_sid}:{auth_token}".encode('utf-8')).decode('ascii')
    req = urllib.request.Request(url, data=payload, method='POST')
    req.add_header('Authorization', f'Basic {token}')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            status_code = getattr(response, 'status', 200)
            body = response.read().decode('utf-8', errors='ignore')
            payload_json = json.loads(body) if body else {}
            twilio_status = payload_json.get('status')
            sid = payload_json.get('sid')
            error_code = payload_json.get('error_code')
            error_message = payload_json.get('error_message')

            if status_code < 200 or status_code >= 300:
                raise OtpProviderError(
                    f'Twilio SMS failed with status {status_code}.',
                    provider='twilio',
                    code=error_code,
                    status=status_code,
                    details=payload_json
                )

            if error_code or error_message:
                raise OtpProviderError(
                    f"Twilio SMS failed: {error_message or 'Unknown Twilio error'}",
                    provider='twilio',
                    code=error_code,
                    status=status_code,
                    details=payload_json
                )

            return {
                'provider': 'twilio',
                'sid': sid,
                'status': twilio_status,
                'error_code': error_code,
                'error_message': error_message
            }
    except urllib.error.HTTPError as http_err:
        body = ''
        payload_json = {}
        try:
            body = http_err.read().decode('utf-8', errors='ignore')
            payload_json = json.loads(body) if body else {}
        except Exception:
            payload_json = {}

        error_code = payload_json.get('code') or payload_json.get('error_code')
        error_message = payload_json.get('message') or payload_json.get('error_message') or str(http_err)
        raise OtpProviderError(
            f"Twilio SMS failed: {error_message}",
            provider='twilio',
            code=error_code,
            status=getattr(http_err, 'code', None),
            details=payload_json
        )
    except urllib.error.URLError as url_err:
        raise OtpProviderError(
            f"Twilio SMS network error: {url_err.reason}",
            provider='twilio',
            details={'reason': str(url_err.reason)}
        )

def _fetch_twilio_message_status(message_sid):
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN', '').strip()

    if not account_sid or not auth_token:
        raise OtpProviderError(
            'Twilio SMS is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
            provider='twilio'
        )

    if not message_sid:
        raise OtpProviderError('Twilio message SID is required.', provider='twilio')

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages/{message_sid}.json"
    token = base64.b64encode(f"{account_sid}:{auth_token}".encode('utf-8')).decode('ascii')
    req = urllib.request.Request(url, method='GET')
    req.add_header('Authorization', f'Basic {token}')

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            body = response.read().decode('utf-8', errors='ignore')
            payload_json = json.loads(body) if body else {}
            return {
                'sid': payload_json.get('sid'),
                'status': payload_json.get('status'),
                'error_code': payload_json.get('error_code'),
                'error_message': payload_json.get('error_message'),
                'to': payload_json.get('to'),
                'from': payload_json.get('from')
            }
    except urllib.error.HTTPError as http_err:
        body = ''
        payload_json = {}
        try:
            body = http_err.read().decode('utf-8', errors='ignore')
            payload_json = json.loads(body) if body else {}
        except Exception:
            payload_json = {}
        error_code = payload_json.get('code') or payload_json.get('error_code')
        error_message = payload_json.get('message') or payload_json.get('error_message') or str(http_err)
        raise OtpProviderError(
            f"Twilio status lookup failed: {error_message}",
            provider='twilio',
            code=error_code,
            status=getattr(http_err, 'code', None),
            details=payload_json
        )
    except urllib.error.URLError as url_err:
        raise OtpProviderError(
            f"Twilio status lookup network error: {url_err.reason}",
            provider='twilio',
            details={'reason': str(url_err.reason)}
        )

def _get_missing_sms_vars():
    required = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']
    missing = []
    for key in required:
        if not os.environ.get(key, '').strip():
            missing.append(key)
    return missing

def _get_missing_smtp_vars():
    required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
    missing = []
    for key in required:
        if not os.environ.get(key, '').strip():
            missing.append(key)
    return missing

def _log_otp_config_status():
    smtp_missing = _get_missing_smtp_vars()
    sms_missing = _get_missing_sms_vars()

    if smtp_missing:
        logger.warning(f"[OTP/SMTP] Missing SMTP env keys: {', '.join(smtp_missing)}")
    else:
        tls_enabled = os.environ.get('SMTP_USE_TLS', 'true').strip().lower() != 'false'
        logger.info(f"[OTP/SMTP] SMTP configuration detected. TLS enabled: {tls_enabled}")

    if sms_missing:
        logger.warning(f"[OTP/SMS] Missing Twilio env keys: {', '.join(sms_missing)}")
    else:
        logger.info("[OTP/SMS] Twilio SMS configuration detected.")

    logger.info(f"[OTP] Store backend: {OTP_STORE_BACKEND}")

_log_otp_config_status()

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

@app.route('/api/auth/otp/send', methods=['POST', 'GET'])
def send_otp():
    """Send OTP using email or SMS for password reset verification"""
    try:
        data = request.json or {} if request.method == 'POST' else {}
        if request.method == 'GET':
            data = request.args or {}
        channel = (data.get('channel') or '').strip().lower() or 'email'
        email = (data.get('email') or '').strip().lower()
        phone = (data.get('phone') or '').strip()
        role = (data.get('role') or '').strip()

        if channel not in ('email', 'sms'):
            return jsonify({'error': 'channel must be email or sms'}), 400

        if role not in ('main_admin', 'reception', 'admin'):
            return jsonify({'error': 'OTP is only available for admin/reception accounts'}), 400

        _cleanup_expired_otp_requests()

        otp_code = f"{random.randint(100000, 999999)}"
        request_id = secrets.token_urlsafe(24)
        provider_info = {}
        otp_salt, otp_hash = _hash_otp_value(otp_code)

        destination = ''
        if channel == 'sms':
            if not phone:
                return jsonify({'error': 'Phone is required for SMS OTP'}), 400
            normalized_phone = _normalize_phone(phone)
            provider_info = _send_otp_sms(normalized_phone, otp_code, 'School Login Password Reset') or {}
            destination = normalized_phone
        else:
            if not email:
                return jsonify({'error': 'Email is required for Email OTP'}), 400
            _send_otp_email(email, otp_code, 'School Login Password Reset')
            destination = email

        _otp_store_set(request_id, {
            'otp_hash': otp_hash,
            'otp_salt': otp_salt,
            'email': email,
            'phone': _normalize_phone(phone) if phone else '',
            'channel': channel,
            'destination': destination,
            'provider': provider_info,
            'role': role,
            'attempts': 0
        }, OTP_TTL_SECONDS)

        return jsonify({
            'success': True,
            'message': 'OTP sent successfully',
            'channel': channel,
            'destination': destination,
            'provider': provider_info,
            'request_id': request_id,
            'expires_in_seconds': 300
        }), 200
    except OtpProviderError as e:
        logger.error(f"[OTP/SMS] Provider error: {str(e)} | provider={e.provider} code={e.code} status={e.status}")
        return jsonify({
            'error': str(e),
            'provider': e.provider,
            'provider_error_code': e.code,
            'provider_error_message': str(e),
            'provider_status': e.status,
            'provider_details': e.details
        }), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/auth/otp/verify', methods=['POST', 'GET'])
def verify_otp():
    """Verify OTP request"""
    try:
        data = request.json or {} if request.method == 'POST' else {}
        if request.method == 'GET':
            data = request.args or {}
        request_id = (data.get('request_id') or '').strip()
        otp_code = (data.get('otp') or '').strip()
        role = (data.get('role') or '').strip()
        channel = (data.get('channel') or '').strip().lower()

        if not request_id or not otp_code:
            return jsonify({'error': 'request_id and otp are required'}), 400

        _cleanup_expired_otp_requests()
        item = _otp_store_get(request_id)
        if not item:
            return jsonify({'error': 'OTP request expired or invalid'}), 400

        if role and item.get('role') != role:
            return jsonify({'error': 'OTP role mismatch'}), 400

        if channel and item.get('channel') != channel:
            return jsonify({'error': 'OTP channel mismatch'}), 400

        item['attempts'] = int(item.get('attempts') or 0) + 1
        if item['attempts'] > 5:
            _otp_store_delete(request_id)
            return jsonify({'error': 'Too many invalid attempts'}), 429

        if not _verify_otp_hash(otp_code, item.get('otp_salt', ''), item.get('otp_hash', '')):
            _otp_store_update(request_id, item, OTP_TTL_SECONDS)
            return jsonify({'error': 'Invalid OTP'}), 400

        _otp_store_delete(request_id)
        return jsonify({'success': True, 'message': 'OTP verified'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/auth/otp/health', methods=['GET'])
def otp_health():
    """Check OTP email/SMS configuration health"""
    try:
        smtp_missing = _get_missing_smtp_vars()
        sms_missing = _get_missing_sms_vars()
        smtp_ok = len(smtp_missing) == 0
        sms_ok = len(sms_missing) == 0
        return jsonify({
            'ok': smtp_ok or sms_ok,
            'missing': smtp_missing,
            'smtp_use_tls': os.environ.get('SMTP_USE_TLS', 'true').strip().lower() != 'false',
            'smtp': {
                'ok': smtp_ok,
                'missing': smtp_missing,
                'use_tls': os.environ.get('SMTP_USE_TLS', 'true').strip().lower() != 'false'
            },
            'sms': {
                'ok': sms_ok,
                'missing': sms_missing
            },
            'otp_store': OTP_STORE_BACKEND
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/auth/otp/sms-status', methods=['GET'])
def otp_sms_status():
    """Check Twilio SMS delivery status using message SID"""
    try:
        sid = (request.args.get('sid') or '').strip()
        if not sid:
            return jsonify({'error': 'sid is required'}), 400

        status_data = _fetch_twilio_message_status(sid)
        return jsonify({
            'success': True,
            'provider': 'twilio',
            **status_data
        }), 200
    except OtpProviderError as e:
        return jsonify({
            'error': str(e),
            'provider': e.provider,
            'provider_error_code': e.code,
            'provider_status': e.status,
            'provider_details': e.details
        }), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===========================
# STUDENTS ENDPOINTS
# ===========================

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

# TEST ENDPOINT - Remove later
@app.route('/api/test-post', methods=['POST'])
def test_post():
    print("[TEST] Test POST endpoint called!")
    logger.info("[TEST] Test POST endpoint called!")
    try:
        data = request.get_json()
        print(f"[TEST] Received: {data}")
        return jsonify({'success': True, 'received': data}), 200
    except Exception as e:
        print(f"[TEST] Error: {str(e)}")
        logger.error(f"[TEST] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/students', methods=['POST'])
def create_student():
    logger.info("[POST] create_student called")
    print("[DEBUG] Starting create_student function...")
    try:
        data = request.json or {}
        logger.info(f"[POST] Request data: {data}")
        print(f"[DEBUG] Request data: {data}")
        
        # Validation
        if not data.get('roll_no'):
            print("[DEBUG] Roll number is missing")
            return jsonify({'error': 'Roll number is required'}), 400
        if not data.get('name'):
            print("[DEBUG] Name is missing")
            return jsonify({'error': 'Student name is required'}), 400
        
        print("[DEBUG] Validation passed, normalizing dates...")
        # Normalize dates
        data['admission_date'] = _normalize_date(data.get('admission_date'))
        data['date_of_birth'] = _normalize_date(data.get('date_of_birth'))
        print(f"[DEBUG] Dates normalized: admission_date={data['admission_date']}, dob={data['date_of_birth']}")
        
        conn = get_db()
        print("[DEBUG] Database connection established")
        
        # Check for duplicate roll number
        existing = conn.execute("SELECT id FROM students WHERE roll_no = ?", (data.get('roll_no'),)).fetchone()
        if existing:
            conn.close()
            print(f"[DEBUG] Duplicate roll number: {data.get('roll_no')}")
            return jsonify({'error': f"Roll number {data.get('roll_no')} already exists"}), 400
        
        print("[DEBUG] No duplicates found, proceeding with insert...")
        
        # Insert with transaction
        try:
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
            
            if not row:
                conn.close()
                return jsonify({'error': 'Failed to retrieve created student'}), 500
            
            # Convert sqlite3.Row to dict properly
            result = {key: row[key] for key in row.keys()}
            conn.close()
            
            print(f"[SUCCESS] Student created: {result['name']} (ID: {result['id']}, Roll: {result['roll_no']})")
            return jsonify(result), 201
        except sqlite3.IntegrityError as e:
            conn.rollback()
            conn.close()
            print(f"[INTEGRITY ERROR] {str(e)}")
            return jsonify({'error': f'Roll number already exists or database constraint violated'}), 400
        except sqlite3.OperationalError as e:
            conn.rollback()
            conn.close()
            print(f"[DB ERROR] {str(e)}")
            return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"[EXCEPTION] Error creating student: {str(e)}\n{error_trace}")
        print(f"[EXCEPTION] Error creating student: {str(e)}")
        print(f"[TRACEBACK] {error_trace}")
        return jsonify({'error': str(e), 'trace': error_trace}), 500

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
        
        # Validation
        if not data.get('roll_no'):
            return jsonify({'error': 'Roll number is required'}), 400
        if not data.get('name'):
            return jsonify({'error': 'Student name is required'}), 400
        
        # Normalize dates
        data['admission_date'] = _normalize_date(data.get('admission_date'))
        data['date_of_birth'] = _normalize_date(data.get('date_of_birth'))
        
        conn = get_db()
        
        # Check if student exists
        existing = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        if not existing:
            conn.close()
            return jsonify({'error': 'Student not found'}), 404
        
        # Check for duplicate roll number (excluding current student)
        duplicate = conn.execute(
            "SELECT id FROM students WHERE roll_no = ? AND id != ?",
            (data.get('roll_no'), student_id)
        ).fetchone()
        if duplicate:
            conn.close()
            return jsonify({'error': f"Roll number {data.get('roll_no')} already exists"}), 400
        
        try:
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
            if not row:
                conn.close()
                return jsonify({'error': 'Student not found after update'}), 404
            
            result = {key: row[key] for key in row.keys()}
            conn.close()
            
            print(f"[SUCCESS] Student updated: {result['name']} (ID: {result['id']}, Roll: {result['roll_no']})")
            return jsonify(result)
        except sqlite3.IntegrityError as e:
            conn.rollback()
            conn.close()
            print(f"[INTEGRITY ERROR] {str(e)}")
            return jsonify({'error': f'Roll number already exists or database constraint violated'}), 400
        except sqlite3.OperationalError as e:
            conn.rollback()
            conn.close()
            print(f"[DB ERROR] {str(e)}")
            return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        print(f"[EXCEPTION] Error updating student: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/students/<int:student_id>', methods=['DELETE','OPTIONS'])
def delete_student(student_id):
    if request.method == 'OPTIONS':
        return jsonify({'success': True})
    try:
        conn = get_db()
        
        # Check if student exists and get info for logging
        student = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        if not student:
            conn.close()
            return jsonify({'error': 'Student not found'}), 404
        
        student_info = dict(student)
        
        try:
            # Delete student
            conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
            conn.commit()
            conn.close()
            
            print(f"✅ Student deleted: {student_info['name']} (ID: {student_id}, Roll: {student_info['roll_no']})")
            return jsonify({'success': True, 'message': f"Student {student_info['name']} deleted successfully"})
        except Exception as e:
            conn.rollback()
            conn.close()
            print(f"❌ Error deleting student: {str(e)}")
            return jsonify({'error': f'Failed to delete student: {str(e)}'}), 500
    except Exception as e:
        print(f"❌ Error in delete_student: {str(e)}")
        return jsonify({'error': str(e)}), 500

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


@app.route('/api/parents/<int:parent_id>', methods=['DELETE','OPTIONS'])
def delete_parent(parent_id):
    if request.method == 'OPTIONS':
        return jsonify({'success': True})
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


@app.route('/api/parents/<int:parent_id>/students/<int:student_id>', methods=['DELETE','OPTIONS'])
def detach_student_from_parent(parent_id, student_id):
    if request.method == 'OPTIONS':
        return jsonify({'success': True})
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
        ensure_teacher_columns(conn)
        conn.execute(
            """INSERT INTO teachers (emp_id, name, email, phone, subject, qualification, 
                    date_of_joining, address, salary, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.get('emp_id'), data.get('name'), data.get('email'), data.get('phone'),
             data.get('subject'), data.get('qualification'), data.get('date_of_joining'),
                 data.get('address'), data.get('salary', 0), data.get('status', 'active'))
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
        ensure_teacher_columns(conn)
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
        ensure_teacher_columns(conn)
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
        ensure_teacher_columns(conn)
        conn.execute(
            """UPDATE teachers SET name = ?, email = ?, phone = ?, subject = ?, 
                    qualification = ?, date_of_joining = ?, address = ?, salary = ?, status = ?,
               updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
            (data.get('name'), data.get('email'), data.get('phone'), data.get('subject'),
                 data.get('qualification'), data.get('date_of_joining'), data.get('address'),
                 data.get('salary', 0), data.get('status', 'active'),
             teacher_id)
        )
        conn.commit()
        conn.close()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/teachers/<int:teacher_id>', methods=['DELETE','OPTIONS'])
def delete_teacher(teacher_id):
    if request.method == 'OPTIONS':
        return jsonify({'success': True})
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

@app.route('/api/attendance/<int:attendance_id>', methods=['DELETE','OPTIONS'])
def delete_attendance(attendance_id):
    if request.method == 'OPTIONS':
        return jsonify({'success': True})
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
        
        # Validation
        required_fields = ['student_id', 'amount', 'payment_date', 'payment_method']
        missing = [f for f in required_fields if f not in data or data[f] is None]
        if missing:
            return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400
        
        student_id = int(data.get('student_id'))
        amount = float(data.get('amount'))
        
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than 0'}), 400
        
        # Check if student exists
        conn = get_db()
        student = conn.execute("SELECT id FROM students WHERE id = ?", (student_id,)).fetchone()
        if not student:
            return jsonify({'error': f'Student with ID {student_id} not found'}), 404
        
        # Insert payment
        conn.execute(
            """INSERT INTO payments (student_id, amount, payment_date, payment_method, 
               transaction_id, purpose, status, remarks, discount, late_fee) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (student_id, amount, data.get('payment_date'),
             data.get('payment_method'), data.get('transaction_id'), data.get('purpose'),
             data.get('status', 'Completed'), data.get('remarks'),
             data.get('discount', 0), data.get('late_fee', 0))
        )
        conn.commit()
        payment_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()
        
        response_data = data.copy()
        response_data['id'] = payment_id
        
        return jsonify(response_data), 201
    except ValueError as ve:
        return jsonify({'error': f'Invalid data format: {str(ve)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 400

@app.route('/api/payments', methods=['GET'])
def get_payments():
    try:
        student_id = request.args.get('student_id')
        status = request.args.get('status')
        conn = get_db()
        query = "SELECT p.*, s.name, s.roll_no FROM payments p LEFT JOIN students s ON p.student_id = s.id WHERE 1=1"
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
            "SELECT p.*, s.name, s.roll_no FROM payments p LEFT JOIN students s ON p.student_id = s.id WHERE p.id = ?",
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

@app.route('/api/payments/<int:payment_id>', methods=['DELETE','OPTIONS'])
def delete_payment(payment_id):
    if request.method == 'OPTIONS':
        return jsonify({'success': True})
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
            "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE LOWER(COALESCE(status,'')) = 'completed'"
        ).fetchone()['total']
        # revenue for the current month only (used by dashboard KPI)
        current_month = datetime.now().strftime('%Y-%m')
        month_revenue = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) as total FROM payments \
             WHERE LOWER(COALESCE(status,'')) = 'completed' AND substr(payment_date,1,7) = ?",
            (current_month,)
        ).fetchone()['total']
        pending_payments = conn.execute(
            "SELECT COUNT(*) as count FROM payments WHERE LOWER(COALESCE(status,'')) = 'pending'"
        ).fetchone()['count']
        failed_payments = conn.execute(
            "SELECT COUNT(*) as count FROM payments WHERE LOWER(COALESCE(status,'')) = 'failed'"
        ).fetchone()['count']
        conn.close()
        return jsonify({
            'total_students': total_students,
            'total_teachers': total_teachers,
            'total_revenue': total_revenue,
            'month_revenue': month_revenue,
            'pending_payments': pending_payments,
            'failed_payments': failed_payments
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
        data = request.json or {}

        receipt_num = data.get('receipt_number', 'N/A')
        payment_date = data.get('payment_date', datetime.now().strftime('%d-%m-%Y'))
        payment_time = data.get('payment_time', datetime.now().strftime('%I:%M %p'))
        student_name = data.get('student_name', 'N/A')
        amount_raw = data.get('amount', 0)
        method = data.get('payment_method', 'Cash')
        course = data.get('course', data.get('purpose', 'School Fee'))
        duration = data.get('duration', '')
        paid_by = data.get('paid_by', method)
        school_name = data.get('school_name', 'KIDS CARE PLAY SCHOOL')
        school_address = data.get('school_address', '1751, Gali no 5, Rajiv Puram, Karnal-132001')
        school_contact = data.get('school_contact', 'Contact: 0149-2082596')
        school_email = data.get('school_email', 'email: kidscps@gmail.co.in')

        try:
            amount = float(amount_raw or 0)
        except Exception:
            amount = 0.0

        font_variant = str(data.get('font_variant', 'standard')).strip().lower()
        is_large_font = font_variant in ('large', 'readable', '80mm-large')
        base_font_size = '11px' if is_large_font else '10px'
        title_font_size = '10px' if is_large_font else '9px'
        school_font_size = '18px' if is_large_font else '16px'
        contact_font_size = '9px' if is_large_font else '8px'
        table_cell_padding = '3px 5px' if is_large_font else '2px 4px'
        note_font_size = '9px' if is_large_font else '8px'

        particulars_raw = data.get('particulars')
        if isinstance(particulars_raw, list) and particulars_raw:
            particulars = [str(item).strip() for item in particulars_raw if str(item).strip()]
        else:
            particulars = [
                'Admission Fee',
                'Or Tuition Fee for second month',
                'Or Exam Fee',
                'Stationary Charges',
                'Security Deposit',
                'Activity Charges'
            ]

        line_width = 48

        def fit_text(value, max_len):
            return str(value or '')[:max_len]

        def line_lr(left, right=''):
            left = str(left or '')
            right = str(right or '')
            available_left = max(0, line_width - len(right) - 1)
            left = fit_text(left, available_left)
            spacing = ' ' * max(1, line_width - len(left) - len(right))
            return f"{left}{spacing}{right}\n"

        receipt = []
        receipt.append(b'\x1b\x40')
        receipt.append(b'\x1b\x61\x01')
        receipt.append(b'\x1b\x21\x08')
        receipt.append(f"{school_name}\n".encode('utf-8'))
        receipt.append(b'\x1b\x21\x00')
        receipt.append("Receipt\n".encode('utf-8'))
        receipt.append(f"{school_address}\n".encode('utf-8'))
        receipt.append(f"{school_contact} | {school_email}\n".encode('utf-8'))
        receipt.append(("=" * line_width + "\n").encode('utf-8'))

        receipt.append(b'\x1b\x61\x00')
        receipt.append(line_lr('Receipt No', str(receipt_num)).encode('utf-8'))
        receipt.append(line_lr('Name of Student', str(student_name)).encode('utf-8'))
        receipt.append(line_lr('Course', str(course)).encode('utf-8'))
        receipt.append(line_lr('Course Duration', str(duration)).encode('utf-8'))
        receipt.append(line_lr('Date of payment', str(payment_date)).encode('utf-8'))
        receipt.append(line_lr('Time of payment', str(payment_time)).encode('utf-8'))
        receipt.append(("-" * line_width + "\n").encode('utf-8'))

        receipt.append(line_lr('Sr  Particulars', 'Amount').encode('utf-8'))
        receipt.append(("-" * line_width + "\n").encode('utf-8'))
        for idx, item in enumerate(particulars, start=1):
            item_text = fit_text(f"{idx}. {item}", 39)
            receipt.append(line_lr(item_text, '').encode('utf-8'))

        receipt.append(("-" * line_width + "\n").encode('utf-8'))
        receipt.append(line_lr('Total', f"Rs {amount:,.2f}").encode('utf-8'))
        receipt.append(("-" * line_width + "\n").encode('utf-8'))
        receipt.append(line_lr('Paid By', str(paid_by)).encode('utf-8'))
        receipt.append("Signature of Centre Head\n".encode('utf-8'))
        receipt.append(("=" * line_width + "\n").encode('utf-8'))
        receipt.append("All above mentioned amount once paid are non refundable in any case whatsoever\n".encode('utf-8'))
        receipt.append(b'\n')
        receipt.append(b'\x1d\x56\x41')
        receipt.append(b'\n\n')

        receipt_data = b''.join(receipt)
        return jsonify({
            'success': True,
            'receipt': receipt_data.decode('latin-1'),
            'message': 'Receipt generated successfully'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/receipt/html', methods=['POST'])
def generate_html_receipt():
    """Generate HTML receipt for browser printing"""
    try:
        data = request.json or {}

        receipt_num = html.escape(str(data.get('receipt_number', 'N/A')))
        payment_date = html.escape(str(data.get('payment_date', datetime.now().strftime('%d-%m-%Y'))))
        payment_time = html.escape(str(data.get('payment_time', datetime.now().strftime('%I:%M %p'))))
        student_name = html.escape(str(data.get('student_name', 'N/A')))
        amount_raw = data.get('amount', 0)
        method = html.escape(str(data.get('payment_method', 'Cash')))
        course = html.escape(str(data.get('course', data.get('purpose', 'School Fee'))))
        duration = html.escape(str(data.get('duration', '')))
        paid_by = html.escape(str(data.get('paid_by', data.get('payment_method', 'Cash'))))
        school_name = html.escape(str(data.get('school_name', 'KIDS CARE PLAY SCHOOL')))
        school_address = html.escape(str(data.get('school_address', '1751, Gali no 5, Rajiv Puram, Karnal-132001')))
        school_contact = html.escape(str(data.get('school_contact', '0149-2082596')))
        school_email = html.escape(str(data.get('school_email', 'kidscps@gmail.co.in')))

        try:
            amount = float(amount_raw or 0)
        except Exception:
            amount = 0.0

        particulars_raw = data.get('particulars')
        if isinstance(particulars_raw, list) and particulars_raw:
            particulars = [html.escape(str(item).strip()) for item in particulars_raw if str(item).strip()]
        else:
            particulars = [
                'Admission Fee',
                'Or Tuition Fee for second month',
                'Or Exam Fee',
                'Stationary Charges',
                'Security Deposit',
                'Activity Charges'
            ]

        particulars_html = ''.join(
            f"<tr><td>{idx}</td><td>{item}</td><td></td></tr>"
            for idx, item in enumerate(particulars, start=1)
        )

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Receipt #{receipt_num}</title>
            <style>
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                @page {{ size: 80mm auto; margin: 0; }}
                body {{ font-family: 'Courier New', monospace; background: white; padding: 0; }}
                .receipt {{ width: 80mm; max-width: 100%; margin: 0 auto; border: 1px solid #000; font-size: {base_font_size}; color: #000; }}
                .header {{ text-align: center; border-bottom: 1px solid #000; padding: 6px 6px 4px; }}
                .title {{ font-size: {title_font_size}; margin-bottom: 2px; }}
                .school {{ font-size: {school_font_size}; font-weight: 700; letter-spacing: 0.6px; }}
                .contact {{ font-size: {contact_font_size}; margin-top: 3px; }}
                .meta, .rowline {{ display: flex; justify-content: space-between; gap: 8px; padding: 3px 6px; border-bottom: 1px solid #000; }}
                .meta .left, .rowline .left {{ flex: 1; }}
                .meta .right, .rowline .right {{ flex: 1; text-align: right; }}
                .line {{ padding: 3px 6px; border-bottom: 1px solid #000; }}
                .dots {{ display: inline-block; border-bottom: 1px dotted #000; min-width: 56%; vertical-align: middle; line-height: 1; }}
                table {{ width: 100%; border-collapse: collapse; }}
                th, td {{ border: 1px solid #000; padding: {table_cell_padding}; text-align: left; vertical-align: top; }}
                th:nth-child(1), td:nth-child(1) {{ width: 10%; text-align: center; }}
                th:nth-child(2), td:nth-child(2) {{ width: 64%; }}
                th:nth-child(3), td:nth-child(3) {{ width: 26%; text-align: right; }}
                .total-row td {{ font-weight: 700; }}
                .foot-line {{ padding: 6px; border-top: 1px solid #000; }}
                .small-note {{ text-align: center; font-size: {note_font_size}; border-top: 1px solid #000; padding: 4px; }}
                @media print {{
                    body {{ padding: 0; }}
                    .receipt {{ width: 80mm; margin: 0; }}
                    .no-print {{ display: none; }}
                }}
                .print-button {{
                    display: block;
                    margin: 12px auto;
                    padding: 8px 14px;
                    background: #111;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                }}
            </style>
        </head>
        <body>
            <button class="print-button no-print" onclick="window.print()">Print Receipt</button>
            
            <div class="receipt">
                <div class="header">
                    <div class="title">Receipt</div>
                    <div class="school">{school_name}</div>
                    <div>{school_address}</div>
                    <div class="contact">Contact: {school_contact} | email: {school_email}</div>
                </div>

                <div class="line">Receipt No {receipt_num}</div>
                <div class="meta">
                    <div class="left">Name of Student <span class="dots">&nbsp;{student_name}&nbsp;</span></div>
                    <div class="right">Course <span class="dots">&nbsp;{course}&nbsp;</span></div>
                </div>
                <div class="rowline">
                    <div class="left">Courses Duration <span class="dots">&nbsp;{duration}&nbsp;</span></div>
                    <div class="right">Date of payment <span class="dots">&nbsp;{payment_date}&nbsp;</span></div>
                </div>
                <div class="rowline">
                    <div class="left">Time of payment <span class="dots">&nbsp;{payment_time}&nbsp;</span></div>
                    <div class="right"></div>
                </div>

                <table>
                    <thead>
                        <tr><th>Sr. No.</th><th>Particulars</th><th>Amount</th></tr>
                    </thead>
                    <tbody>
                        {particulars_html}
                        <tr class="total-row"><td></td><td>Total</td><td>Rs. {amount:,.2f}</td></tr>
                    </tbody>
                </table>

                <div class="foot-line">Paid By {paid_by}</div>
                <div class="foot-line">Signature of Centre Head</div>
                <div class="small-note">All above mentioned Amount once paid are non refundable in any case whatsoever</div>
                <div class="small-note">Payment Method: {method}</div>
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

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint for deployment monitoring"""
    try:
        # Quick database connectivity check
        conn = get_db()
        conn.execute("SELECT 1")
        conn.close()
        return jsonify({'status': 'healthy', 'message': 'Server is running'}), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({'status': 'unhealthy', 'message': str(e)}), 503

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(port=port, debug=os.environ.get('FLASK_ENV') == 'development')
