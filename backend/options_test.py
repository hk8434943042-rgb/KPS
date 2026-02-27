import requests
url='http://127.0.0.1:5000/api/students/by-roll/A001'
r=requests.options(url)
print('status', r.status_code)
print('headers', r.headers)
print('text', r.text)
