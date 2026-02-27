# 🚀 Deploy to Railway.app (GitHub Integration)

## Complete Deployment Guide

### Prerequisites
1. GitHub account (free)
2. Railway.app account (free tier available)
3. Code already prepared on GitHub

---

## Step 1: Initialize Git Repository

Open terminal in your project folder:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: School Admin Portal with database"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/school-admin-portal.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `school-admin-portal`
3. Description: `School Admin Portal - Students, Teachers, Attendance & Payments`
4. Choose "Public" or "Private"
5. Click "Create repository"
6. Follow the instructions to push your code

**Copy the repository URL:** `https://github.com/YOUR_USERNAME/school-admin-portal.git`

---

## Step 3: Deploy on Railway.app

### Option A: Direct GitHub Integration (Recommended)

1. **Go to Railway.app**
   - Visit https://railway.app
   - Sign in with GitHub (click "Start with GitHub")
   - Authorize Railway to access your GitHub account

2. **Create New Project**
   - Click "Create New"
   - Select "Deploy from GitHub repo"

3. **Select Your Repository**
   - Find and click `school-admin-portal`
   - Railway will auto-detect it's a Python Flask app

4. **Configure Environment**
   - Railway will automatically:
     - Create a PostgreSQL database (free tier)
     - Set up environment variables
     - Configure the PORT variable

5. **Deploy**
   - Click "Deploy"
   - Wait 2-5 minutes for deployment
   - You'll get a public URL like: `https://school-admin-portal-production.up.railway.app`

---

## Step 4: Update API Base URL

After deployment, update your frontend to use the new URL:

### In `script.js` or your frontend:

```javascript
// OLD (localhost):
const API_URL = 'http://localhost:5000';

// NEW (Railway):
const API_URL = 'https://school-admin-portal-production.up.railway.app';

// Or make it dynamic:
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000'
  : 'https://school-admin-portal-production.up.railway.app';
```

---

## Step 5: Test Your Deployed API

Once deployed, test endpoints:

```bash
# Health check
curl https://school-admin-portal-production.up.railway.app/health

# Get students
curl https://school-admin-portal-production.up.railway.app/api/students

# Dashboard stats
curl https://school-admin-portal-production.up.railway.app/api/stats/dashboard
```

---

## File Structure (Important for Deployment)

```
school-admin-portal/
├── 01_app.py                 ← Main Flask app
├── requirements.txt          ← Python dependencies
├── Procfile                  ← Railway config
├── .gitignore               ← Git ignore rules
│
├── DATABASE_API.md
├── DATABASE_SETUP.md
├── load_sample_data.py
├── verify_db.py
│
├── index.html               ← Frontend
├── script.js
├── style.css
│
└── assets/                  ← Images/static files
```

---

## Deployed API Endpoints

After deployment, your API will be available at:
```
https://your-project-name.up.railway.app/api/[endpoint]
```

Examples:
```
GET  https://school-admin-portal-xyz.up.railway.app/api/students
POST https://school-admin-portal-xyz.up.railway.app/api/students
GET  https://school-admin-portal-xyz.up.railway.app/api/stats/dashboard
```

---

## Continuous Deployment (Auto-Redeploy)

Railway automatically redeploys when you:

1. Push to GitHub:
```bash
git add .
git commit -m "Update API features"
git push origin main
```

2. Railway will:
   - Detect the changes
   - Run `pip install -r requirements.txt`
   - Run `gunicorn 01_app:app` (from Procfile)
   - Deploy automatically

---

## Environment Variables on Railway

You can set environment variables in Railway dashboard:

1. Go to your project on Railway
2. Click "Variables"
3. Add:
   - `FLASK_ENV` = `production`
   - `DATABASE_URL` = (auto-set by Railway)
   - Custom variables as needed

---

## Monitoring & Logs

In Railway dashboard:

1. **View Logs**: Real-time application logs
2. **Monitor**: CPU, Memory usage
3. **Deployments**: Previous deployment history
4. **Settings**: Domain, env variables, rebuilds

---

## Database

Railway provides:
- **Free PostgreSQL database** provisioned automatically
- Alternative: Keep SQLite (file-based, data persists)
- Data persists across deployments

To use PostgreSQL instead:
```bash
pip install psycopg2-binary SQLAlchemy
```

---

## Custom Domain (Optional)

1. In Railway dashboard → Project Settings
2. Add custom domain (e.g., `school-api.yourdomain.com`)
3. Update DNS records with CNAME provided

---

## Free Tier & Limits

**Railway Free Tier:**
- 5GB/month compute
- Enough for demo/testing
- Free PostgreSQL with 100 connections
- Automatic SSL/HTTPS
- Custom domains available

Pricing: $5/month paid tier for production

---

## Troubleshooting

### Build fails: "ModuleNotFoundError"
→ Add to `requirements.txt` and push

### API returns 500 error
→ Check logs in Railway dashboard

### Database issues
→ Railway auto-provisions database, check dashboard

### Slow deployment
→ Normal: first deploy takes 3-5 minutes

---

## Local Development (Still Works)

You can still develop locally:

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
python 01_app.py

# Test: http://localhost:5000
```

Changes pushed to GitHub will auto-deploy to Railway.

---

## Complete Workflow

```
Local Development:
┌─ Edit code in VS Code
├─ git add .
├─ git commit -m "message"
├─ git push origin main
│
GitHub:
├─ Repository updated
│
Railway:
├─ Detects GitHub changes
├─ Pulls latest code
├─ Runs: pip install -r requirements.txt
├─ Runs: gunicorn 01_app:app
└─ URL: https://school-admin-portal-xyz.up.railway.app

Live API:
└─ Access your deployed API
```

---

## Summary of URLs

| System | URL |
|--------|-----|
| **GitHub** | `https://github.com/YOUR_USERNAME/school-admin-portal` |
| **Railway** | `https://school-admin-portal-xyz.up.railway.app` |
| **API Root** | `https://school-admin-portal-xyz.up.railway.app/api` |
| **Localhost** | `http://localhost:5000` |

---

## Next Steps

1. ✅ Push code to GitHub
   ```bash
   git push origin main
   ```

2. ✅ Sign up on Railway.app with GitHub

3. ✅ Deploy: Select your repository

4. ✅ Get your Railway URL

5. ✅ Update frontend API_URL

6. ✅ Test the live API

7. ✅ Deploy frontend (use Railway, Vercel, or GitHub Pages)

---

**Your app is ready for the cloud! 🌐**
