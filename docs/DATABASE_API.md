# School Admin Portal - Database & API Documentation

## Database Schema

Your Flask backend now includes a comprehensive SQLite database with 4 main tables:

### 1. **Students Table**
```
id (INTEGER PRIMARY KEY)
roll_no (TEXT UNIQUE)
name (TEXT)
email (TEXT)
phone (TEXT)
class_name (TEXT)
section (TEXT)
date_of_birth (TEXT)
address (TEXT)
parent_name (TEXT)
parent_phone (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### 2. **Teachers Table**
```
id (INTEGER PRIMARY KEY)
emp_id (TEXT UNIQUE)
name (TEXT)
email (TEXT)
phone (TEXT)
subject (TEXT)
qualification (TEXT)
date_of_joining (TEXT)
address (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### 3. **Attendance Table**
```
id (INTEGER PRIMARY KEY)
student_id (INTEGER FOREIGN KEY)
attendance_date (TEXT)
status (TEXT) - 'Present', 'Absent', 'Leave'
remarks (TEXT)
created_at (TIMESTAMP)
```

### 4. **Payments Table**
```
id (INTEGER PRIMARY KEY)
student_id (INTEGER FOREIGN KEY)
amount (REAL)
payment_date (TEXT)
payment_method (TEXT)
transaction_id (TEXT)
purpose (TEXT)
status (TEXT) - 'Pending', 'Completed', 'Failed'
remarks (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

---

## API Endpoints

### **STUDENTS**

#### Create a Student
```
POST /api/students
Content-Type: application/json

{
  "roll_no": "A001",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "class_name": "10",
  "section": "A",
  "date_of_birth": "2008-05-15",
  "address": "123 Main St",
  "parent_name": "Jane Doe",
  "parent_phone": "9876543211"
}
```

#### Get All Students
```
GET /api/students
```

#### Get Single Student
```
GET /api/students/{student_id}
```

#### Update Student
```
PUT /api/students/{student_id}
Content-Type: application/json
```

#### Delete Student
```
DELETE /api/students/{student_id}
```

---

### **TEACHERS**

#### Create a Teacher
```
POST /api/teachers
Content-Type: application/json

{
  "emp_id": "T001",
  "name": "Mrs. Smith",
  "email": "smith@school.com",
  "phone": "9876543210",
  "subject": "Mathematics",
  "qualification": "B.Ed, M.Sc",
  "date_of_joining": "2015-06-01",
  "address": "456 Oak Ave"
}
```

#### Get All Teachers
```
GET /api/teachers
```

#### Get Single Teacher
```
GET /api/teachers/{teacher_id}
```

#### Update Teacher
```
PUT /api/teachers/{teacher_id}
Content-Type: application/json
```

#### Delete Teacher
```
DELETE /api/teachers/{teacher_id}
```

---

### **ATTENDANCE**

#### Mark Attendance
```
POST /api/attendance
Content-Type: application/json

{
  "student_id": 1,
  "attendance_date": "2024-02-26",
  "status": "Present",
  "remarks": "Regular"
}
```

#### Get Attendance Records
```
GET /api/attendance
Query Parameters:
  - date: (optional) Filter by date "2024-02-26"
  - student_id: (optional) Filter by student ID
```

#### Update Attendance
```
PUT /api/attendance/{attendance_id}
Content-Type: application/json

{
  "status": "Absent",
  "remarks": "Sick leave"
}
```

#### Delete Attendance
```
DELETE /api/attendance/{attendance_id}
```

---

### **PAYMENTS**

#### Create Payment Record
```
POST /api/payments
Content-Type: application/json

{
  "student_id": 1,
  "amount": 5000,
  "payment_date": "2024-02-26",
  "payment_method": "Bank Transfer",
  "transaction_id": "TXN123456",
  "purpose": "Tuition Fee",
  "status": "Completed",
  "remarks": "March fees paid"
}
```

#### Get All Payments
```
GET /api/payments
Query Parameters:
  - student_id: (optional) Filter by student ID
  - status: (optional) Filter by status ('Pending', 'Completed', 'Failed')
```

#### Get Single Payment
```
GET /api/payments/{payment_id}
```

#### Update Payment
```
PUT /api/payments/{payment_id}
Content-Type: application/json
```

#### Delete Payment
```
DELETE /api/payments/{payment_id}
```

---

### **DASHBOARD STATISTICS**

#### Get Dashboard Stats

Returns overall counts plus revenue figures. `total_revenue` is the lifetime amount collected; the new `month_revenue` field reports the sum of payments that occurred in the current month (YYYY‑MM). The frontend dashboard uses `month_revenue` to calculate the "Fees Collected (current month)" KPI.

```
GET /api/stats/dashboard

Response:
{
  "total_students": 150,
  "total_teachers": 25,
  "total_revenue": 750000,
  "month_revenue": 32000,
  "pending_payments": 12
}
```

---

## Running the Application

### 1. Start the Flask Server
```bash
python 01_app.py
```
Server runs on: http://localhost:5000

### 2. Test an Endpoint
```bash
curl -X GET http://localhost:5000/api/students
```

---

## Features

✅ **Full CRUD Operations** - Create, Read, Update, Delete for all entities
✅ **Data Validation** - Required fields and unique constraints
✅ **Relationships** - Foreign keys linking attendance/payments to students
✅ **Filtering** - Query attendance by date or student
✅ **Dashboard Stats** - Quick overview of key metrics
✅ **Timestamps** - Automatic tracking of creation and updates
✅ **Error Handling** - Comprehensive error messages

---

## Database File

Your SQLite database is stored in: `school.db`

To inspect the database directly:
```bash
python verify_db.py
```

This will show all tables and their columns.
