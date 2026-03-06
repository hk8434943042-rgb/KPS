# Fee Receipt Structure
**Version:** 1.0  
**Last Updated:** March 6, 2026  
**School Admin Portal - Receipt System Documentation**

---

## Table of Contents
1. [Receipt Data Structure](#receipt-data-structure)
2. [Receipt Types](#receipt-types)
3. [Receipt Fields Reference](#receipt-fields-reference)
4. [Implementation Details](#implementation-details)
5. [Customization Guide](#customization-guide)
6. [API Endpoints](#api-endpoints)

---

## Receipt Data Structure

### Core Receipt Object
```javascript
{
  // Basic Information
  no: "R-0001",                    // Receipt number (unique identifier)
  date: "2026-03-06",              // Receipt issue date (YYYY-MM-DD)
  
  // Student Information
  roll: "ADM001",                  // Student admission/roll number
  admission_no: "ADM001",          // Alternate field for admission number
  name: "Priya Sharma",            // Student full name
  class: "IX",                     // Student class/grade
  section: "A",                    // Student section
  
  // Payment Information
  method: "Cash",                  // Payment method: Cash|UPI|Card|Bank Transfer
  amount: 5000,                    // Total amount paid (₹)
  ref: "UPI123456789",            // Transaction reference (optional)
  
  // Fee Details
  heads: {                         // Fee components breakdown
    "Tuition": 3000,
    "Transport": 1500,
    "Lab/IT": 500,
    "Activity": 0
  },
  
  // Additional Charges/Adjustments
  discount: 0,                     // Discount applied (₹)
  lateFee: 0,                      // Late fee charged (₹)
  
  // Month Coverage
  months: ["2026-03", "2026-04"],  // Months covered by this payment
  
  // Payment Gateway Details (for online payments)
  razorpayData: {                  // Optional: Only for Razorpay payments
    razorpayPaymentId: "pay_xxx",
    razorpayOrderId: "order_xxx",
    razorpaySignature: "signature_xxx"
  },
  
  // Metadata
  createdBy: "admin",              // User who created receipt
  createdAt: "2026-03-06T10:30:00", // Receipt creation timestamp
  status: "paid"                   // Receipt status: paid|pending|cancelled
}
```

---

## Receipt Types

### 1. **Standard Browser Receipt** (Regular Printer)
- Format: HTML/Print Dialog
- Paper Size: A4 or Letter
- Use Case: Office laser/inkjet printers
- Features:
  - School header with logo
  - Complete payment details
  - Item-wise breakdown
  - Total, discount, late fee
  - System-generated footer

### 2. **Thermal Receipt** (ESC/POS Format)
- Format: ESC/POS Commands
- Paper Size: 80mm thermal paper
- Use Case: Petrol pump style thermal printers
- Features:
  - Compact format (48 character width)
  - Text-mode rendering
  - Auto-cut command
  - Optimized for receipt printers

### 3. **PDF Receipt** (Digital Export)
- Format: PDF Document
- Paper Size: A4
- Use Case: Email, archival, digital records
- Features:
  - Professional layout
  - Company branding
  - Digitally signed (optional)
  - Suitable for printing & emailing

### 4. **Compact Receipt** (Ultra-compact format)
- Format: HTML (minimized)
- Paper Size: 80mm or A4 (multiple per page)
- Use Case: Batch printing, saving paper
- Features:
  - Minimal design
  - Essential details only
  - 4 receipts per A4 page
  - Reduced margins

---

## Receipt Fields Reference

### Required Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `no` | String | Unique receipt number | "R-0001" |
| `date` | String | Receipt issue date | "2026-03-06" |
| `roll` | String | Student admission number | "ADM001" |
| `name` | String | Student full name | "Priya Sharma" |
| `amount` | Number | Total paid amount | 5000 |
| `method` | String | Payment method | "Cash" |

### Optional Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `class` | String | Student class/grade | "IX A" |
| `section` | String | Student section | "A" |
| `phone` | String | Parent/Guardian phone | "+91-9876543210" |
| `ref` | String | Transaction reference | "UPI123456" |
| `heads` | Object | Fee breakdown by type | `{"Tuition": 3000}` |
| `months` | Array | Months covered | `["2026-03"]` |
| `discount` | Number | Discount amount | 500 |
| `lateFee` | Number | Late fee charged | 100 |
| `note` | String | Additional notes | "Concession applied" |

### School Information Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `school_name` | String | School full name | "KHUSHI PUBLIC SCHOOL" |
| `school_address` | String | Complete address | "Deoley, Shekhpura, Bihar" |
| `school_phone` | String | Contact number | "0149-2082596" |
| `school_email` | String | Email address | "info@khushischool.com" |
| `school_logo` | String | Logo URL/Base64 | "data:image/png;base64,..." |
| `tagline` | String | School motto/tagline | "Education for Excellence" |

---

## Implementation Details

### Frontend (script.js)

#### Receipt Generation
```javascript
// Create receipt object
const receipt = {
  no: 'R-' + String(AppState.receipts.length + 1).padStart(4, '0'),
  date: new Date().toISOString().split('T')[0],
  roll: student.roll,
  name: student.name,
  class: student.class,
  method: paymentMethod,
  amount: totalAmount,
  ref: transactionRef || '',
  heads: selectedHeads,
  discount: discountAmount,
  lateFee: lateFeeAmount,
  months: selectedMonths
};

// Add to receipts array
AppState.receipts.push(receipt);
```

#### Print Receipt Function
```javascript
// Location: script.js, line ~2682
function printReceipt(no) {
  const r = AppState.receipts.find(x => x.no === no);
  if (!r) {
    alert('Receipt not found');
    return;
  }
  
  // Offer choice: Thermal or Regular printer
  const choice = confirm(
    '🖨️ Print Options:\n\n' +
    'OK → Thermal Printer (ESC/POS Format)\n' +
    'Cancel → Regular Printer (Browser Print)'
  );
  
  if (choice) {
    printThermalReceipt(r.no, r.name, r.roll, r.amount, r.method, 'School Fee');
  } else {
    // Regular browser print logic
    const root = document.querySelector('#receiptPrintRoot');
    // ... HTML generation
    window.print();
  }
}
```

### Backend (app.py)

#### Thermal Receipt Endpoint
```python
# Location: backend/app.py, line 1615
@app.route('/api/receipt/thermal', methods=['POST'])
def generate_thermal_receipt():
    """Generate ESC/POS thermal printer receipt format"""
    data = request.json or {}
    
    # Extract receipt data
    receipt_num = data.get('receipt_number', 'N/A')
    student_name = data.get('student_name', 'N/A')
    amount = float(data.get('amount', 0))
    # ... more fields
    
    # Build ESC/POS command sequence
    receipt = []
    receipt.append(b'\x1b\x40')  # Initialize printer
    receipt.append(b'\x1b\x61\x01')  # Center align
    # ... more commands
    
    return jsonify({
        'success': True,
        'receipt': receipt_data.decode('latin-1')
    })
```

#### HTML Receipt Endpoint
```python
# Location: backend/app.py, line 1735
@app.route('/api/receipt/html', methods=['POST'])
def generate_html_receipt():
    """Generate HTML receipt for browser printing"""
    data = request.json or {}
    
    # Build HTML with embedded CSS
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @page {{ size: 80mm auto; margin: 0; }}
            /* ... styles */
        </style>
    </head>
    <body>
        <div class="receipt">
            <!-- Receipt content -->
        </div>
    </body>
    </html>
    """
    
    return jsonify({'success': True, 'html': html_content})
```

---

## Customization Guide

### 1. Change School Header
Edit `AppState.settings.school` in script.js:
```javascript
AppState.settings.school = {
  name: "YOUR SCHOOL NAME",
  tagline: "Your School Motto",
  address: "Complete Address Here",
  phone: "+91-XXXXXXXXXX",
  email: "contact@yourschool.com"
};
```

### 2. Add Custom Receipt Fields
Modify receipt object when creating:
```javascript
const receipt = {
  // ... standard fields
  customField1: "Custom Value",
  remarks: "Additional notes",
  approvedBy: "Principal Name"
};
```

### 3. Change Receipt Number Format
Update prefix and padding:
```javascript
// Current: R-0001
no: 'R-' + String(AppState.receipts.length + 1).padStart(4, '0'),

// Custom: RCP-2026-00001
no: 'RCP-2026-' + String(AppState.receipts.length + 1).padStart(5, '0'),
```

### 4. Customize Receipt Layout
Edit HTML template in `printReceipt()` function:
```javascript
root.innerHTML = `
  <div class="receipt">
    <div class="school-logo">
      <img src="${logoUrl}" alt="School Logo" />
    </div>
    <h2>${headerName}</h2>
    <!-- Custom layout here -->
  </div>
`;
```

### 5. Add Receipt Footer
Include terms & conditions:
```javascript
<div class="receipt-footer">
  <hr />
  <p><strong>Terms & Conditions:</strong></p>
  <ul>
    <li>All fees once paid are non-refundable</li>
    <li>Late fee will be charged after due date</li>
    <li>This is a computer-generated receipt</li>
  </ul>
</div>
```

---

## API Endpoints

### 1. Generate Thermal Receipt
**Endpoint:** `POST /api/receipt/thermal`

**Request Body:**
```json
{
  "payment_id": 1,
  "receipt_number": "RCP-0001",
  "payment_date": "06-03-2026",
  "student_name": "Priya Sharma",
  "roll_no": "ADM001",
  "amount": 5000,
  "payment_method": "Cash",
  "purpose": "Monthly Fee",
  "course": "Class IX",
  "duration": "1 Year",
  "paid_by": "Cash",
  "school_name": "KHUSHI PUBLIC SCHOOL",
  "school_address": "Deoley, Shekhpura, Bihar",
  "school_contact": "0149-2082596",
  "school_email": "info@khushischool.com",
  "particulars": [
    "Tuition Fee - March 2026",
    "Transport Fee - March 2026",
    "Lab Fee - March 2026"
  ],
  "font_variant": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "receipt": "ESC/POS command string (base64 encoded)",
  "message": "Receipt generated successfully"
}
```

### 2. Generate HTML Receipt
**Endpoint:** `POST /api/receipt/html`

**Request Body:** (Same as thermal receipt)

**Response:**
```json
{
  "success": true,
  "html": "<html>...</html>",
  "message": "Receipt generated successfully"
}
```

### 3. Find Receipt by Number
**Frontend Function:** `findReceiptByNumber()`

Searches by:
- Receipt number (e.g., "R-0001")
- Student roll/admission number (returns latest receipt)

---

## Receipt Printing Workflow

```
┌─────────────────────────────────────────────┐
│  User selects "Save & Print" in Fee Payment │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  Create receipt object with all details     │
│  - Auto-generate receipt number             │
│  - Capture payment details                  │
│  - Add to AppState.receipts[]               │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  User chooses receipt format:               │
│  ├─ Thermal Printer (ESC/POS)               │
│  ├─ Regular Printer (Browser Print)         │
│  ├─ PDF Export                              │
│  └─ Compact Format                          │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  Generate receipt in selected format:       │
│  ├─ Thermal: Send to /api/receipt/thermal   │
│  ├─ HTML: Send to /api/receipt/html         │
│  └─ Browser: Generate HTML & window.print() │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  Receipt printed successfully               │
│  - Stored in database                       │
│  - Available for reprint                    │
│  - Searchable by number/student             │
└─────────────────────────────────────────────┘
```

---

## Best Practices

### 1. **Unique Receipt Numbers**
- Always use sequential numbering
- Include year/session for clarity: `RCP-2026-00001`
- Never reuse receipt numbers

### 2. **Data Validation**
- Verify all required fields before creating receipt
- Validate amount is positive and non-zero
- Confirm student exists in database

### 3. **Receipt Storage**
- Store receipts in database (persistent)
- Keep backup of printed receipts
- Enable receipt search by multiple criteria

### 4. **Audit Trail**
- Log who created the receipt
- Record timestamp of creation
- Track any modifications or cancellations

### 5. **Error Handling**
- Handle printer connection errors gracefully
- Provide manual print option if auto-print fails
- Save receipt even if printing fails

---

## Receipt Format Examples

### Example 1: Standard Cash Payment Receipt
```
=====================================
    KHUSHI PUBLIC SCHOOL
    Deoley, Shekhpura, Bihar
    Contact: 0149-2082596
=====================================
Receipt No: R-0125
Date: 06-03-2026
Student: Priya Sharma
Roll No: ADM001
Class: IX-A
-------------------------------------
PARTICULARS:
Tuition Fee (Mar 2026)     ₹ 3,000
Transport Fee (Mar 2026)   ₹ 1,500
Lab/IT Fee (Mar 2026)      ₹   500
-------------------------------------
Subtotal:                  ₹ 5,000
Discount:                  ₹     0
Late Fee:                  ₹     0
-------------------------------------
TOTAL PAID:                ₹ 5,000
-------------------------------------
Payment Method: Cash
Transaction Ref: -
-------------------------------------
This is a computer-generated receipt.
No signature required.
=====================================
```

### Example 2: Online UPI Payment Receipt
```
=====================================
    KHUSHI PUBLIC SCHOOL
    Education for Excellence
    Deoley, Shekhpura, Bihar
=====================================
Receipt No: R-0126
Date: 06-03-2026 10:45 AM
-------------------------------------
Student: Rahul Kumar
Roll No: ADM002
Class: X-B
Phone: +91-9876543210
-------------------------------------
FEE DETAILS:
Tuition Fee (Mar-Apr 2026) ₹ 6,000
Transport Fee (Mar-Apr)    ₹ 3,000
-------------------------------------
Gross Amount:              ₹ 9,000
Early Payment Discount:    ₹  -500
Net Amount:                ₹ 8,500
-------------------------------------
TOTAL PAID:                ₹ 8,500
-------------------------------------
Payment Method: UPI
UPI Transaction ID: 234567890123
Paid via: Google Pay
Status: SUCCESS ✓
-------------------------------------
Thank you for your payment!
=====================================
```

---

## Troubleshooting

### Issue 1: Receipt not printing
**Solution:**
- Check printer connection
- Verify browser print permissions
- Try "Print" from browser menu
- Use thermal printer if available

### Issue 2: Receipt number not incrementing
**Solution:**
- Check `AppState.receipts.length`
- Ensure receipts are saved to array
- Verify database sync

### Issue 3: Missing school details
**Solution:**
- Update `AppState.settings.school` object
- Check school info in database
- Reload settings from backend

### Issue 4: Thermal printer garbled text
**Solution:**
- Check character encoding (UTF-8/Latin-1)
- Verify ESC/POS command syntax
- Test with different font variants
- Ensure proper line width (48 chars)

---

## Future Enhancements

### Planned Features:
1. **Email Receipt** - Automatically email receipt to parent
2. **SMS Receipt** - Send receipt link via SMS
3. **QR Code** - Add QR for digital verification
4. **Receipt Templates** - Multiple pre-designed templates
5. **Batch Printing** - Print multiple receipts at once
6. **Receipt Analytics** - Track payment patterns
7. **Digital Signature** - Add authorized signature image
8. **Multi-language** - Receipt in Hindi/Regional languages

---

## Support & Contact

For receipt customization or technical support:
- Check `/docs` folder for more guides
- Review `THERMAL_PRINTER_GUIDE.md` for thermal printing
- See `RAZORPAY_SETUP.md` for online payment receipts

---

**Document Version:** 1.0  
**Last Updated:** March 6, 2026  
**Maintained by:** School Admin Portal Development Team
