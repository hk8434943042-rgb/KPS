# Schedule Automatic Backups to D:\ 
# Creates Windows Task Scheduler job for daily/weekly backups

param(
    [ValidateSet("Daily", "Weekly", "Monthly")]
    [string]$Schedule = "Daily",
    [int]$Hour = 22,  # 10 PM
    [ValidateSet("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")]
    [string]$DayOfWeek = "Fri"  # Friday for weekly
)

$ScriptPath = Split-Path -Parent $PSScriptRoot
$BackupScript = Join-Path $ScriptPath "scripts\backup-to-external-ssd.ps1"
$TaskName = "School-Admin-Portal-Backup-$Schedule"
$TaskDescription = "Automatic backup of School Admin Portal to D:\ drive"

# Check if running as admin
$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $IsAdmin) {
    Write-Host "❌ ERROR: This script requires Administrator privileges."
    Write-Host "Please run PowerShell as Administrator and try again."
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗"
Write-Host "║         SCHEDULE AUTOMATIC BACKUPS TO D:\ DRIVE               ║"
Write-Host "╚════════════════════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "Schedule: $Schedule at $($Hour):00"

# Remove existing task if it exists
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "Removing existing task: $TaskName"
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create task action
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$BackupScript`" -Quick"

# Create task trigger based on schedule
switch ($Schedule) {
    "Daily" {
        $Trigger = New-ScheduledTaskTrigger -Daily -At "$($Hour):00"
        Write-Host "⏰ Scheduled for: Daily at $($Hour):00"
    }
    "Weekly" {
        $Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $DayOfWeek -At "$($Hour):00"
        Write-Host "⏰ Scheduled for: Every $DayOfWeek at $($Hour):00"
    }
    "Monthly" {
        $Trigger = New-ScheduledTaskTrigger -Monthly -DaysOfMonth 1 -At "$($Hour):00"
        Write-Host "⏰ Scheduled for: 1st of every month at $($Hour):00"
    }
}

# Create task settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -Compatibility Win8 `
    -RunOnlyIfNetworkAvailable `
    -StartWhenAvailable

# Register the task
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Description $TaskDescription `
        -RunLevel Highest | Out-Null
    
    Write-Host ""
    Write-Host "✅ Task created successfully!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "📋 Task Name: $TaskName"
    Write-Host "📝 Backup Type: Quick (Database only)"
    Write-Host "📂 Destination: D:\"
    Write-Host ""
    Write-Host "⚙️  Manage this task in Windows Task Scheduler:"
    Write-Host "   (Press Windows + R) → taskschd.msc"
    Write-Host ""
}
catch {
    Write-Host "❌ Failed to create task: $_"
    exit 1
}
