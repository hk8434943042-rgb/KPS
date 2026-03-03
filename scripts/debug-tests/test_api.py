import requests
import json

url = "http://localhost:5000/api/students"
data = {
    "roll_no": "1122",
    "name": "Mohit Kumar", 
    "admission_date": "01-04-2025",
    "aadhar_number": "334721374969",
    "father_name": "Jitendra kumar sinha",
    "mother_name": "Reena Sinha",
    "class_name": "VII",
    "section": "A",
    "phone": "9801598020",
    "status": "Active",
    "date_of_birth": "12-08-2013"
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
