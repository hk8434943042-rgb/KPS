@echo off
REM ════════════════════════════════════════════════════════════════
REM EMERGENCY BACKUP - ONE CLICK BACKUP SOLUTION
REM ════════════════════════════════════════════════════════════════
REM Just double-click this file to create an instant backup!
REM If your computer crashes, you can easily restore from backups

setlocal enabledelayedexpansion
cd /d "%~dp0"

cls
echo.
echo ════════════════════════════════════════════════════════════════
echo          SCHOOL ADMIN PORTAL - EMERGENCY BACKUP SYSTEM
echo ════════════════════════════════════════════════════════════════
echo.
echo Creating a complete backup of your entire project...
echo This may take a few moments depending on project size.
echo.

REM Create timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a-%%b)
set timestamp=%mydate%_%mytime%

REM Create backup directory structure
if not exist "backups\full" mkdir "backups\full"

REM Define backup filename and path
set backup_filename=school-admin-portal_BACKUP_%timestamp%.zip
set backup_path=backups\full\%backup_filename%

echo 📦 Backup File: %backup_filename%
echo 📁 Saving to: backups\full\
echo.

REM Create backup using PowerShell (works on all Windows versions)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  $ErrorActionPreference = 'Stop'; ^
  $SourcePath = Get-Item -Path '.'; ^
  $BackupPath = '%backup_path%'; ^
  try { ^
    Add-Type -AssemblyName System.IO.Compression.FileSystem; ^
    $Compress = @{ ^
      Path = @('.'); ^
      DestinationPath = $BackupPath; ^
      CompressionLevel = 'Optimal'; ^
      Force = $true; ^
    }; ^
    [System.IO.Compression.ZipFile]::CreateFromDirectory($SourcePath, $BackupPath); ^
    Write-Host '✅ Backup created successfully!' -ForegroundColor Green; ^
    $Size = (Get-Item $BackupPath).Length / 1MB; ^
    Write-Host "📊 Backup Size: $([math]::Round($Size, 2)) MB" -ForegroundColor Green; ^
  } catch { ^
    Write-Host "❌ Error: $_" -ForegroundColor Red; ^
    exit 1; ^
  }

if errorlevel 1 (
    echo.
    echo ❌ BACKUP FAILED - Please check the error message above
    echo.
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════════
echo ✅ BACKUP COMPLETE!
echo ════════════════════════════════════════════════════════════════
echo.
echo Your backup has been saved to: backups\full\
echo.
echo 📝 IMPORTANT TIPS:
echo   • Copy this backup to a USB drive or cloud storage for safety
echo   • Keep multiple backups from different dates
echo   • To restore: Use EMERGENCY_RESTORE.bat
echo.
echo ════════════════════════════════════════════════════════════════
pause
