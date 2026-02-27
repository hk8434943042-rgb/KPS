@echo off
REM Database Maintenance Script
REM Run this weekly to keep database healthy

echo ============================================================
echo   SCHOOL ADMIN DATABASE MAINTENANCE
echo ============================================================
echo.

echo [1/3] Creating backup...
cd database
python backup_database.py
if errorlevel 1 (
    echo ERROR: Backup failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Running health check...
python health_check.py
if errorlevel 1 (
    echo ERROR: Health check failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Maintenance completed successfully!
echo.
echo ============================================================
echo   ALL TASKS COMPLETED
echo ============================================================
pause
