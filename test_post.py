#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Import the app
try:
    import app as app_module
    app = app_module.app
    print("✓ App imported successfully")
except Exception as e:
    print(f"✗ Failed to import app: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Create a test client
client = app.test_client()

# Test POST request
print("\nTesting POST /api/students...")
response = client.post(
    '/api/students',
    json={'name': 'Test Student', 'roll_no': '9999'},
    content_type='application/json'
)
print(f"Status: {response.status_code}")
print(f"Response: {response.get_json()}")
