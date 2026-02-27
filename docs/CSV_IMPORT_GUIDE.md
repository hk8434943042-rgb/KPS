# How to Create CSV File for Student Import (Excel Guide)

## Quick Overview

The School Admin Portal can import student data from an **Excel CSV file**. Follow this guide to create the correct format.

---

## ✅ Step-by-Step Guide

### **Step 1: Open Microsoft Excel**
1. Open Excel on your computer
2. Create a new blank workbook
3. Start entering data in the first sheet

### **Step 2: Create Column Headers**

In the **first row**, enter these exact column names (case-sensitive):

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| **roll** | **admission_date** | **name** | **dob** | **aadhar** | **father_name** | **mother_name** | **class** | **section** | **phone** | **status** |

**Important:** The header row MUST have these exact names! (dob, aadhar, father_name, mother_name are optional)  
**Note:** "roll" in the CSV is the Admission Number

### **Step 3: Enter Student Data**

Starting from **Row 2**, fill in your student information:

#### Example Data:

| roll | admission_date | name | dob | aadhar | father_name | mother_name | class | section | phone | status |
|------|----------------|------|-----|--------|-------------|-------------|-------|---------|-------|--------|
| 1001 | 2020-06-10 | Priya Kumari | 2015-03-15 | 123456789012 | Rajesh Kumari | Anita Kumari | IX | A | +91-98765 43210 | Active |
| 1002 | Rahul Raj | 2014-07-22 | 234567890123 | Vikram Raj | Priya Raj | X | B | +91-98765 11111 | Active |
| 1003 | Anita Singh | 2013-11-08 | 345678901234 | Arjun Singh | Meera Singh | XII | A | +91-98765 22222 | Pending |
| 1004 | Aman Kumar | 2016-01-30 | 456789012345 | Suresh Kumar | Divya Kumar | VIII | C | +91-98765 33333 | Active |
| 1005 | Neha Sharma | 2015-08-12 | 567890123456 | Vijay Sharma | Priya Sharma | XI | B | +91-98765 44444 | Active |

### **Step 4: Column Guidelines**

#### **roll** (Column A) - **Admission Number**
- Student admission number
- Must be **unique**
- Can be: `1001`, `1002`, `A101`, etc.
- No spaces allowed

#### **name** (Column B)
- Full name of student
- Example: `Priya Kumari`, `Rahul Raj`

#### **dob** (Column C) ⭐ **NEW - Optional**
- Date of Birth in `YYYY-MM-DD` format
- Example: `2015-03-15` (March 15, 2015)
- Leave blank if not available

#### **aadhar** (Column D) ⭐ **NEW - Optional**
- 12-digit Aadhar number (no hyphens)
- Example: `123456789012`
- Leave blank if not available

#### **father_name** (Column E) ⭐ **NEW - Optional**
- Father's full name
- Example: `Rajesh Kumari`
- Leave blank if not applicable

#### **mother_name** (Column F) ⭐ **NEW - Optional**
- Mother's full name
- Example: `Anita Kumari`
- Leave blank if not applicable

#### **class** (Column G)
- Student's current class
- Must be one of: `Nursery`, `LKG`, `UKG`, `I`, `II`, `III`, `IV`, `V`, `VI`, `VII`, `VIII`, `IX`, `X`

#### **section** (Column H)
- Class section
- Must be one of: `A`, `B`, `C`

#### **phone** (Column I)
- Parent/guardian phone number
- Format: `+91-` followed by 10 digits
- Example: `+91-98765 43210`
- Important: Keep spaces if present
- Can contain spaces

#### **class** (Column C)
- Class level of student
- Allowed values:
  - Nursery, LKG, UKG
  - I, II, III, IV, V, VI, VII, VIII
  - IX, X, XI, XII
- Case-sensitive (use Roman numerals for higher classes)

#### **status** (Column J)
- Student status
- Use one of: `Active` or `Pending`
- Case-sensitive

---

## ⚠️ Important Excel Settings

### **Format Phone Column as TEXT**

To prevent Excel from modifying phone numbers:

1. **Select Column I** (phone column)
2. **Right-click** → Select "Format Cells"
3. Choose **"Text"** category
4. Click **OK**

This prevents Excel from removing leading zeros or hyphens.

---

## 📋 Complete Example Data with New Fields

Here's a full example you can copy (with optional parent info):

```
roll,name,dob,aadhar,father_name,mother_name,class,section,phone,status
1001,Priya Kumari,2015-03-15,123456789012,Rajesh Kumari,Anita Kumari,IX,A,+91-98765 43210,Active
1002,Rahul Raj,2014-07-22,234567890123,Vikram Raj,Priya Raj,X,B,+91-98765 11111,Active
1003,Anita Singh,2013-11-08,345678901234,Arjun Singh,Meera Singh,XII,A,+91-98765 22222,Pending
1004,Aman Kumar,2016-01-30,456789012345,Suresh Kumar,Divya Kumar,VIII,C,+91-98765 33333,Active
1005,Neha Sharma,2015-08-12,567890123456,Vijay Sharma,Priya Sharma,XI,B,+91-98765 44444,Active
```

### **Minimal Example (Required Fields Only)**

If you don't have parent info, you can use:

```
roll,name,dob,aadhar,father_name,mother_name,class,section,phone,status
1001,Priya Kumari,,,,,IX,A,+91-98765 43210,Active
1002,Rahul Raj,,,,,X,B,+91-98765 11111,Active
```

Leave the optional fields blank with commas.

---

## 💾 Step 5: Save as CSV

### **Method 1: Save As CSV (Recommended)**

1. Click **File** → **Save As**
2. Choose location to save
3. In **"Save as type"** dropdown, select:
   - **"CSV (Comma delimited) (*.csv)"**
4. Give it a name: `students.csv`
5. Click **Save**

### **Method 2: Export as CSV**

1. Click **File** → **Export**
2. Select **"Change File Type"**
3. Choose **CSV** format
4. Click **Save**

---

## ✅ Step 6: Import into Portal

### **In Admin Portal:**

1. **Login** as Admin
2. Go to **Students** section
3. Click **"Import CSV"** or **"📥 Upload CSV"** button
4. Select your saved `.csv` file
5. Click **Upload**
6. Wait for success message ✅

---

## ✨ Tips & Tricks

### **Quick Excel Tips:**

- **Auto-fill phone numbers** in the correct format by typing one, then dragging down
- **Use Data → Validation** to restrict class/section values
- **Freeze header row** (View → Freeze Panes) to keep it visible while scrolling
- **Check for duplicates** using conditional formatting
- **For dates**: Use YYYY-MM-DD format (e.g., 2015-03-15)

### **Common Mistakes to Avoid:**

❌ **Wrong column headers** - System won't recognize them  
❌ **Missing required columns** - Must have all 10 columns  
❌ **Phone stored as numbers** - Format as TEXT to preserve format  
❌ **Typos in class names** - Must match exactly (IX not 9)  
❌ **Extra spaces** - Data is trimmed automatically, but clean it up  
❌ **Special characters in roll** - Keep it simple (numbers/letters only)  
❌ **Wrong date format** - Use YYYY-MM-DD (2015-03-15 not 03/15/2015)
❌ **Aadhar with hyphens** - Use plain 12 digits (123456789012 not 1234-5678-9012)

---

## 📊 Sample CSV Download

You can also **export existing data** from the portal:

1. Go to **Students** section
2. Click **"Export CSV"** or **"📤 Download"**
3. This downloads current students as CSV (with all new fields)
4. Edit and re-import easily!

---

## 🚀 Advanced: Pre-built Templates

### **For Different Classes:**

Create separate CSVs by class:

**junior-students.csv** (Classes I-V)
```
roll,name,dob,aadhar,father_name,mother_name,class,section,phone,status
1001,Student1,2015-03-15,123456789012,Father Name,Mother Name,III,A,+91-99999 00001,Active
1002,Student2,2014-06-20,234567890123,Father Name,Mother Name,IV,B,+91-99999 00002,Active
```

**senior-students.csv** (Classes VI-X)
```
roll,name,dob,aadhar,father_name,mother_name,class,section,phone,status
2001,Student3,2012-01-10,345678901234,Father Name,Mother Name,VIII,A,+91-99999 00003,Active
2002,Student4,2011-09-05,456789012345,Father Name,Mother Name,IX,C,+91-99999 00004,Active
```

Then import each one separately!

---

## ✅ Validation Checklist

Before importing, verify:

- [ ] File is saved in `.csv` format
- [ ] First row has headers with correct column names
- [ ] All required columns present (roll, name, class, section, phone, status)
- [ ] Optional fields (dob, aadhar, father_name, mother_name) can be left blank
- [ ] No empty rows between data
- [ ] Phone column formatted as TEXT
- [ ] No duplicate roll numbers
- [ ] Class names are valid (I through X, Nursery, LKG, UKG)
- [ ] Status is either "Active" or "Pending"
- [ ] Roll numbers are unique across system
- [ ] Date format is YYYY-MM-DD if used
- [ ] Aadhar is 12 digits (no hyphens)

---

## 🆘 Troubleshooting

### **Error: "Invalid CSV header. Expected: roll, name, class, section, phone, status"**
- **Solution**: Check column names exactly (new fields are optional but order matters)

### **Students not importing**
- **Solution**: Open CSV in text editor to verify format is correct

### **Phone numbers getting changed**
- **Solution**: Format phone column as TEXT before entering data

### **Import shows nothing happened**
- **Solution**: Check if roll numbers already exist (duplicates are skipped automatically)

### **Date not showing correctly**
- **Solution**: Use YYYY-MM-DD format (2015-03-15)

---

## 📞 Need Help?

For any issues:
1. Check browser console (F12) for error messages
2. Verify CSV format in text editor (Notepad)
3. Try exporting current data first to see format
4. Ensure no leading/trailing spaces in data
5. Check that headers match exactly (case-sensitive)

---

## 🎓 Available Classes

Use exactly these for the `class` column:

**Pre-school**: Nursery, LKG, UKG  
**Primary**: I, II, III, IV, V  
**Middle School**: VI, VII, VIII  
**High School**: IX, X  

---

**Last Updated**: February 2026  
**Version**: 2.0 (Updated with parent info fields)
