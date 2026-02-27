@echo off
REM Quick Database Backup Script for Windows
REM Double-click this file to create a backup instantly

echo.
echo ========================================
echo   School Admin Portal - Quick Backup
echo ========================================
echo.

cd /d "%~dp0"
python backup_database.py

echo.
pause
