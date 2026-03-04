# 🛡️ Complete Backup & Recovery Guide

## Quick Start (30 seconds)

Just double-click one of these files:
- **EMERGENCY_BACKUP.bat** - Create a backup NOW
- **EMERGENCY_RESTORE.bat** - Restore from a previous backup

That's it! No configuration needed.

---

## 📦 What Gets Backed Up?

When you run the automatic backup, your entire project is saved including:
- ✅ Database (school.db)
- ✅ Frontend files (HTML, CSS, JavaScript)
- ✅ Backend code (Python, configuration)
- ✅ All settings and configurations
- ✅ Documentation

---

## 🚨 Emergency Backup - ONE CLICK

### When to Use
- Before making big changes
- Before system updates/install software
- Regularly (daily/weekly)
- Any time you're nervous about data loss

### How to Use
1. **Double-click:** `EMERGENCY_BACKUP.bat`
2. Wait for the "BACKUP COMPLETE" message
3. Done! Your backup is saved in `backups/full/`

### What happens:
- Creates a compressed backup file (ZIP format)
- File is named: `school-admin-portal_BACKUP_[DATE]_[TIME].zip`
- Stored safely in: `backups/full/`

---

## 🔄 Emergency Restore - WHEN DISASTER STRIKES

### When to Use
- If your computer crashes
- If database gets corrupted
- If you accidentally deleted important data
- If you need to go back to a previous state

### How to Use
1. **Double-click:** `EMERGENCY_RESTORE.bat`
2. It will show you a list of available backups
3. Enter the number of the backup you want (newest is usually best)
4. Type "yes" to confirm
5. Wait for restore to complete
6. Restart your backend server

### Important!
- Before restoring, a SAFETY BACKUP is created automatically
- Your old data is never lost
- The safety backup is stored in `backups/full/`

---

## ⏰ Automatic Daily Backups (Optional)

Set up your computer to backup automatically every day.

### Setup (One-time)
1. **Open PowerShell as Administrator**
   - Right-click PowerShell → Run as Administrator
2. **Navigate to project folder:**
   ```powershell
   cd "C:\Users\[YourUsername]\OneDrive\Desktop\school-admin-portal"
   ```
3. **Run setup script:**
   ```powershell
   .\scripts\Setup-Automatic-Backup.ps1
   ```
4. Enter "yes" when prompted
5. Done! Backups will happen every night at 2 AM

### Customize Time
```powershell
.\scripts\Setup-Automatic-Backup.ps1 -BackupTime "23:00" -BackupFrequency "Daily"
```

Available options:
- `-BackupTime` - Time in HH:MM format (24-hour clock)
  - Examples: "02:00" (2 AM), "23:00" (11 PM)
- `-BackupFrequency` - "Daily" or "Weekly"

### Manage Automatic Backups
- **View/Edit:** Open Task Scheduler (Type "task scheduler" in Windows search)
- **Look for:** "SchoolAdminPortal_AutomaticBackup"
- **Stop backups:** Right-click → Disable
- **Remove backups:** Right-click → Delete

---

## 📁 Backup File Structure

```
school-admin-portal/
└── backups/
    └── full/
        ├── school-admin-portal_BACKUP_2026-03-04_14-30.zip
        ├── school-admin-portal_BACKUP_2026-03-03_02-00.zip
        ├── school-admin-portal_BACKUP_2026-03-02_02-00.zip
        └── SAFETY_BACKUP_BEFORE_RESTORE_2026-03-04_15-45.zip
```

---

## 💾 Best Practices

### Regular Backups
- **Daily:** Enable automatic backups (takes <5 minutes setup)
- **Before changes:** Manual backup before updates
- **Weekly:** Keep at least 1 backup per week

### Storage
- Keep backups in `backups/full/` folder
- **Copy important backups to USB drive**
- **Upload to cloud storage** (Google Drive, OneDrive, Dropbox)
- Never rely on only one backup location

### Testing
- **Once a month:** Test restoration process
- **Practice:** Restore a backup to make sure it works
- **Verify:** Check that data looks correct after restore

### Cleanup
- Storage is cheap, keep old backups longer
- Only delete if you're absolutely sure you don't need that data
- After 3 months of successful operation, you can delete older backups

---

## 🚨 Disaster Recovery Checklist

If your computer crashed or won't start:

- [ ] Get to a Windows computer with the project files
- [ ] Locate the `backups/full/` folder
- [ ] Find the backup ZIP file you want to restore
- [ ] Extract it to your new computer
- [ ] Run `EMERGENCY_RESTORE.bat`
- [ ] Confirm restoration
- [ ] Restart backend server
- [ ] Verify data in web browser
- [ ] Test core functions (login, add student, etc.)

---

## 📊 Backup Size Reference

Typical backup sizes:
- **Empty project:** ~5 MB
- **With sample data:** ~10-50 MB
- **With production data:** 50-500 MB

These are compressed ZIP files, so they're much smaller than the original files.

---

## ⚙️ Advanced: What's in Each Backup

Each backup contains:
```
school-admin-portal/
├── backend/              ← Backend code & config
├── frontend/             ← HTML, CSS, JavaScript
├── database/
│   ├── school.db        ← Your actual data
│   └── backups/         ← Previous backups
├── docs/                ← Documentation
├── scripts/             ← Helper scripts
└── Other config files
```

---

## 🔐 Security Notes

- **Backup security:** Backups contain all your data
  - Keep them secure (password protect USB drives)
  - Don't share backup files publicly
  - Consider encryption for sensitive data

- **Off-site storage:** Store copies away from your computer
  - USB drive in safe place
  - Cloud storage (OneDrive, Google Drive)
  - External hard drive

---

## ❓ FAQ

### How often should I backup?
- **Daily:** If you have automatic backups enabled ✅
- **Weekly:** If you backup manually
- **Before:** Always backup before major changes

### How long do backups take?
- **Emergency Backup:** 2-5 minutes depending on project size
- **Automatic Backup:** Runs at night while you sleep
- **Restore:** 2-5 minutes depending on backup size

### Can I restore a backup to a different computer?
Yes! Just:
1. Copy the backup ZIP file to the new computer
2. Extract it to your project folder
3. Run EMERGENCY_RESTORE.bat

### What if I accidentally delete a backup?
- Windows Recycle Bin might have it
- If backups are gone, you can only restore what you have
- This is why keeping multiple backup dates is important!

### Can I restore just the database without other files?
Not with the emergency restore. But you can:
1. Extract the ZIP manually
2. Copy just the `database/school.db` file
3. Or use the individual database backup scripts in `database/` folder

### Do I need to stop the server before backing up?
No, the backup takes a copy while the server runs. But for the most reliable backup:
- Stop the backend server
- Run backup
- Start server again

---

## 🆘 Get Help

If something goes wrong:

1. **Check error messages** - Write them down
2. **Review this guide** - Your answer might be here
3. **Check README.md** - General documentation
4. **Check database/BACKUP_README.md** - Database-specific info
5. **Create safety backup** - Always have a fallback

---

Last updated: March 4, 2026
