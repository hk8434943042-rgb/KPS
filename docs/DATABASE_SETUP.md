# 🚀 Database Setup - Quick Start Guide

## What's Been Added

Your school-admin-portal now has a **full-featured SQLite database** with:

✅ **4 Database Tables**
- Students (with academic & contact info)
- Teachers (with qualification & subject details)
- Attendance (daily tracking with status)
- Payments (transaction records with status)

✅ **Complete REST API** 
- 30+ API endpoints for all CRUD operations
- Filtering & querying capabilities
- Dashboard statistics
- Error handling

✅ **Sample Data**
- 5 students with complete profiles
- 5 teachers with details
- 35 attendance records (7 days history)
- 6 payment transactions

---

## Getting Started

### 1️⃣ Start the Flask Server
```bash
python 01_app.py
```
✅ Server will run on: http://localhost:5000

### 2️⃣ Test the API

**Get all students:**
```bash
curl http://localhost:5000/api/students
```

**Get dashboard stats:**
```bash
curl http://localhost:5000/api/stats/dashboard
```

**Create a new student:**
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "roll_no": "B001",
    "name": "New Student",
    "email": "student@school.com",
    "phone": "9876543210",
    "class_name": "10",
    "section": "A"
  }'
```

### 3️⃣ View Full Documentation
See **DATABASE_API.md** for complete API reference

---

## Common Tasks

### Add a New Student
```bash
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "roll_no": "C101",
    "name": "Ananya Gupta",
    "email": "ananya@school.com",
    "phone": "9876543210",
    "class_name": "11",
    "section": "B",
    "date_of_birth": "2007-12-08",
    "address": "100 South Park",
    "parent_name": "Rajiv Gupta",
    "parent_phone": "9876543211"
  }'
```

### Mark Attendance
```bash
curl -X POST http://localhost:5000/api/attendance \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1,
    "attendance_date": "2024-02-26",
    "status": "Present",
    "remarks": "Regular"
  }'
```

### Record a Payment
```bash
curl -X POST http://localhost:5000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1,
    "amount": 5000,
    "payment_date": "2024-02-26",
    "payment_method": "Bank Transfer",
    "transaction_id": "TXN20240226001",
    "purpose": "Tuition Fee - March",
    "status": "Completed"
  }'
```

---

## File Descriptions

| File | Purpose |
|------|---------|
| `01_app.py` | Flask backend with all API endpoints |
| `school.db` | SQLite database (auto-created) |
| `DATABASE_API.md` | Complete API documentation |
| `load_sample_data.py` | Script to populate demo data |
| `verify_db.py` | Script to verify database schema |

---

## Database Files Location

```
school-admin-portal/
├── 01_app.py              ← Flask app with API
├── school.db              ← SQLite database
├── DATABASE_API.md        ← Full API docs
├── load_sample_data.py    ← Demo data loader
├── verify_db.py           ← DB verification
└── index.html             ← Frontend
```

---

## Reset Database

To reset and reload sample data:
```bash
# Remove old database
Remove-Item school.db -Force

# Reload sample data
python load_sample_data.py
```

---

## Next Steps

1. ✅ Run `python 01_app.py` to start the server
2. ✅ Test endpoints with provided curl commands
3. ✅ Connect your frontend (index.html/script.js) to these APIs
4. ✅ Build admin dashboard on top of these endpoints

---

## API Response Examples

### GET /api/students
```json
[
  {
    "id": 1,
    "roll_no": "A001",
    "name": "Aarav Singh",
    "email": "aarav@school.com",
    "phone": "9876543210",
    "class_name": "10",
    "section": "A",
    "date_of_birth": "2008-05-15",
    "address": "123 Main St",
    "parent_name": "Rajesh Singh",
    "parent_phone": "9876543211",
    "created_at": "2024-02-26 10:30:45",
    "updated_at": "2024-02-26 10:30:45"
  }
]
```

### GET /api/stats/dashboard
```json
{
  "total_students": 5,
  "total_teachers": 5,
  "total_revenue": 16000.00,
  "pending_payments": 1
}
```

---

## Support

- 📖 Full API documentation: See `DATABASE_API.md`
- 🔍 Inspect database: Run `python verify_db.py`
- 📊 Load more sample data: Edit & run `load_sample_data.py`

---

**Your database is ready to use! Start the server and begin building! 🎉**
