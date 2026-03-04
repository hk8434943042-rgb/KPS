# D:\ Drive Backup System Guide

Complete backup and recovery system for the School Admin Portal to external SSD (D:\ drive).

## 📋 Overview

This system provides:
- **Full backups** - Complete project backup (all files)
- **Quick backups** - Database only (faster, smaller)
- **Automatic scheduling** - Windows Task Scheduler integration
- **Restore functionality** - Recover from any previous backup
- **Verification tools** - Check backup integrity
- **Cleanup utilities** - Manage backup storage space

## 🚀 Quick Start

### 1. First-Time Setup

Connect your external SSD to the D:\ drive, then run:

```powershell
cd C:\Users\Himanshu kumar\OneDrive\Desktop\school-admin-portal
.\scripts\backup-to-external-ssd.ps1 -Full
```

This creates an initial full backup at: `D:\School-Admin-Portal-Backups\backup_YYYY-MM-DD_HH-MM-SS\`

### 2. Create a Quick Backup

For faster daily backups (database only):

```powershell
.\scripts\backup-to-external-ssd.ps1 -Quick
```

**Time:** ~10-30 seconds  
**Size:** 10-50 MB (database only)

### 3. Create a Full Backup

For complete project backup:

```powershell
.\scripts\backup-to-external-ssd.ps1 -Full
```

**Time:** 1-3 minutes  
**Size:** 500 MB - 2 GB (depends on data)

## 📅 Automatic Backups

### Schedule Daily Backups

```powershell
# Run as Administrator
CD C:\Users\Himanshu kumar\OneDrive\Desktop\school-admin-portal
.\scripts\schedule-backup-task.ps1 -Schedule Daily -Hour 22
```

This backs up every night at 10 PM (quick backup)

### Schedule Weekly Backups

```powershell
.\scripts\schedule-backup-task.ps1 -Schedule Weekly -DayOfWeek Fri -Hour 22
```

This backs up every Friday at 10 PM

### Schedule Monthly Backups

```powershell
.\scripts\schedule-backup-task.ps1 -Schedule Monthly -Hour 02
```

This backs up on the 1st of each month at 2 AM

### View Scheduled Tasks

Open Windows Task Scheduler:
- Press `Windows + R`
- Type: `taskschd.msc`
- Look for tasks starting with `School-Admin-Portal-Backup-`

## 📁 Backup Directory Structure

```
D:\School-Admin-Portal-Backups\
├── backup_2026-03-04_22-30-45/
│   ├── backend/
│   ├── frontend/
│   ├── database/
│   ├── docs/
│   ├── scripts/
│   └── [root files]
├── backup_2026-03-03_22-30-12/
├── backup_2026-03-02_22-30-08/
└── safety_backup_2026-03-04_15-45-30/  [created before restore]
```

## 🔄 Restore from Backup

### List Available Backups

```powershell
.\scripts\backup-to-external-ssd.ps1 -List
```

Output example:
```
1. backup_2026-03-04_22-30-45
   📊 Size: 750.25 MB | 📋 Files: 3,412 | ⏰ Created: 3/4/2026 10:30:45 PM

2. backup_2026-03-03_22-30-12
   📊 Size: 745.80 MB | 📋 Files: 3,410 | ⏰ Created: 3/3/2026 10:30:12 PM
```

### Restore a Backup

```powershell
.\scripts\backup-to-external-ssd.ps1 -Restore
```

This will:
1. Show list of available backups
2. Ask you to select which one to restore (1, 2, 3, etc.)
3. Create a safety backup of your current state
4. Restore all files from selected backup
5. Ask you to restart the backend server

**Important:** After restore, restart the backend:
```powershell
cd backend
python 01_app.py
```

## 🔍 Verify Backups

Check if your most recent backup is valid:

```powershell
.\scripts\backup-to-external-ssd.ps1 -Verify
```

This checks:
- ✅ All files are readable
- ✅ Backup is not corrupted
- ✅ File counts and sizes

## 🧹 Manage Backup Space

### Clean Old Backups (Keep Last 5)

```powershell
.\scripts\backup-to-external-ssd.ps1 -Clean
```

This automatically:
- Deletes backups older than the last 5
- Shows size freed up
- Keeps safety backups

### Manual Cleanup

```powershell
# List all backups to see disk usage
.\scripts\backup-to-external-ssd.ps1 -List

# Manually delete old backup
Remove-Item "D:\School-Admin-Portal-Backups\backup_2026-01-01_22-30-45" -Recurse -Force
```

## 📊 Backup Storage Requirements

| Backup Type | Size | Time | Frequency |
|-------------|------|------|-----------|
| Quick (DB) | 10-50 MB | 10-30s | Daily |
| Full | 500MB-2GB | 1-3 min | Weekly |
| Storage (5 backups) | 5-20 GB | — | Automatic cleanup |

## ⚠️ Safety Features

### Safety Backup Before Restore

When you restore from a backup, the system automatically creates a safety backup of your current state:

```
D:\School-Admin-Portal-Backups\safety_backup_2026-03-04_15-45-30\
```

This allows you to revert if needed.

### Backup Integrity Checks

- All files are checked for readability
- Timestamps recorded for each backup
- File counts tracked for verification
- Disk space monitoring before backup

## 🛠️ Troubleshooting

### "D:\ drive not found"
- Check external SSD is connected and shows as D:\
- Reassign drive letter in Windows if needed:
  - Right-click Start → Disk Management
  - Right-click Drive → Rename and Assign Letter

### "Not enough space on D:\" 
- Use `-Clean` to delete old backups
- Check available space: `Get-PSDrive D`
- Delete unnecessary backup folders

### Backup is running slowly
- Ensure D:\ drive is connected with USB 3.0+
- Close other applications
- Run during off-peak hours

### Cannot restore - files locked
- Close the backend server/frontend
- Close any applications using database files
- Try restore again

## 💡 Best Practices

1. **Schedule automatic backups** - Never skip manual backups on critical days
2. **Verify occasionally** - Run `-Verify` monthly to ensure backups work
3. **Keep D:\ connected** - For automatic scheduled backups
4. **Multiple copies** - Maintain at least 2-3 recent backups
5. **Test restore** - Test recovery on non-critical data first

## 🔄 Recovery Scenarios

### Lost Database
```powershell
# Restore database only
.\scripts\backup-to-external-ssd.ps1 -Restore
# Select backup with database intact
# Restart backend
```

### Corrupted Backend Code
```powershell
# Full restore
.\scripts\backup-to-external-ssd.ps1 -Restore
# Select full backup before corruption occurred
```

### Need to Review Old Files
```powershell
# Browse backups directly
explorer D:\School-Admin-Portal-Backups
# Copy files as needed without full restore
```

## 📞 Quick Command Reference

```powershell
# Backups
.\scripts\backup-to-external-ssd.ps1 -Full      # Full backup
.\scripts\backup-to-external-ssd.ps1 -Quick     # Quick backup
.\scripts\backup-to-external-ssd.ps1 -List      # List backups
.\scripts\backup-to-external-ssd.ps1 -List | grep "backup_"  # Search

# Restore & Verify
.\scripts\backup-to-external-ssd.ps1 -Restore   # Restore from backup
.\scripts\backup-to-external-ssd.ps1 -Verify    # Verify last backup
.\scripts\backup-to-external-ssd.ps1 -Clean     # Cleanup old backups

# Scheduling
.\scripts\schedule-backup-task.ps1 -Schedule Daily   # Daily at 10 PM
.\scripts\schedule-backup-task.ps1 -Schedule Weekly  # Weekly on Friday

# View scheduled tasks
Get-ScheduledTask | Where-Object {$_.TaskName -like "*School-Admin*"}
```
