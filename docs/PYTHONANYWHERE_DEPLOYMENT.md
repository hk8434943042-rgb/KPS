# PythonAnywhere Deployment Guide

Complete step-by-step guide to deploy your School Admin Portal to PythonAnywhere.

---

## 📋 Prerequisites

- GitHub account (to push your code)
- PythonAnywhere account (free tier)
- Your Razorpay API keys (if using payments)

---

## 🚀 STEP 1: Prepare Your Code

### 1.1 Create .env file for secrets

Create a `.env` file in your project root (if you haven't already):

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Email Configuration (if using OTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Session Secret
SECRET_KEY=your_secret_key_here

# Environment
FLASK_ENV=production
```

**IMPORTANT:** Add `.env` to `.gitignore` to keep secrets safe!

### 1.2 Push to GitHub

```powershell
# Initialize git (if not already done)
git init
git add .
git commit -m "Prepare for PythonAnywhere deployment"

# Create repo on GitHub and push
git remote add origin https://github.com/YOUR_USERNAME/school-admin-portal.git
git push -u origin main
```

---

## 🌐 STEP 2: Sign Up for PythonAnywhere

1. Go to: https://www.pythonanywhere.com
2. Click **"Pricing & signup"**
3. Select **"Create a Beginner account"** (FREE)
4. Complete registration
5. Verify your email

---

## 💻 STEP 3: Set Up Your Web App

### 3.1 Open Bash Console

1. In PythonAnywhere dashboard, click **"Consoles"**
2. Click **"Bash"** to start a new console

### 3.2 Clone Your Repository

```bash
# Clone your GitHub repository
git clone https://github.com/YOUR_USERNAME/school-admin-portal.git
cd school-admin-portal
```

### 3.3 Create Virtual Environment

```bash
# Create virtual environment
mkvirtualenv --python=/usr/bin/python3.10 school-portal-env

# Activate it (should auto-activate, but if not)
workon school-portal-env
```

### 3.4 Install Dependencies

```bash
# Install required packages
pip install -r requirements.txt
```

### 3.5 Set Up Database

```bash
# Make sure database directory exists
mkdir -p database

# If you have existing database, it's already in the repo
# Otherwise, initialize a new one
cd database
python ../backend/check_schema.py
cd ..
```

---

## 🔧 STEP 4: Configure Web App

### 4.1 Create Web App

1. Go to **"Web"** tab in PythonAnywhere dashboard
2. Click **"Add a new web app"**
3. Choose **"Manual configuration"** (NOT Flask wizard)
4. Select **Python 3.10**
5. Click **Next**

### 4.2 Configure WSGI File

1. In the Web tab, find **"Code"** section
2. Click on the WSGI configuration file link (e.g., `/var/www/YOUR_USERNAME_pythonanywhere_com_wsgi.py`)
3. **DELETE everything** in the file
4. **Copy and paste** the contents from your `wsgi.py` file
5. **IMPORTANT:** Replace `YOUR_USERNAME` with your actual PythonAnywhere username
6. Click **Save**

**Example WSGI configuration:**
```python
import sys
import os

# Replace YOUR_USERNAME with your actual username!
project_home = '/home/YOUR_USERNAME/school-admin-portal'
if project_home not in sys.path:
    sys.path = [project_home] + sys.path

backend_path = os.path.join(project_home, 'backend')
if backend_path not in sys.path:
    sys.path = [backend_path] + sys.path

os.chdir(project_home)

os.environ['DATABASE_URL'] = 'sqlite:///database/school.db'
os.environ['FLASK_ENV'] = 'production'

from dotenv import load_dotenv
env_path = os.path.join(project_home, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

from backend.app import app as application
```

### 4.3 Configure Virtual Environment

1. In the Web tab, find **"Virtualenv"** section
2. Enter: `/home/YOUR_USERNAME/.virtualenvs/school-portal-env`
3. (Replace YOUR_USERNAME with your actual username)

### 4.4 Set Up Environment Variables

**Option A: Using .env file (Recommended)**

In Bash console:
```bash
cd ~/school-admin-portal
nano .env
```

Paste your environment variables:
```
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
SECRET_KEY=your_secret_key
EMAIL_USER=your_email
EMAIL_PASSWORD=your_password
FLASK_ENV=production
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

**Option B: Using PythonAnywhere environment variables**

1. In Web tab, scroll to **"Environment variables"** section
2. Add each variable:
   - Name: `RAZORPAY_KEY_ID`, Value: `your_key`
   - Name: `RAZORPAY_KEY_SECRET`, Value: `your_secret`
   - Name: `SECRET_KEY`, Value: `your_secret_key`
   - etc.

### 4.5 Configure Static Files (Optional)

If you want to serve frontend from PythonAnywhere too:

1. In Web tab, scroll to **"Static files"** section
2. Add mapping:
   - URL: `/`
   - Directory: `/home/YOUR_USERNAME/school-admin-portal/frontend`

---

## ▶️ STEP 5: Launch Your App

1. In the Web tab, click the big green **"Reload YOUR_USERNAME.pythonanywhere.com"** button
2. Wait 10-20 seconds
3. Click the link to visit your site: `https://YOUR_USERNAME.pythonanywhere.com`

---

## 🔍 STEP 6: Test Your Deployment

### 6.1 Test Backend API

Open: `https://YOUR_USERNAME.pythonanywhere.com/api/health`

Should return:
```json
{
  "status": "healthy",
  "database": "connected",
  "environment": "production"
}
```

### 6.2 Test Login Page

If hosting frontend on PythonAnywhere, visit:
`https://YOUR_USERNAME.pythonanywhere.com`

### 6.3 Check Error Logs

If something doesn't work:

1. In Web tab, click **"Log files"** section
2. Check:
   - **Error log** - Shows Python errors
   - **Server log** - Shows request logs

---

## 🔄 STEP 7: Update Your Frontend API URL

### 7.1 Update api-config.js

Edit `frontend/api-config.js`:

```javascript
const API_CONFIG = {
    // PythonAnywhere Backend URL
    BASE_URL: 'https://YOUR_USERNAME.pythonanywhere.com',
    
    // Endpoints
    ENDPOINTS: {
        // ... existing endpoints
    }
};
```

Replace `YOUR_USERNAME` with your actual PythonAnywhere username.

### 7.2 If Frontend is Hosted Elsewhere

If your frontend is on GitHub Pages or local:

1. Update CORS settings in `backend/app.py` to allow your frontend domain
2. Push changes to GitHub
3. Pull changes on PythonAnywhere:
   ```bash
   cd ~/school-admin-portal
   git pull origin main
   ```
4. Reload web app

---

## 📊 STEP 8: Database Backup Setup

### 8.1 Manual Backup

In Bash console:
```bash
cd ~/school-admin-portal/database
python backup_database.py
```

Backups saved to: `database/backups/`

### 8.2 Scheduled Daily Backup (Free Tier: 1 task)

1. Go to **"Tasks"** tab
2. Schedule a daily task:
   - Time: `03:00` (3 AM UTC)
   - Command: `/home/YOUR_USERNAME/.virtualenvs/school-portal-env/bin/python /home/YOUR_USERNAME/school-admin-portal/database/backup_database.py`

### 8.3 Download Backups to Your PC

```bash
# In bash console
cd ~/school-admin-portal/database/backups
ls -lh
```

Use the **"Files"** tab to browse and download backup files to your PC.

---

## 🔐 Security Checklist

- ✅ `.env` file not in GitHub (check `.gitignore`)
- ✅ HTTPS enabled (automatic on PythonAnywhere)
- ✅ Database file not publicly accessible
- ✅ Strong SECRET_KEY set
- ✅ CORS properly configured
- ✅ Production mode (`FLASK_ENV=production`)

---

## 🛠️ Common Issues & Solutions

### Issue 1: "502 Bad Gateway"
**Solution:** Check WSGI configuration, ensure username is correct

### Issue 2: "ImportError: No module named 'flask'"
**Solution:** Ensure virtualenv is configured correctly in Web tab

### Issue 3: Database errors
**Solution:** 
```bash
cd ~/school-admin-portal/database
python check_schema.py
python verify_db.py
```

### Issue 4: CORS errors from frontend
**Solution:** Check `CORS(app)` in `backend/app.py`, may need to specify origins:
```python
CORS(app, origins=['https://your-frontend-domain.com'])
```

### Issue 5: Razorpay webhook failures
**Solution:** Free tier can't receive webhooks from external APIs. Upgrade to $5/month plan or use manual payment verification.

---

## 📈 Monitoring & Maintenance

### Daily Checks
- Check error logs for issues
- Verify database backups

### Weekly Tasks
- Download database backup to local PC
- Check disk usage (500 MB limit on free tier)

### Monthly Tasks
- Log in to keep account active (required every 3 months)
- Review and clean old backup files

---

## 💰 When to Upgrade ($5/month)

Upgrade if you need:
- ✅ Custom domain (www.yourschool.com)
- ✅ More CPU time (free tier limited)
- ✅ External API webhooks (Razorpay callbacks)
- ✅ More scheduled tasks (>1)
- ✅ Access to any external website (not just whitelisted)
- ✅ SSH access

---

## 🔄 Updating Your App

### When you make code changes:

**On Your PC:**
```powershell
git add .
git commit -m "Updated features"
git push origin main
```

**On PythonAnywhere (Bash console):**
```bash
cd ~/school-admin-portal
git pull origin main
pip install -r requirements.txt  # if requirements changed
```

**In Web tab:**
- Click **"Reload"** button

---

## 🎯 Quick Reference

| Item | Value |
|------|-------|
| **Web URL** | `https://YOUR_USERNAME.pythonanywhere.com` |
| **Project Path** | `/home/YOUR_USERNAME/school-admin-portal` |
| **Database** | `/home/YOUR_USERNAME/school-admin-portal/database/school.db` |
| **Virtualenv** | `/home/YOUR_USERNAME/.virtualenvs/school-portal-env` |
| **Error Logs** | Web tab → Log files section |
| **Bash Console** | Consoles tab → Bash |

---

## 📞 Support

- PythonAnywhere Forums: https://www.pythonanywhere.com/forums/
- PythonAnywhere Help: https://help.pythonanywhere.com/
- Your deployment docs: `docs/` folder

---

## ✅ Deployment Complete!

Your School Admin Portal is now live at:
**`https://YOUR_USERNAME.pythonanywhere.com`**

Remember to:
1. Update frontend API URL
2. Test all features
3. Set up daily backups
4. Keep local backup copy
5. Log in every 3 months to keep account active

---

*Last updated: March 2026*
