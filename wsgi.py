# WSGI configuration for PythonAnywhere deployment
# This file tells PythonAnywhere how to run your Flask app

import sys
import os

# Add your project directory to the sys.path
project_home = '/home/YOUR_USERNAME/school-admin-portal'
if project_home not in sys.path:
    sys.path = [project_home] + sys.path

# Add backend directory to path
backend_path = os.path.join(project_home, 'backend')
if backend_path not in sys.path:
    sys.path = [backend_path] + sys.path

# Change working directory to project root
os.chdir(project_home)

# Set environment variables
os.environ['DATABASE_URL'] = 'sqlite:///database/school.db'
os.environ['FLASK_ENV'] = 'production'

# Load environment variables from .env file if it exists
from dotenv import load_dotenv
env_path = os.path.join(project_home, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

# Import your Flask app
from backend.app import app as application

# PythonAnywhere will use the 'application' object
