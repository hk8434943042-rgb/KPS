import sys
sys.path.insert(0, 'backend')

import importlib
import os

# Force reload to get latest changes
if '01_app' in sys.modules:
    del sys.modules['01_app']

# Change to backend dir temporarily
os.chdir('backend')
sys.path.insert(0, os.getcwd())

# Import fresh
mod = importlib.import_module('01_app')
app = mod.app

print("\n=== Registered Routes ===")
for rule in app.url_map.iter_rules():
    methods = ','.join(sorted(rule.methods - {'HEAD', 'OPTIONS'}))
    print(f"{rule.rule:50} {methods:30} {rule.endpoint}")

print("\n=== Testing POST endpoint directly ===")
with app.test_client() as client:
    response = client.post('/api/test-post', json={'test': 'data'}, content_type='application/json')
    print(f"Status: {response.status_code}")
    print(f"Response: {response.get_json()}")

print("\n=== Testing actual student POST ===")
with app.test_client() as client:
    response = client.post('/api/students', json={'name': 'Test123', 'roll_no': '1111'}, content_type='application/json')
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        print(f"SUCCESS: {response.get_json()}")
    else:
        print(f"FAILED: {response.get_json()}")

