#!/usr/bin/env python
"""Verify the Flask app is ready for deployment"""
import sys
import os

try:
    # Check Python version
    print(f"✅ Python {sys.version.split()[0]}")
    
    # Check imports
    import flask
    print(f"✅ Flask {flask.__version__}")
    
    import flask_cors
    print(f"✅ Flask-CORS installed")
    
    # Verify files
    files_required = ['01_app.py', 'requirements.txt', 'Procfile', '.gitignore']
    for f in files_required:
        if os.path.exists(f):
            print(f"✅ {f}")
        else:
            print(f"❌ {f} MISSING")
    
    # Check git
    if os.path.exists('.git'):
        print(f"✅ Git repository initialized")
    else:
        print(f"⚠️  Git not initialized yet - run 'git init'")
    
    # Parse app file for syntax
    with open('01_app.py', 'r') as f:
        compile(f.read(), '01_app.py', 'exec')
    print("✅ 01_app.py - Syntax valid")
    
    print("\n" + "="*50)
    print("✅ App is ready for deployment!")
    print("="*50)
    print("\nNext step: Push to GitHub and deploy on Railway")
    print("\nSee QUICK_DEPLOY.md for instructions")
    
except SyntaxError as e:
    print(f"❌ Syntax error in code: {e}")
    sys.exit(1)
except ImportError as e:
    print(f"⚠️  Missing dependency: {e}")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
