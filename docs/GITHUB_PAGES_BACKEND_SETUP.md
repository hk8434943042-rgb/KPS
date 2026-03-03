# GitHub Pages + Backend + Database Setup

## What is already configured

- Frontend auto-deploys to `gh-pages` from `frontend/` via workflow:
  - `.github/workflows/deploy-pages.yml`
- Backend auto-redeploy hook workflow is ready:
  - `.github/workflows/deploy-backend-railway.yml`
- Frontend can consume a hosted backend URL from `window.__API_BASE_URL`.

## 1) Keep frontend auto-live on GitHub Pages

Your live site URL:

- `https://hk8434943042-rgb.github.io/KPS/`

Every push to `main` that changes `frontend/*` redeploys automatically.

## 2) Deploy backend + database on Railway

1. Create Railway project from this GitHub repo.
2. Add a **Volume** mounted at `/data`.
3. Set these variables in Railway:
   - `SECRET_KEY` = long random string
   - `DATABASE_URL` = `sqlite:////data/school.db`
4. Confirm start command (or Procfile usage):
   - `cd backend && gunicorn 01_app:app --bind 0.0.0.0:$PORT`
5. Deploy and copy backend URL (example):
   - `https://your-backend-name.up.railway.app`

## 3) Connect frontend to backend

Add this GitHub repo secret:

- `BACKEND_API_URL` = `https://your-backend-name.up.railway.app`

The Pages workflow writes `frontend/api-config.js` during deployment, so frontend uses:

- `https://your-backend-name.up.railway.app/api`

## 4) Enable backend auto-redeploy from GitHub

In Railway service settings, create a Deploy Hook URL and add repo secret:

- `RAILWAY_DEPLOY_HOOK_URL` = `<your_railway_deploy_hook_url>`

Then backend changes in `backend/**` or `database/**` trigger Railway redeploy automatically.
