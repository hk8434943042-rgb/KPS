import urllib.request
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
    print("Sending request to:", url)
    print("Data:", json.dumps(data, indent=2))
    print()
    
    req_data = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=req_data, method='POST')
    req.add_header('Content-Type', 'application/json')
    
    try:
        response = urllib.request.urlopen(req, timeout=10)
        print(f"Status Code: {response.status}")
        content = response.read().decode('utf-8')
        print("Response:")
        print(content)
    except urllib.error.HTTPError as e:
        print(f"Status Code: {e.code}")
        content = e.read().decode('utf-8')
        print("Error Response:")
        print(content)
        print("\nParsed Error:")
        try:
            error_json = json.loads(content)
            print(json.dumps(error_json, indent=2))
        except:
            print(content)
            
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
