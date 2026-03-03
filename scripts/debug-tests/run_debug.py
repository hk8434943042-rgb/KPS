#!/usr/bin/env python3
import os
import sys

# Enable Flask debug
os.environ['FLASK_ENV'] = 'development'
os.environ['FLASK_DEBUG'] = '1'

# Add backend to path
sys.path.insert(0, 'backend')

from app import app

if __name__ == '__main__':
    print("[STARTUP] Starting Flask app with debug mode...")
    sys.stdout.flush()
    app.run(port=5000, debug=True, use_reloader=False)
