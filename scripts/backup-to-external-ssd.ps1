# External SSD Backup System
# Backs up entire project to D:\ drive with timestamp and version control

param(
    [switch]$Full,      # Full backup (all files)
    [switch]$Quick,     # Quick backup (database only)
    [switch]$List,      # List existing backups
    [switch]$Restore,   # Restore from backup
    [switch]$Verify,    # Verify backup integrity
    [switch]$Clean      # Clean old backups (keep last 5)
)

# Configuration
$SourcePath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackupDrive = "D:\"
$BackupRootDir = Join-Path $BackupDrive "School-Admin-Portal-Backups"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupDir = Join-Path $BackupRootDir "backup_$Timestamp"
$MetadataFile = Join-Path $BackupRootDir "backups.json"

# Create backup root if it doesn't exist
if (-not (Test-Path $BackupRootDir)) {
    New-Item -ItemType Directory -Path $BackupRootDir -Force | Out-Null
    Write-Host "✅ Created backup directory: $BackupRootDir"
}

# Check if D:\ drive exists
if (-not (Test-Path $BackupDrive)) {
    Write-Host "❌ ERROR: D:\ drive not found. Please connect your external SSD."
    exit 1
}

# Get available space on D:\
$DriveFreeSpace = (Get-PSDrive D).Free
$DriveFreeSpaceGB = [math]::Round($DriveFreeSpace / 1GB, 2)
Write-Host "📊 Available space on D:\: $DriveFreeSpaceGB GB"

function Backup-Full {
    Write-Host ""
    Write-Host "🔄 FULL BACKUP (All Project Files)" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    
    # Directories to backup
    $DirsToBackup = @(
        "backend",
        "frontend",
        "database",
        "docs",
        "scripts"
    )
    
    $TotalSize = 0
    $FilesCount = 0
    
    foreach ($dir in $DirsToBackup) {
        $SourceDir = Join-Path $SourcePath $dir
        $DestDir = Join-Path $BackupDir $dir
        
        if (Test-Path $SourceDir) {
            Write-Host "📁 Backing up: $dir"
            Copy-Item -Path $SourceDir -Destination $DestDir -Recurse -Force
            
            # Calculate size
            $DirSize = (Get-ChildItem -Path $DestDir -Recurse | Measure-Object -Property Length -Sum).Sum
            $DirSizeMB = [math]::Round($DirSize / 1MB, 2)
            $FileCount = (Get-ChildItem -Path $DestDir -Recurse).Count
            
            Write-Host "   ✓ $FileCount files, $DirSizeMB MB"
            $TotalSize += $DirSize
            $FilesCount += $FileCount
        }
    }
    
    # Backup root files (requirements.txt, wsgi.py, Procfile, etc.)
    Write-Host "📄 Backing up: Root configuration files"
    $RootFiles = @("requirements.txt", "wsgi.py", "Procfile", "README.md", "minimal_flask.py")
    foreach ($file in $RootFiles) {
        $FilePath = Join-Path $SourcePath $file
        if (Test-Path $FilePath) {
            Copy-Item -Path $FilePath -Destination $BackupDir -Force
        }
    }
    
    $TotalSizeMB = [math]::Round($TotalSize / 1MB, 2)
    
    Write-Host ""
    Write-Host "✅ FULL BACKUP COMPLETED!" -ForegroundColor Green
    Write-Host "📁 Location: $BackupDir"
    Write-Host "📊 Size: $TotalSizeMB MB"
    Write-Host "📋 Files: $FilesCount"
    
    return @{
        Type = "Full"
        Timestamp = $Timestamp
        Path = $BackupDir
        Size = $TotalSize
        FileCount = $FilesCount
    }
}

function Backup-Quick {
    Write-Host ""
    Write-Host "⚡ QUICK BACKUP (Database Only)" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $DbSourcePath = Join-Path $SourcePath "database"
    
    if (-not (Test-Path $DbSourcePath)) {
        Write-Host "❌ ERROR: Database directory not found"
        exit 1
    }
    
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    
    Write-Host "📁 Backing up database..."
    Copy-Item -Path $DbSourcePath -Destination (Join-Path $BackupDir "database") -Recurse -Force
    
    $DbSize = (Get-ChildItem -Path (Join-Path $BackupDir "database") -Recurse | Measure-Object -Property Length -Sum).Sum
    $DbSizeMB = [math]::Round($DbSize / 1MB, 2)
    
    Write-Host ""
    Write-Host "✅ QUICK BACKUP COMPLETED!" -ForegroundColor Green
    Write-Host "📁 Location: $BackupDir"
    Write-Host "📊 Size: $DbSizeMB MB"
    
    return @{
        Type = "Quick"
        Timestamp = $Timestamp
        Path = $BackupDir
        Size = $DbSize
    }
}

function List-Backups {
    Write-Host ""
    Write-Host "📋 EXISTING BACKUPS" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if (-not (Test-Path $BackupRootDir)) {
        Write-Host "No backups found."
        return
    }
    
    $Backups = Get-ChildItem -Path $BackupRootDir -Directory | Sort-Object Name -Descending
    
    if ($Backups.Count -eq 0) {
        Write-Host "No backups found."
        return
    }
    
    $Index = 1
    foreach ($backup in $Backups) {
        $BackupPath = $backup.FullName
        $Size = (Get-ChildItem -Path $BackupPath -Recurse | Measure-Object -Property Length -Sum).Sum
        $SizeMB = [math]::Round($Size / 1MB, 2)
        $FileCount = (Get-ChildItem -Path $BackupPath -Recurse).Count
        $CreatedTime = $backup.CreationTime
        
        Write-Host "$Index. $($backup.Name)"
        Write-Host "   📊 Size: $SizeMB MB | 📋 Files: $FileCount | ⏰ Created: $CreatedTime"
        $Index++
    }
}

function Restore-Backup {
    Write-Host ""
    Write-Host "♻️  RESTORE BACKUP" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $Backups = Get-ChildItem -Path $BackupRootDir -Directory | Sort-Object Name -Descending
    
    if ($Backups.Count -eq 0) {
        Write-Host "❌ No backups found."
        return
    }
    
    Write-Host "Available backups:"
    for ($i = 0; $i -lt $Backups.Count; $i++) {
        Write-Host "$($i + 1). $($Backups[$i].Name)"
    }
    
    $Selection = Read-Host "Select backup number (or press Ctrl+C to cancel)"
    
    if ([int]$Selection -lt 1 -or [int]$Selection -gt $Backups.Count) {
        Write-Host "❌ Invalid selection."
        return
    }
    
    $SelectedBackup = $Backups[[int]$Selection - 1]
    $SelectedPath = $SelectedBackup.FullName
    
    Write-Host ""
    Write-Host "⚠️  WARNING: This will replace current project files!"
    Write-Host "Selected backup: $($SelectedBackup.Name)"
    $Confirm = Read-Host "Type 'RESTORE' to continue"
    
    if ($Confirm -ne "RESTORE") {
        Write-Host "❌ Restore cancelled."
        return
    }
    
    # Create safety backup of current state
    Write-Host "Creating safety backup of current state..."
    $SafetyBackupDir = Join-Path $BackupRootDir "safety_backup_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
    New-Item -ItemType Directory -Path $SafetyBackupDir -Force | Out-Null
    
    $DirsToBackup = @("backend", "frontend", "database", "docs")
    foreach ($dir in $DirsToBackup) {
        $SourceDir = Join-Path $SourcePath $dir
        if (Test-Path $SourceDir) {
            Copy-Item -Path $SourceDir -Destination (Join-Path $SafetyBackupDir $dir) -Recurse -Force
        }
    }
    
    Write-Host "✅ Safety backup created at: $SafetyBackupDir"
    
    # Restore from selected backup
    Write-Host "Restoring from: $SelectedPath"
    foreach ($item in Get-ChildItem -Path $SelectedPath) {
        $DestPath = Join-Path $SourcePath $item.Name
        
        if ($item.PSIsContainer) {
            # Remove existing directory
            if (Test-Path $DestPath) {
                Remove-Item -Path $DestPath -Recurse -Force
            }
            Copy-Item -Path $item.FullName -Destination $DestPath -Recurse -Force
        } else {
            Copy-Item -Path $item.FullName -Destination $DestPath -Force
        }
    }
    
    Write-Host "✅ Restore completed successfully!"
    Write-Host "⚠️  Restart the backend server to apply changes."
}

function Verify-Backup {
    Write-Host ""
    Write-Host "🔍 VERIFY BACKUP INTEGRITY" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $Backups = Get-ChildItem -Path $BackupRootDir -Directory | Sort-Object Name -Descending
    
    if ($Backups.Count -eq 0) {
        Write-Host "No backups to verify."
        return
    }
    
    foreach ($backup in $Backups | Select-Object -First 1) {
        Write-Host "Verifying: $($backup.Name)"
        
        $BackupPath = $backup.FullName
        $Files = Get-ChildItem -Path $BackupPath -Recurse
        
        if ($Files.Count -eq 0) {
            Write-Host "❌ Backup is empty!"
            continue
        }
        
        $AllFilesAccessible = $true
        foreach ($file in $Files) {
            if (-not $file.PSIsContainer) {
                try {
                    $null = Get-Content $file.FullName -TotalCount 1 -ErrorAction Stop
                } catch {
                    Write-Host "❌ Cannot read: $($file.Name)"
                    $AllFilesAccessible = $false
                }
            }
        }
        
        if ($AllFilesAccessible) {
            Write-Host "✅ Backup is valid and readable!"
            Write-Host "   Files: $($Files.Count)"
            $TotalSize = ($Files | Measure-Object -Property Length -Sum).Sum
            $TotalSizeMB = [math]::Round($TotalSize / 1MB, 2)
            Write-Host "   Size: $TotalSizeMB MB"
        }
    }
}

function Clean-OldBackups {
    Write-Host ""
    Write-Host "🧹 CLEANING OLD BACKUPS" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $Backups = Get-ChildItem -Path $BackupRootDir -Directory | Sort-Object Name -Descending
    $BackupsToKeep = 5
    
    if ($Backups.Count -le $BackupsToKeep) {
        Write-Host "No old backups to clean (keeping last $BackupsToKeep)."
        return
    }
    
    Write-Host "Found $($Backups.Count) backups. Keeping last $BackupsToKeep..."
    
    $BackupsToDelete = $Backups | Select-Object -Skip $BackupsToKeep
    
    foreach ($backup in $BackupsToDelete) {
        $Size = (Get-ChildItem -Path $backup.FullName -Recurse | Measure-Object -Property Length -Sum).Sum
        $SizeMB = [math]::Round($Size / 1MB, 2)
        
        Write-Host "Deleting: $($backup.Name) ($SizeMB MB)"
        Remove-Item -Path $backup.FullName -Recurse -Force
    }
    
    Write-Host "✅ Cleanup completed!"
}

# Main execution
if ($PSBoundParameters.Count -eq 0) {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗"
    Write-Host "║          D:\ DRIVE BACKUP SYSTEM (External SSD)               ║"
    Write-Host "╚════════════════════════════════════════════════════════════════╝"
    Write-Host ""
    Write-Host "Usage: .\backup-to-external-ssd.ps1 [Option]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Full      Full backup (all project files)"
    Write-Host "  -Quick     Quick backup (database only)"
    Write-Host "  -List      List existing backups"
    Write-Host "  -Restore   Restore from a backup"
    Write-Host "  -Verify    Verify backup integrity"
    Write-Host "  -Clean     Delete old backups (keep last 5)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\backup-to-external-ssd.ps1 -Full"
    Write-Host "  .\backup-to-external-ssd.ps1 -Quick"
    Write-Host "  .\backup-to-external-ssd.ps1 -List"
}
elseif ($Full) {
    Backup-Full
}
elseif ($Quick) {
    Backup-Quick
}
elseif ($List) {
    List-Backups
}
elseif ($Restore) {
    Restore-Backup
}
elseif ($Verify) {
    Verify-Backup
}
elseif ($Clean) {
    Clean-OldBackups
}
