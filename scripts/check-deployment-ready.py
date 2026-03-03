#!/usr/bin/env python3
"""
Pre-Deployment Checklist for PythonAnywhere
Run this script before deploying to verify your setup
"""

import os
import sys
from pathlib import Path

def check_file_exists(filepath, required=True):
    """Check if a file exists"""
    exists = Path(filepath).exists()
    status = "✅" if exists else ("❌" if required else "⚠️")
    req_text = " (REQUIRED)" if required else " (optional)"
    print(f"{status} {filepath}{req_text if not exists else ''}")
    return exists

def check_env_file():
    """Check if .env file exists with required variables"""
    env_path = Path(".env")
    if not env_path.exists():
        print("❌ .env file not found!")
        print("   → Copy .env.example to .env and fill in your values")
        return False
    
    print("✅ .env file exists")
    
    # Check for required variables
    required_vars = ['SECRET_KEY', 'FLASK_ENV']
    optional_vars = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'EMAIL_USER']
    
    with open(env_path) as f:
        content = f.read()
    
    print("\n   Checking environment variables:")
    for var in required_vars:
        if var in content and not content.split(var + "=")[1].split()[0].startswith('your_'):
            print(f"   ✅ {var} is set")
        else:
            print(f"   ❌ {var} is missing or not configured")
    
    for var in optional_vars:
        if var in content and not content.split(var + "=")[1].split()[0].startswith('your_'):
            print(f"   ✅ {var} is set")
        else:
            print(f"   ⚠️ {var} not configured (optional)")
    
    return True

def check_database():
    """Check if database exists"""
    db_path = Path("database/school.db")
    if db_path.exists():
        size = db_path.stat().st_size / 1024  # KB
        print(f"✅ Database exists ({size:.1f} KB)")
        return True
    else:
        print("⚠️ Database not found - will be created on first run")
        return True

def check_gitignore():
    """Check if .gitignore includes .env"""
    gitignore_path = Path(".gitignore")
    if not gitignore_path.exists():
        print("❌ .gitignore not found")
        return False
    
    with open(gitignore_path) as f:
        content = f.read()
    
    if ".env" in content:
        print("✅ .gitignore includes .env (secrets are safe)")
        return True
    else:
        print("❌ .gitignore doesn't include .env - ADD IT NOW!")
        return False

def main():
    print("=" * 60)
    print("PYTHONANYWHERE DEPLOYMENT CHECKLIST")
    print("=" * 60)
    print()
    
    # Change to project root
    os.chdir(Path(__file__).parent.parent)
    
    print("📁 Checking required files...")
    print()
    
    # Check critical files
    critical_ok = True
    critical_ok &= check_file_exists("backend/app.py", required=True)
    critical_ok &= check_file_exists("requirements.txt", required=True)
    critical_ok &= check_file_exists("backend/requirements.txt", required=True)
    critical_ok &= check_file_exists("wsgi.py", required=True)
    critical_ok &= check_gitignore()
    
    print()
    print("🔐 Checking environment configuration...")
    print()
    env_ok = check_env_file()
    
    print()
    print("💾 Checking database...")
    print()
    check_database()
    
    print()
    print("📄 Checking optional files...")
    print()
    check_file_exists(".env.example", required=False)
    check_file_exists("README.md", required=False)
    check_file_exists("Procfile", required=False)
    
    print()
    print("=" * 60)
    
    if critical_ok and env_ok:
        print("✅ READY FOR DEPLOYMENT!")
        print()
        print("Next steps:")
        print("1. Push to GitHub: git push origin main")
        print("2. Follow: docs/PYTHONANYWHERE_DEPLOYMENT.md")
        print("3. Sign up at: https://www.pythonanywhere.com")
    else:
        print("❌ NOT READY - Fix the issues above first!")
        print()
        print("Required actions:")
        if not critical_ok:
            print("- Ensure all required files exist")
        if not env_ok:
            print("- Create .env file from .env.example")
            print("- Fill in your actual values")
        print()
        print("Then run this script again.")
    
    print("=" * 60)
    print()

if __name__ == "__main__":
    main()
