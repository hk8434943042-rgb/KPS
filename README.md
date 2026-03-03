# School Admin Portal

This project was organized to keep the root clean and easier to manage.

## Project Structure

- `backend/` — Flask backend APIs and server logic
- `frontend/` — HTML/CSS/JS admin portal UI
- `database/` — DB scripts, backup/restore, health and setup helpers
- `docs/` — product and setup documentation
  - `docs/root-guides/` — moved root-level guides for cleaner organization
- `scripts/` — utility scripts
  - `scripts/debug-tests/` — moved debug and test scripts

## Relocated Files

### Guides moved to `docs/root-guides/`
- `docs/root-guides/DATABASE_GUIDE.md`
- `docs/root-guides/IMPLEMENTATION_SUMMARY.md`
- `docs/root-guides/LOGIN_DATABASE_SETUP.md`
- `docs/root-guides/QUICK_START.md`
- `docs/root-guides/THERMAL_PRINTER_IMPLEMENTATION.md`
- `docs/root-guides/THERMAL_PRINTER_QUICKSTART.md`
- `docs/root-guides/TRANSPORT_FEE_SETUP.md`

### Debug/Test scripts moved to `scripts/debug-tests/`
- `scripts/debug-tests/check_routes.py`
- `scripts/debug-tests/debug_api.py`
- `scripts/debug-tests/run_debug.py`
- `scripts/debug-tests/verify_deployment.py`
- `scripts/debug-tests/test_api.py`
- `scripts/debug-tests/test_direct.py`
- `scripts/debug-tests/test_http_post.py`
- `scripts/debug-tests/test_minimal.py`
- `scripts/debug-tests/test_post.py`
- `scripts/debug-tests/test_student_post.py`
- `scripts/debug-tests/test_add_student.ps1`

## Common Entry Points

- Main backend app: `backend/app.py` and `backend/01_app.py`
- Frontend entry page: `frontend/index.html`

## Notes

If any old script/command still references former root paths, update it to the new locations above.

## Hosting (Frontend + Backend)

- Frontend (GitHub Pages): `https://hk8434943042-rgb.github.io/KPS/`
- Backend health: ![Backend Health](https://github.com/hk8434943042-rgb/KPS/actions/workflows/backend-health-check.yml/badge.svg)
- Full setup guide: `docs/GITHUB_PAGES_BACKEND_SETUP.md`
- Backend + DB hosting is configured for Railway-compatible deployment using:
  - `Procfile`
  - `requirements.txt` (root, delegating to backend)
  - `.github/workflows/deploy-backend-railway.yml`
  - `.github/workflows/backend-health-check.yml`
  - `.github/workflows/backend-health-alerts.yml`
  - `.github/workflows/backend-health-check.yml`

Set repo secret `BACKEND_API_URL` (example: `https://your-backend.up.railway.app`) to enable the health check.
