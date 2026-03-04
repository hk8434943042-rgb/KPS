# Mirror Project from C:\ to D:\ Drive
# Creates a complete copy of the entire project directory

param(
    [switch]$Sync,      # Two-way sync (update D: with C: changes)
    [switch]$Verify,    # Verify both directories match
    [switch]$List       # Show what will be copied
)

# Source and destination paths
$SourcePath = "C:\Users\Himanshu kumar\OneDrive\Desktop\school-admin-portal"
$DestinationPath = "D:\school-admin-portal"
$BackupDrive = "D:\"

# Verify paths
if (-not (Test-Path $SourcePath)) {
    Write-Host "❌ ERROR: Source directory not found: $SourcePath"
    exit 1
}

if (-not (Test-Path $BackupDrive)) {
    Write-Host "❌ ERROR: D:\ drive not found. Please connect your external SSD."
    exit 1
}

# Get available space
$DriveFreeSpace = (Get-PSDrive D).Free
$DriveFreeSpaceGB = [math]::Round($DriveFreeSpace / 1GB, 2)
Write-Host "📊 Available space on D:\: $DriveFreeSpaceGB GB"

# Calculate source size
$SourceSize = (Get-ChildItem -Path $SourcePath -Recurse | Measure-Object -Property Length -Sum).Sum
$SourceSizeGB = [math]::Round($SourceSize / 1GB, 2)
Write-Host "📁 Project size: $SourceSizeGB GB"

if ($DriveFreeSpace -lt $SourceSize) {
    Write-Host "❌ ERROR: Not enough space on D:\ drive"
    Write-Host "   Required: $SourceSizeGB GB"
    Write-Host "   Available: $DriveFreeSpaceGB GB"
    exit 1
}

function Copy-Project {
    Write-Host ""
    Write-Host "📋 COPYING PROJECT FROM C:\ TO D:\" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "Source:      $SourcePath"
    Write-Host "Destination: $DestinationPath"
    Write-Host ""
    
    # Check if destination already exists
    if (Test-Path $DestinationPath) {
        Write-Host "⚠️  WARNING: Destination directory already exists!"
        $Confirm = Read-Host "Overwrite existing files? (yes/no)"
        if ($Confirm -ne "yes") {
            Write-Host "❌ Copy cancelled."
            return
        }
    } else {
        New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
        Write-Host "✅ Created destination directory"
    }
    
    Write-Host ""
    Write-Host "Copying files..."
    
    # Copy with progress
    $Items = Get-ChildItem -Path $SourcePath
    $Count = 0
    $Total = $Items.Count
    
    foreach ($item in $Items) {
        $Count++
        $PercentComplete = [math]::Round(($Count / $Total) * 100, 0)
        Write-Progress -Activity "Copying project files" -Status "$item.Name" -PercentComplete $PercentComplete
        
        $SourceItem = $item.FullName
        $DestItem = Join-Path $DestinationPath $item.Name
        
        if ($item.PSIsContainer) {
            # Copy directory
            if (Test-Path $DestItem) {
                Remove-Item -Path $DestItem -Recurse -Force
            }
            Copy-Item -Path $SourceItem -Destination $DestItem -Recurse -Force
        } else {
            # Copy file
            Copy-Item -Path $SourceItem -Destination $DestItem -Force
        }
    }
    
    Write-Progress -Activity "Copying project files" -Completed
    
    # Verify copy
    Write-Host ""
    Write-Host "Verifying copy..."
    
    $SourceCount = (Get-ChildItem -Path $SourcePath -Recurse).Count
    $DestCount = (Get-ChildItem -Path $DestinationPath -Recurse).Count
    
    $DestSize = (Get-ChildItem -Path $DestinationPath -Recurse | Measure-Object -Property Length -Sum).Sum
    $DestSizeGB = [math]::Round($DestSize / 1GB, 2)
    
    Write-Host ""
    Write-Host "✅ COPY COMPLETED!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "📁 Location: $DestinationPath"
    Write-Host "📋 Files: $DestCount"
    Write-Host "📊 Size: $DestSizeGB GB"
    
    if ($SourceCount -eq $DestCount) {
        Write-Host "✅ Copy verified - All files copied successfully!"
    } else {
        Write-Host "⚠️  WARNING: File count mismatch!"
        Write-Host "   Source: $SourceCount | Destination: $DestCount"
    }
}

function Sync-Directories {
    Write-Host ""
    Write-Host "🔄 SYNCING C:\ TO D:\ (TWO-WAY)" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if (-not (Test-Path $DestinationPath)) {
        Write-Host "Destination doesn't exist. Creating initial copy..."
        Copy-Project
        return
    }
    
    Write-Host "Comparing directories..."
    
    # Files to add
    $FilesToAdd = @()
    $FilesToRemove = @()
    $FilesToUpdate = @()
    
    # Check source files
    $SourceFiles = Get-ChildItem -Path $SourcePath -Recurse -File
    foreach ($file in $SourceFiles) {
        $RelativePath = $file.FullName.Substring($SourcePath.Length + 1)
        $DestFile = Join-Path $DestinationPath $RelativePath
        
        if (-not (Test-Path $DestFile)) {
            $FilesToAdd += $RelativePath
        } elseif ($file.LastWriteTime -gt (Get-Item $DestFile).LastWriteTime) {
            $FilesToUpdate += $RelativePath
        }
    }
    
    # Check destination files (to remove from dest if not in source)
    $DestFiles = Get-ChildItem -Path $DestinationPath -Recurse -File
    foreach ($file in $DestFiles) {
        $RelativePath = $file.FullName.Substring($DestinationPath.Length + 1)
        $SourceFile = Join-Path $SourcePath $RelativePath
        
        if (-not (Test-Path $SourceFile)) {
            $FilesToRemove += $RelativePath
        }
    }
    
    Write-Host ""
    Write-Host "Changes to sync:"
    Write-Host "  ➕ Add: $($FilesToAdd.Count) files"
    Write-Host "  🔄 Update: $($FilesToUpdate.Count) files"
    Write-Host "  ➖ Remove: $($FilesToRemove.Count) files"
    
    if ($FilesToAdd.Count -eq 0 -and $FilesToUpdate.Count -eq 0 -and $FilesToRemove.Count -eq 0) {
        Write-Host ""
        Write-Host "✅ Directories are already in sync!"
        return
    }
    
    Write-Host ""
    $Confirm = Read-Host "Apply these changes? (yes/no)"
    
    if ($Confirm -ne "yes") {
        Write-Host "Sync cancelled."
        return
    }
    
    # Apply changes
    foreach ($file in $FilesToAdd + $FilesToUpdate) {
        $SourceFile = Join-Path $SourcePath $file
        $DestFile = Join-Path $DestinationPath $file
        
        # Create directory if needed
        $DestDir = Split-Path -Parent $DestFile
        if (-not (Test-Path $DestDir)) {
            New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
        }
        
        Copy-Item -Path $SourceFile -Destination $DestFile -Force
    }
    
    foreach ($file in $FilesToRemove) {
        $DestFile = Join-Path $DestinationPath $file
        Remove-Item -Path $DestFile -Force
    }
    
    Write-Host ""
    Write-Host "✅ SYNC COMPLETED!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

function Verify-Sync {
    Write-Host ""
    Write-Host "🔍 VERIFYING SYNC" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if (-not (Test-Path $DestinationPath)) {
        Write-Host "❌ Destination directory not found: $DestinationPath"
        return
    }
    
    $SourceFiles = Get-ChildItem -Path $SourcePath -Recurse -File
    $DestFiles = Get-ChildItem -Path $DestinationPath -Recurse -File
    
    $SourceSize = ($SourceFiles | Measure-Object -Property Length -Sum).Sum
    $DestSize = ($DestFiles | Measure-Object -Property Length -Sum).Sum
    
    Write-Host ""
    Write-Host "Source:"
    Write-Host "  📋 Files: $($SourceFiles.Count)"
    Write-Host "  📊 Size: $(([math]::Round($SourceSize / 1MB, 2))) MB"
    
    Write-Host ""
    Write-Host "Destination:"
    Write-Host "  📋 Files: $($DestFiles.Count)"
    Write-Host "  📊 Size: $(([math]::Round($DestSize / 1MB, 2))) MB"
    
    Write-Host ""
    
    if ($SourceFiles.Count -eq $DestFiles.Count -and $SourceSize -eq $DestSize) {
        Write-Host "✅ Directories are synchronized!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Directories are out of sync" -ForegroundColor Yellow
        Write-Host "Run: .\mirror-project.ps1 -Sync"
    }
}

function List-Contents {
    Write-Host ""
    Write-Host "📋 PROJECT STRUCTURE" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    Write-Host ""
    Write-Host "Would be copied:"
    Get-ChildItem -Path $SourcePath | ForEach-Object {
        if ($_.PSIsContainer) {
            Write-Host "📁 $($_.Name)/"
        } else {
            Write-Host "📄 $($_.Name)"
        }
    }
    
    $TotalFiles = (Get-ChildItem -Path $SourcePath -Recurse).Count
    Write-Host ""
    Write-Host "Total items: $TotalFiles"
    Write-Host "Total size: $SourceSizeGB GB"
}

# Main execution
if ($PSBoundParameters.Count -eq 0) {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗"
    Write-Host "║       MIRROR PROJECT FROM C:\ TO D:\ (Full Project Copy)      ║"
    Write-Host "╚════════════════════════════════════════════════════════════════╝"
    Write-Host ""
    Write-Host "Usage: .\mirror-project.ps1 [Option]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  (no parameter)  Copy entire project C:\ to D:\"
    Write-Host "  -Sync           Two-way sync (add, update, remove files)"
    Write-Host "  -Verify         Check if C:\ and D:\ are synchronized"
    Write-Host "  -List           Show what will be copied"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\mirror-project.ps1              (Initial full copy)"
    Write-Host "  .\mirror-project.ps1 -Sync        (Keep D:\ updated)"
    Write-Host "  .\mirror-project.ps1 -Verify      (Check sync status)"
    Write-Host ""
    Write-Host "Project Size: $SourceSizeGB GB"
    Write-Host "Available Space: $DriveFreeSpaceGB GB"
}
elseif ($PSBoundParameters.Count -gt 0 -and -not $Sync -and -not $Verify -and -not $List) {
    Copy-Project
}
else {
    if ($List) {
        List-Contents
    }
    elseif ($Sync) {
        Sync-Directories
    }
    elseif ($Verify) {
        Verify-Sync
    }
}
