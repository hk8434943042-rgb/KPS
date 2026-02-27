# Authentication System Guide

## Overview

The School Admin Portal now includes a complete authentication system with user registration and login functionality.

## Features

✅ **User Registration** - Create new admin accounts with email and password  
✅ **Secure Login** - Login with username or email  
✅ **Session Management** - Secure session handling with browser storage  
✅ **Password Security** - PBKDF2-SHA256 password hashing  
✅ **User Profile** - Display logged-in user's name in the dashboard  
✅ **Logout Function** - Secure logout with session clearing

## How to Use

### 1. **First Time Setup: Create Admin Account**

When you first access the portal:

1. Open `frontend/login.html` in your browser
2. Click on the **"Register"** tab
3. Fill in the registration form:
   - **Full Name**: Your name
   - **Username**: Choose a unique username
   - **Email**: Your email address
   - **Password**: Create a strong password (minimum 6 characters)
   - **Confirm Password**: Re-enter your password
4. Click **"Create Account"**
5. After successful registration, you'll be automatically directed to the login form
6. Enter your credentials to login

### 2. **Login to Existing Account**

1. Open `frontend/login.html`
2. Click on the **"Login"** tab (default)
3. Enter either:
   - Username OR Email address
   - Password
4. Click **"Sign In"**
5. Upon successful login, you'll be redirected to the main admin dashboard

### 3. **Logging Out**

1. Click the **"🚪 Logout"** button in the top-right corner
2. Confirm the logout by clicking "Yes" when prompted
3. You'll be redirected to the login page

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,           -- Unique login username
    email TEXT UNIQUE NOT NULL,              -- Unique email address
    password_hash TEXT NOT NULL,             -- Hashed password (PBKDF2-SHA256)
    full_name TEXT,                          -- User's full name
    role TEXT DEFAULT 'admin',               -- User role (admin/teacher/accountant)
    is_active BOOLEAN DEFAULT 1,             -- Account active status
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

All authentication endpoints are available at `http://localhost:5000/api/auth/`

### 1. **Register**
```
POST /api/auth/register
Content-Type: application/json

{
  "username": "admin123",
  "email": "admin@school.com",
  "password": "MyPassword123",
  "full_name": "School Admin"
}

Response (201):
{
  "success": true,
  "message": "User registered successfully",
  "user_id": 1
}
```

### 2. **Login**
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin123",        // or use email
  "password": "MyPassword123"
}

Response (200):
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "admin123",
    "email": "admin@school.com",
    "full_name": "School Admin",
    "role": "admin"
  }
}
```

### 3. **Get Current User**
```
GET /api/auth/me

Response (200):
{
  "id": 1,
  "username": "admin123",
  "email": "admin@school.com",
  "full_name": "School Admin",
  "role": "admin",
  "is_active": 1,
  "created_at": "2026-02-27T10:30:00"
}
```

### 4. **Verify Authentication**
```
GET /api/auth/verify

Response (200):
{
  "authenticated": true,
  "user": { ... }
}
```

### 5. **Logout**
```
POST /api/auth/logout

Response (200):
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Security Features

### Password Security
- Passwords are hashed using **PBKDF2-HMAC-SHA256** with 100,000 iterations
- Each password has a unique salt
- Passwords are never stored in plain text
- Password verification is performed securely

### Session Management
- Authentication tokens stored in browser's localStorage
- User data is not exposed in localStorage (only user ID and username)
- Automatic session validation on page load
- Session cleared on logout

### Access Control
- Users must be logged in to access the admin dashboard
- Unauthorized users are redirected to login page
- All API endpoints can be secured with role-based access (admin/teacher/accountant)

## Default Test Account

For development/testing, you can create accounts with:
- **Username**: `admin`
- **Email**: `admin@school.com`
- **Password**: `admin123` (or any password)

## Troubleshooting

### "Invalid username/email or password" Error
- Ensure username or email is spelled correctly
- Check that you're using the correct password
- Remember that passwords are case-sensitive
- Verify that the account exists and is active

### "Username or email already exists"
- The username or email is already registered
- Use a different username or email
- If needed, contact the system administrator to reset the account

### Session Lost / Redirected to Login
- Your session may have expired
- Your browser's localStorage may have been cleared
- Try logging in again
- Check that cookies are enabled in your browser

### Backend Connection Error
- Ensure the Flask backend is running on `http://localhost:5000`
- Check the terminal for any Flask errors
- Verify that CORS is enabled in the backend

## File Locations

| File | Purpose |
|------|---------|
| `frontend/login.html` | Complete login & registration UI |
| `frontend/index.html` | Main admin dashboard (requires login) |
| `frontend/script.js` | Frontend logic including auth checks |
| `backend/01_app.py` | Flask backend with auth endpoints |
| `database/school.db` | SQLite database with users table |

## Next Steps

1. ✅ Create a user account through registration
2. ✅ Login to the admin portal
3. ✅ Add students, teachers, and manage fees
4. ✅ Track attendance and exams
5. ✅ Configure school settings and print receipts

## Support

For issues or questions:
1. Check this guide
2. Review the API endpoints
3. Check browser console for error messages
4. Verify backend is running and accessible

---

**Version**: 1.0.0  
**Last Updated**: February 27, 2026
