@echo off
REM Quick Backup Launcher for D:\ Drive
REM Double-click to open menu

:menu
cls
echo.
echo ════════════════════════════════════════════════════════════
echo              D:\ DRIVE BACKUP LAUNCHER
echo ════════════════════════════════════════════════════════════
echo.
echo Choose an option:
echo.
echo 1) Create FULL Backup (all files)
echo 2) Create QUICK Backup (database only)
echo 3) List existing backups
echo 4) Restore from backup
echo 5) Verify backup integrity
echo 6) Clean old backups (keep last 5)
echo 7) Schedule automatic backups
echo 8) Exit
echo.

set /p choice="Enter your choice (1-8): "

if "%choice%"=="1" goto full_backup
if "%choice%"=="2" goto quick_backup
if "%choice%"=="3" goto list_backups
if "%choice%"=="4" goto restore_backup
if "%choice%"=="5" goto verify_backup
if "%choice%"=="6" goto clean_backups
if "%choice%"=="7" goto schedule_backup
if "%choice%"=="8" goto exit

echo Invalid choice. Please try again.
timeout /t 2
goto menu

:full_backup
cls
echo.
echo Starting FULL BACKUP...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-to-external-ssd.ps1" -Full
pause
goto menu

:quick_backup
cls
echo.
echo Starting QUICK BACKUP...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-to-external-ssd.ps1" -Quick
pause
goto menu

:list_backups
cls
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-to-external-ssd.ps1" -List
pause
goto menu

:restore_backup
cls
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-to-external-ssd.ps1" -Restore
pause
goto menu

:verify_backup
cls
echo.
echo Verifying backup...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-to-external-ssd.ps1" -Verify
pause
goto menu

:clean_backups
cls
echo.
echo Cleaning old backups...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-to-external-ssd.ps1" -Clean
pause
goto menu

:schedule_backup
cls
echo.
echo ════════════════════════════════════════════════════════════
echo       SCHEDULE AUTOMATIC BACKUPS (Requires Admin)
echo ════════════════════════════════════════════════════════════
echo.
echo 1) Daily backups at 10 PM
echo 2) Weekly backups (Friday 10 PM)
echo 3) Monthly backups (1st at 2 AM)
echo.
set /p sched="Enter your choice (1-3): "

if "%sched%"=="1" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule-backup-task.ps1" -Schedule Daily -Hour 22
)
if "%sched%"=="2" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule-backup-task.ps1" -Schedule Weekly -DayOfWeek Fri -Hour 22
)
if "%sched%"=="3" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule-backup-task.ps1" -Schedule Monthly -Hour 02
)

pause
goto menu

:exit
echo.
echo Exiting...
timeout /t 1
exit /b
