@echo off
REM Quick Deployment Checker for PythonAnywhere
REM Run this before deploying to verify everything is ready

echo.
echo ============================================================
echo PYTHONANYWHERE DEPLOYMENT CHECKER
echo ============================================================
echo.

cd /d "%~dp0\.."

python scripts\check-deployment-ready.py

echo.
pause
