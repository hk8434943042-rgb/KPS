# Login & Database Connection - Quick Start

## What's Been Implemented

### ✅ **Login Page** (`frontend/login.html`)
- **Registration Form** - Create new admin accounts with email and password validation
- **Login Form** - Login with username or email
- **Error Handling** - Clear error messages for invalid credentials or registration issues
- **Responsive Design** - Works on desktop and mobile devices

### ✅ **Backend Authentication** (`backend/01_app.py`)
- **Users Database Table** - Stores user credentials with hashed passwords
- **Password Security** - PBKDF2-SHA256 hashing with salt + 100,000 iterations
- **Authentication Endpoints**:
  - `POST /api/auth/register` - Create new account
  - `POST /api/auth/login` - Login with credentials
  - `POST /api/auth/logout` - Logout and clear session
  - `GET /api/auth/me` - Get current logged-in user info
  - `GET /api/auth/verify` - Verify if user is authenticated

### ✅ **Frontend Protection** 
- Automatic redirect to login page if not authenticated
- Display of logged-in user's name in dashboard topbar
- Secure logout button that clears all session data

---

## How to Test

### **1. Start the Backend Server**

```bash
cd backend
python 01_app.py
```

You should see:
```
Running on http://127.0.0.1:5000
```

### **2. Open the Application**

**Option A - Using Login Page (Recommended)**
- Open `frontend/login.html` in your browser
- You'll see the Registration tab by default

**Option B - Direct Dashboard Access**
- Open `frontend/index.html`
- You'll be redirected to login.html automatically if not authenticated

### **3. Create Your First Admin Account**

1. In the **Registration** tab:
   - **Full Name**: Enter your name (e.g., "School Admin")
   - **Username**: Enter unique username (e.g., "admin")
   - **Email**: Enter email (e.g., "admin@school.com")
   - **Password**: Enter password (min 6 characters, e.g., "Admin123")
   - **Confirm Password**: Re-enter password
   - Click **"Create Account"**

2. If successful, you'll see a success message and automatically switch to the Login tab

### **4. Login to Dashboard**

1. Enter your credentials in the **Login** tab:
   - **Username or Email**: admin (or admin@school.com)
   - **Password**: Admin123
   - Click **"Sign In"**

2. After successful login, you'll be redirected to the main dashboard

3. You should see your name displayed in the top-right corner next to the avatar

### **5. Test Logout**

1. Click the **"🚪 Logout"** button in the top-right
2. Confirm the logout
3. You'll be redirected back to the login page

---

## Database

The users are stored in SQLite database at: `database/school.db`

### Users Table Structure:
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Testing with cURL

### Register a User:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@school.com",
    "password": "Admin123",
    "full_name": "School Admin"
  }'
```

### Login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "username": "admin",
    "password": "Admin123"
  }'
```

### Get Current User:
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -b cookies.txt
```

### Verify Authentication:
```bash
curl -X GET http://localhost:5000/api/auth/verify \
  -b cookies.txt
```

### Logout:
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -b cookies.txt
```

---

## Important Notes

⚠️ **For Production Deployment:**
1. Change the `SECRET_KEY` in `backend/01_app.py`
2. Use HTTPS (not HTTP)
3. Set `FLASK_ENV=production`
4. Use a proper database (PostgreSQL recommended)
5. Implement token expiration for sessions
6. Add email verification for registration
7. Add password reset functionality
8. Use environment variables for sensitive data

📝 **Current Status:**
- ✅ Database connection working
- ✅ Login page created
- ✅ User registration functional
- ✅ Password hashing implemented
- ✅ Session management in place
- ✅ Admin dashboard protected
- ⏳ Role-based access (planned for future)
- ⏳ Remember me functionality (optional)
- ⏳ 2FA/MFA (optional enhancement)

---

## Files Modified/Created

| File | Status | Purpose |
|------|--------|---------|
| `frontend/login.html` | ✅ Created | Complete login/registration UI |
| `frontend/index.html` | ✅ Modified | Added user display element |
| `frontend/script.js` | ✅ Modified | Added auth checks and logout |
| `backend/01_app.py` | ✅ Modified | Added users table & auth endpoints |
| `database/school.db` | ✅ Auto-created | SQLite database with users table |
| `docs/AUTHENTICATION_GUIDE.md` | ✅ Created | Detailed authentication guide |

---

## Troubleshooting

### Backend Connection Error
```
Error: Failed to connect to http://localhost:5000
```
**Solution**: Make sure Flask server is running:
```bash
python backend/01_app.py
```

### "Username already exists" on registration
**Solution**: Choose a different username - usernames must be unique

### Login fails with "Invalid username/email or password"
**Solution**: 
- Verify username/email is correct
- Check password case-sensitivity
- Ensure account was registered successfully

### User name not showing in topbar
**Solution**: 
- Open browser developer console (F12)
- Check for errors
- Refresh the page
- Try logging in again

---

## Next Steps

1. ✅ **Test the authentication system** with the steps above
2. ✅ **Create your admin account** and verify login works
3. ✅ **Test all dashboard features** (students, fees, attendance, etc.)
4. ✅ **Configure school settings** in the Settings tab
5. ⏳ **Add more user roles** (teacher, accountant, parent) in backend if needed

---

**Version**: 1.0.0  
**Last Updated**: February 27, 2026  
**Status**: ✅ Ready for Testing
