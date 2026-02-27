"""
Sample data loader for testing the school-admin-portal database
Run this script to populate the database with demo data
"""

import sqlite3
import json
from datetime import datetime, timedelta

def load_sample_data():
    conn = sqlite3.connect('../database/school.db')
    cursor = conn.cursor()

    print("Loading sample data...\n")

    # Sample Students
    students_data = [
        ('A001', 'Aarav Singh', 'aarav@school.com', '9876543210', '10', 'A', '2008-05-15', '123 Main St', 'Rajesh Singh', '9876543211'),
        ('A002', 'Priya Sharma', 'priya@school.com', '9876543212', '10', 'A', '2008-07-22', '456 Oak Ave', 'Sunita Sharma', '9876543213'),
        ('A003', 'Rohan Patel', 'rohan@school.com', '9876543214', '10', 'B', '2008-03-10', '789 Pine Rd', 'Amit Patel', '9876543215'),
        ('A004', 'Sara Khan', 'sara@school.com', '9876543216', '9', 'A', '2009-11-05', '321 Elm St', 'Fatima Khan', '9876543217'),
        ('A005', 'Vikram Verma', 'vikram@school.com', '9876543218', '9', 'B', '2009-01-30', '654 Maple Dr', 'Suresh Verma', '9876543219'),
    ]

    try:
        for student in students_data:
            cursor.execute("""
                INSERT INTO students (roll_no, name, email, phone, class_name, section, 
                                     date_of_birth, address, parent_name, parent_phone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, student)
        print(f"✓ Added {len(students_data)} sample students")
    except sqlite3.IntegrityError as e:
        print(f"⚠ Students already exist: {e}")

    # Sample Teachers
    teachers_data = [
        ('T001', 'Mrs. Sharma', 'sharma@school.com', '9876543220', 'Mathematics', 'B.Ed, M.Sc', '2015-06-01', '456 Oak Ave'),
        ('T002', 'Mr. Verma', 'verma@school.com', '9876543221', 'English', 'B.Ed, M.A', '2017-07-15', '789 Pine Rd'),
        ('T003', 'Ms. Patel', 'patel@school.com', '9876543222', 'Science', 'B.Ed, B.Sc', '2018-08-20', '321 Elm St'),
        ('T004', 'Mr. Singh', 'singh@school.com', '9876543223', 'Social Studies', 'B.Ed, M.A Hist', '2019-09-10', '654 Maple Dr'),
        ('T005', 'Mrs. Khan', 'khan@school.com', '9876543224', 'Hindi', 'B.Ed, M.A Hindi', '2020-10-05', '987 Cedar Ln'),
    ]

    try:
        for teacher in teachers_data:
            cursor.execute("""
                INSERT INTO teachers (emp_id, name, email, phone, subject, qualification, 
                                     date_of_joining, address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, teacher)
        print(f"✓ Added {len(teachers_data)} sample teachers")
    except sqlite3.IntegrityError as e:
        print(f"⚠ Teachers already exist: {e}")

    # Sample Attendance (Last 7 days)
    attendance_data = []
    today = datetime.now()
    statuses = ['Present', 'Absent', 'Leave']

    try:
        for student_id in range(1, 6):
            for day_offset in range(7):
                attendance_date = (today - timedelta(days=day_offset)).strftime('%Y-%m-%d')
                status = statuses[(student_id + day_offset) % 3]
                cursor.execute("""
                    INSERT INTO attendance (student_id, attendance_date, status, remarks)
                    VALUES (?, ?, ?, ?)
                """, (student_id, attendance_date, status, 'Regular' if status == 'Present' else ''))
        print(f"✓ Added attendance records for 35 days (5 students x 7 days)")
    except sqlite3.IntegrityError as e:
        print(f"⚠ Attendance records already exist: {e}")

    # Sample Payments
    payments_data = [
        (1, 5000, '2024-02-01', 'Bank Transfer', 'TXN001', 'Tuition Fee - January', 'Completed', ''),
        (1, 5000, '2024-02-26', 'Cash', 'TXN002', 'Tuition Fee - February', 'Completed', 'February fees'),
        (2, 5000, '2024-02-20', 'UPI', 'TXN003', 'Tuition Fee - February', 'Completed', ''),
        (3, 5000, '2024-02-15', 'Bank Transfer', 'TXN004', 'Tuition Fee - February', 'Pending', 'Under process'),
        (4, 1000, '2024-02-25', 'Cash', 'TXN005', 'Exam Fee', 'Completed', ''),
        (5, 5000, '2024-02-10', 'Online', 'TXN006', 'Tuition Fee - February', 'Failed', 'Retry needed'),
    ]

    try:
        for payment in payments_data:
            cursor.execute("""
                INSERT INTO payments (student_id, amount, payment_date, payment_method, 
                                     transaction_id, purpose, status, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, payment)
        print(f"✓ Added {len(payments_data)} sample payments")
    except sqlite3.IntegrityError as e:
        print(f"⚠ Payments already exist: {e}")

    conn.commit()
    conn.close()

    # Display stats
    print("\n" + "="*50)
    print("Sample Data Loaded Successfully!")
    print("="*50)
    
    conn = sqlite3.connect('../database/school.db')
    cursor = conn.cursor()
    
    total_students = cursor.execute("SELECT COUNT(*) FROM students").fetchone()[0]
    total_teachers = cursor.execute("SELECT COUNT(*) FROM teachers").fetchone()[0]
    total_attendance = cursor.execute("SELECT COUNT(*) FROM attendance").fetchone()[0]
    total_payments = cursor.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
    total_revenue = cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status='Completed'").fetchone()[0]
    
    print(f"\nDatabase Statistics:")
    print(f"  • Total Students: {total_students}")
    print(f"  • Total Teachers: {total_teachers}")
    print(f"  • Attendance Records: {total_attendance}")
    print(f"  • Payment Records: {total_payments}")
    print(f"  • Total Revenue (Completed): ₹{total_revenue:,.2f}")
    
    conn.close()

if __name__ == '__main__':
    load_sample_data()
    print("\n✅ Ready to test the API!")
    print("Start the server with: python 01_app.py")
