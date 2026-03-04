@echo off
REM Mirror Project from C:\ to D:\ Drive Launcher

cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0mirror-project.ps1"
pause
