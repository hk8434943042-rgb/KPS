# Mirror Project to D:\ Drive

Copy your entire School Admin Portal project from C: to D: drive (entire folder copy, not just backups).

## 🚀 Quick Start

### Option 1: Double-click launcher (easiest)
```
Double-click: scripts\mirror-to-d-drive.bat
```

### Option 2: PowerShell command
```powershell
cd C:\Users\Himanshu kumar\OneDrive\Desktop\school-admin-portal\scripts
.\mirror-project.ps1
```

This creates: `D:\school-admin-portal\` (complete copy of entire project)

## 📋 Commands

### Initial Full Copy
```powershell
.\mirror-project.ps1
```
Copies entire project from C: to D:
- **Time:** Depends on project size (2-5 minutes)
- **Creates:** `D:\school-admin-portal\`

### Sync (Keep D:\ Updated)
```powershell
.\mirror-project.ps1 -Sync
```
Two-way synchronization:
- ➕ Adds new files to D:\
- 🔄 Updates changed files
- ➖ Removes deleted files
- **Time:** Few seconds to minutes (only syncs changes)

### Verify Sync Status
```powershell
.\mirror-project.ps1 -Verify
```
Checks if C:\ and D:\ are identical:
- Compares file counts
- Compares total sizes
- Shows what's different

### List Contents
```powershell
.\mirror-project.ps1 -List
```
Shows what will be copied

## 📁 Directory Structure

After copying, D: will contain:

```
D:\school-admin-portal\
├── backend/              (Python/Flask code)
├── frontend/             (HTML/CSS/JS)
├── database/             (SQLite database + backups)
├── docs/                 (Documentation)
├── scripts/              (Helper scripts)
├── __pycache__/
├── requirements.txt
├── wsgi.py
├── Procfile
├── README.md
└── [other root files]
```

## 🔄 Typical Workflows

### Scenario 1: First-Time Copy
```powershell
# Initial copy of entire project
.\mirror-project.ps1

# Wait for completion
# Files now on D:\school-admin-portal\
```

### Scenario 2: Keep Two Copies Synchronized
```powershell
# After making changes in C:
.\mirror-project.ps1 -Sync

# D:\ automatically updated with changes
```

### Scenario 3: Check If Copies Match
```powershell
# Verify before important work
.\mirror-project.ps1 -Verify

# Shows if synchronized or what's different
```

### Scenario 4: Work on D: Copy Instead
```powershell
# If you want to use the D: copy as working directory
cd D:\school-admin-portal\backend
python 01_app.py

# Can run from D:\ directly
```

## 📊 Before Copying

Check available space:
- Get project size from C: (shown in script)
- Check D: free space (shown in script)
- Script verifies space before starting

## ⚠️ Important Notes

### What Gets Copied
- All folders: `backend/`, `frontend/`, `database/`, `docs/`, `scripts/`, `__pycache__/`
- All root files: `requirements.txt`, `wsgi.py`, `Procfile`, `README.md`, etc.

### What Happens to Existing D:\ Copy
If `D:\school-admin-portal\` already exists:
- Script asks for confirmation
- Can choose to overwrite or cancel
- `-Sync` mode safely updates only changed files

### Verification
After copying, script automatically:
- Counts files in both locations
- Compares total sizes
- Checks if all files copied successfully

## 🛠️ Troubleshooting

### "D:\ drive not found"
```powershell
# Check D: is connected
Get-PSDrive | Where-Object {$_.Name -eq "D"}
```

### "Not enough space on D:\"
```powershell
# Check free space
Get-PSDrive D | Select-Object Name, Used, Free

# Free up space or use smaller drive
```

### "Some files didn't copy"
```powershell
# Verify copy
.\mirror-project.ps1 -Verify

# Try again
.\mirror-project.ps1 -Sync
```

### Copy is slow
- Check if D: is USB 3.0+ (faster than USB 2.0)
- Close other applications
- Copy during off-peak hours

## 💡 Tips

1. **Use with backup system** - Keep both mirror + timestamped backups
2. **Sync regularly** - Keep D:\ updated with latest changes
3. **Test on D:** - Can test features on the D:\ copy before production
4. **Two working copies** - Have backup project on D:\ for quick recovery

## 🔗 Related Tools

You also have these backup/copy tools:

| Tool | Purpose | Destination |
|------|---------|-------------|
| `mirror-project.ps1` | Full project mirror | `D:\school-admin-portal\` |
| `backup-to-external-ssd.ps1` | Timestamped backups | `D:\School-Admin-Portal-Backups\` |
| `database\backup_database.ps1` | Database-only backups | `database\backups\` |

## 📊 Storage Requirements

| Item | Size |
|------|------|
| Project (C:\) | ~500 MB - 2 GB |
| Mirror copy (D:\) | ~500 MB - 2 GB |
| 5 Timestamped backups | ~5-20 GB |
| **Total recommended D: space** | **20-50 GB** |

## ✅ Checklist

- [ ] D:\ drive connected
- [ ] Enough free space on D:\
- [ ] Run: `.\mirror-project.ps1`
- [ ] Verify copy completed
- [ ] Access D:\school-admin-portal\ to confirm
- [ ] Set up `-Sync` routine after changes
