# Database Backup & Restore Guide

This folder contains scripts to backup and restore your School Admin Portal database.

## 📁 Files

- `school.db` - Main SQLite database file
- `backup_database.py` - Python script to create backups
- `backup_database.ps1` - PowerShell script to create backups
- `restore_database.py` - Python script to restore backups
- `backups/` - Directory containing all backup files

## 🔄 Creating a Backup

### Using Python:
```bash
cd database
python backup_database.py
```

### Using PowerShell:
```powershell
cd database
.\backup_database.ps1
```

**What it does:**
- Creates a timestamped backup file (e.g., `school_backup_2026-02-27_15-35-46.db`)
- Stores it in the `backups/` folder
- Shows all existing backups with sizes and dates

## ♻️ Restoring a Backup

### Using Python:
```bash
cd database
python restore_database.py
```

**What it does:**
- Lists all available backups
- Asks you to choose which one to restore
- Creates a safety backup of current database before restoring
- Replaces the current database with the selected backup

**⚠️ Important:** After restoring, restart the backend server:
```bash
cd backend
python 01_app.py
```

## 💡 Best Practices

1. **Regular Backups**: Create backups before making major changes
2. **Keep Multiple Backups**: Don't delete old backups - disk space is cheap!
3. **Test Restores**: Occasionally test restoring a backup to ensure they work
4. **Backup Before Updates**: Always backup before updating the application

## 🕐 Automatic Backups

You can schedule automatic backups using:

### Windows Task Scheduler:
```powershell
# Create a daily backup task
$action = New-ScheduledTaskAction -Execute "python" -Argument "C:\path\to\database\backup_database.py"
$trigger = New-ScheduledTaskTrigger -Daily -At 2AM
Register-ScheduledTask -TaskName "SchoolDB_Backup" -Action $action -Trigger $trigger
```

### Linux/Mac Cron:
```bash
# Add to crontab (daily at 2 AM)
0 2 * * * cd /path/to/database && python3 backup_database.py
```

## 📊 Backup File Naming

Format: `school_backup_YYYY-MM-DD_HH-MM-SS.db`

Example: `school_backup_2026-02-27_15-35-46.db`
- Date: 2026-02-27 (February 27, 2026)
- Time: 15:35:46 (3:35:46 PM)

## 🆘 Emergency Recovery

If something goes wrong:

1. Stop the backend server
2. Run `python restore_database.py`
3. Choose the most recent backup
4. Restart the backend server
5. Verify data in the frontend

## 🔒 Security Note

- Backup files contain all your data - keep them secure!
- Don't share backup files publicly
- Consider encrypting sensitive backups
- Store important backups off-site (cloud storage, external drive)

---

**Created:** February 27, 2026
**Version:** 1.0
