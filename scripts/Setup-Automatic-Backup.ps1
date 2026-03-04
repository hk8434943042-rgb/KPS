# ════════════════════════════════════════════════════════════════
# AUTOMATIC BACKUP SCHEDULER for School Admin Portal
# ════════════════════════════════════════════════════════════════
# This script sets up automatic daily backups on Windows Task Scheduler

param(
    [string]$BackupTime = "02:00",  # Default 2 AM
    [string]$BackupFrequency = "Daily"  # Daily or Weekly
)

# Check if running as admin
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again."
    exit 1
}

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backupScript = Join-Path $projectRoot "EMERGENCY_BACKUP.bat"

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host "     AUTOMATIC BACKUP SCHEDULER SETUP"
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host ""

if (-not (Test-Path $backupScript)) {
    Write-Host "❌ ERROR: EMERGENCY_BACKUP.bat not found at: $backupScript" -ForegroundColor Red
    exit 1
}

Write-Host "📝 Configuration:"
Write-Host "  • Backup Time: $BackupTime"
Write-Host "  • Frequency: $BackupFrequency"
Write-Host "  • Backup Script: $backupScript"
Write-Host ""

$taskName = "SchoolAdminPortal_AutomaticBackup"
$taskPath = "\SchoolAdminPortal\"

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  A backup task already exists!"
    Write-Host ""
    $response = Read-Host "Do you want to recreate it? (yes/no)"
    
    if ($response -eq "yes") {
        Write-Host "Removing existing task..."
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    } else {
        Write-Host "Setup cancelled."
        exit 0
    }
}

# Parse backup time
$timeParts = $BackupTime -split ":"
if ($timeParts.Count -ne 2) {
    Write-Host "❌ Invalid time format. Use HH:MM format (e.g., 02:00)"
    exit 1
}

$hour = [int]$timeParts[0]
$minute = [int]$timeParts[1]
$backupDateTime = Get-Date -Hour $hour -Minute $minute

# Create task action
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$backupScript`""

# Create task trigger based on frequency
if ($BackupFrequency -eq "Weekly") {
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At $backupDateTime
    Write-Host "Setting up WEEKLY backups every Monday at $BackupTime..."
} else {
    $trigger = New-ScheduledTaskTrigger -Daily -At $backupDateTime
    Write-Host "Setting up DAILY backups at $BackupTime..."
}

# Create task settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

# Create the task
try {
    Register-ScheduledTask -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Automatic backup for School Admin Portal - Creates full project backup" `
        -RunLevel Highest `
        -Force | Out-Null
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════════"
    Write-Host "✅ AUTOMATIC BACKUP SCHEDULED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════════════"
    Write-Host ""
    Write-Host "📋 Task Details:"
    Write-Host "  • Task Name: $taskName"
    Write-Host "  • Frequency: $BackupFrequency at $BackupTime"
    Write-Host "  • Backup Location: $projectRoot\backups\full\"
    Write-Host ""
    Write-Host "🔧 To manage this task:"
    Write-Host "  1. Open Windows Task Scheduler (taskschd.msc)"
    Write-Host "  2. Look for: SchoolAdminPortal_AutomaticBackup"
    Write-Host "  3. Right-click to Edit, Disable, or Delete"
    Write-Host ""
    Write-Host "⚠️  Important:"
    Write-Host "  • Make sure your computer is on at the scheduled time"
    Write-Host "  • For laptops, consider setting it to a time you're typically awake"
    Write-Host "  • Backups are stored in: backups\full\"
    Write-Host "  • Restore using: EMERGENCY_RESTORE.bat"
    Write-Host ""
    
} catch {
    Write-Host "❌ ERROR: Failed to create scheduled task!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host "════════════════════════════════════════════════════════════════"
pause
