@echo off
REM ════════════════════════════════════════════════════════════════
REM EMERGENCY RESTORE - RECOVER FROM BACKUP
REM ════════════════════════════════════════════════════════════════
REM Use this if your system crashed or you need to restore old data

setlocal enabledelayedexpansion
cd /d "%~dp0"

cls
echo.
echo ════════════════════════════════════════════════════════════════
echo        SCHOOL ADMIN PORTAL - EMERGENCY RESTORE SYSTEM
echo ════════════════════════════════════════════════════════════════
echo.

REM Check if backups exist
if not exist "backups\full" (
    echo ❌ ERROR: No backups found!
    echo.
    echo Please create a backup first by running EMERGENCY_BACKUP.bat
    echo.
    pause
    exit /b 1
)

REM List all available backups
echo 📋 Available Backups:
echo.
setlocal enabledelayedexpansion
set count=0
for /f "delims=" %%F in ('dir /b /o-d backups\full\*.zip 2^>nul') do (
    set /a count+=1
    set "backup[!count!]=%%F"
    for /f %%Z in ('dir /s backups\full\%%F ^| find "Bytes"') do set "size[!count!]=%%Z"
    echo !count!) %%F (%size[!count!]%)
)

if %count%==0 (
    echo ❌ No backup files found in backups\full\
    echo.
    pause
    exit /b 1
)

echo.
echo.
set /p selection="Enter the number of the backup to restore (1-%count%): "

REM Validate selection
if not defined backup[%selection%] (
    echo ❌ Invalid selection!
    pause
    exit /b 1
)

set selected_backup=!backup[%selection%]!

echo.
echo ⚠️  WARNING!
echo ════════════════════════════════════════════════════════════════
echo This will RESTORE your entire project from: %selected_backup%
echo.
echo All current files will be replaced!
echo.
set /p confirm="Are you SURE? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo Restore cancelled.
    pause
    exit /b 0
)

echo.
echo 💾 Creating safety backup before restore...

REM Create a safety backup first
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a-%%b)
set timestamp=%mydate%_%mytime%
set safety_backup=backups\full\SAFETY_BACKUP_BEFORE_RESTORE_%timestamp%.zip

echo Creating safety backup: %safety_backup%

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  try { ^
    Add-Type -AssemblyName System.IO.Compression.FileSystem; ^
    [System.IO.Compression.ZipFile]::CreateFromDirectory('.', '%safety_backup%'); ^
    Write-Host '✅ Safety backup created' -ForegroundColor Green; ^
  } catch { ^
    Write-Host "⚠️  Could not create safety backup: $_" -ForegroundColor Yellow; ^
  }

echo.
echo 📦 Restoring from backup...
echo.

REM Extract the backup
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  try { ^
    Add-Type -AssemblyName System.IO.Compression.FileSystem; ^
    $BackupPath = 'backups\full\%selected_backup%'; ^
    [System.IO.Compression.ZipFile]::ExtractToDirectory($BackupPath, '.', $true); ^
    Write-Host '✅ Restore completed successfully!' -ForegroundColor Green; ^
  } catch { ^
    Write-Host "❌ Restore failed: $_" -ForegroundColor Red; ^
    exit 1; ^
  }

if errorlevel 1 (
    echo.
    echo ❌ RESTORE FAILED!
    echo A safety backup was created at: %safety_backup%
    echo.
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════════
echo ✅ RESTORE COMPLETE!
echo ════════════════════════════════════════════════════════════════
echo.
echo ⚡ IMPORTANT - Next Steps:
echo   1. The database has been restored
echo   2. If the backend server is running, please RESTART it
echo   3. Refresh your web browser to see the restored data
echo.
echo 📍 To restart the backend:
echo   - Open a PowerShell window in the 'backend' folder
echo   - Run: python 01_app.py
echo.
echo 🛡️  Your old data is safe! Safety backup saved at:
echo    %safety_backup%
echo.
echo ════════════════════════════════════════════════════════════════
pause
