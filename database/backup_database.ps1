# Database Backup Script for School Admin Portal
# Creates timestamped backups of the SQLite database

# Get current timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

# Define paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dbPath = Join-Path $scriptDir "school.db"
$backupDir = Join-Path $scriptDir "backups"

# Create backups directory if it doesn't exist
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "✅ Created backups directory: $backupDir"
}

# Check if database exists
if (-not (Test-Path $dbPath)) {
    Write-Host "❌ ERROR: Database file not found at: $dbPath"
    exit 1
}

# Create backup filename
$backupFileName = "school_backup_$timestamp.db"
$backupPath = Join-Path $backupDir $backupFileName

# Copy database file
try {
    Copy-Item -Path $dbPath -Destination $backupPath -Force
    $fileSize = (Get-Item $backupPath).Length
    $fileSizeKB = [math]::Round($fileSize / 1KB, 2)
    
    Write-Host ""
    Write-Host "✅ DATABASE BACKUP SUCCESSFUL!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "📁 Backup Location: $backupPath"
    Write-Host "📊 Backup Size: $fileSizeKB KB"
    Write-Host "⏰ Timestamp: $timestamp"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host ""
    
    # List all backups
    $allBackups = Get-ChildItem -Path $backupDir -Filter "school_backup_*.db" | Sort-Object LastWriteTime -Descending
    Write-Host "📋 All Database Backups ($($allBackups.Count) total):"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    foreach ($backup in $allBackups) {
        $backupSizeKB = [math]::Round($backup.Length / 1KB, 2)
        Write-Host "  • $($backup.Name) - $backupSizeKB KB - $($backup.LastWriteTime)"
    }
    
    Write-Host ""
    Write-Host "💡 To restore a backup, copy the backup file over school.db"
    Write-Host ""
    
} catch {
    Write-Host "❌ ERROR: Failed to create backup!" -ForegroundColor Red
    Write-Host "Error details: $_"
    exit 1
}
