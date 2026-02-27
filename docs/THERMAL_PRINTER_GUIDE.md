# Thermal Printer Receipt Guide 🖨️

## Overview
The school admin portal now supports printing fee receipts on **thermal printers** (like the ones used at petrol pumps and retail shops). This provides fast, professional receipts without requiring large paper or expensive ink cartridges.

## Features
✅ ESC/POS Format (Standard thermal printer format)  
✅ HTML Receipt Format (Browser printing)  
✅ Receipt Number Auto-generation  
✅ Automatic School Name & Details  
✅ Student Information Integration  
✅ Payment Method Tracking  
✅ Professional Formatting  

---

## Hardware Requirements

### Supported Thermal Printers
- **80mm Width Thermal Printer** (Most common)
- **58mm Width Thermal Printer** (Compact)
- **ESC/POS Compatible Printers** (Standard format)

### Popular Brands
- Zebra
- Epson TM Series
- Star Micronics
- Bixolon
- Any ESC/POS compatible printer

### Connection Methods
1. **USB** - Plug & Play (Recommended)
2. **Serial (COM Port)** - For older systems
3. **Ethernet/Network** - For networked printers
4. **Bluetooth** - For wireless printers

---

## How to Use

### Method 1: Print from Receipt List (Admin Dashboard)

1. Navigate to **Admin Dashboard** → **Fee Management** → **Recent Receipts**
2. Find the receipt you want to print
3. Click the **🖨️ Print** button next to the receipt
4. Choose your printing option:
   - **OK** → Thermal Printer (ESC/POS)
   - **Cancel** → Regular Printer (Browser Print)

### Method 2: Print After Payment (Parent Portal)

1. After a student payment is completed:
   - A receipt is automatically generated
   - You can click the print button to print immediately
   - Receipt details appear in the payment confirmation dialog

### Method 3: Programmatic Printing

```javascript
// Print receipt using thermal printer
printThermalReceipt(
  paymentId,        // Payment identifier
  "Student Name",   // Student full name
  "ADM001",        // Admission number
  5000,            // Amount in rupees
  "Cash",          // Payment method (Cash/Online/Check)
  "Monthly Fee"    // Purpose
);

// Print using HTML format
printHTMLReceipt({
  receipt_number: 'RCP-00001',
  payment_date: '2026-02-26',
  student_name: 'John Doe',
  roll_no: 'ADM001',
  amount: 5000,
  payment_method: 'Cash',
  purpose: 'Monthly Fee'
});
```

---

## Receipt Format

### Thermal Receipt Layout (80mm)
```
    KHUSHI PUBLIC SCHOOL
          Fee Receipt
        ================================
        
Receipt No.: RCP-00001
Date: 26-02-2026
Student: Priya Kumari
Admission No.: 1001

        --------------------------------
Purpose: Monthly Fee
Amount: Rs. 5,000.00
Method: Cash
        --------------------------------
        
              Thank You!
            For Payment

        (Original Receipt)

        ================================
```

### HTML Receipt Format
- Professional formatted receipt
- School header with name and details
- Student information section
- Payment amount highlighted
- Print-optimized styling

---

## API Endpoints

### 1. Generate Thermal Receipt (ESC/POS)
**Endpoint:** `POST /api/receipt/thermal`

**Request Body:**
```json
{
  "payment_id": 1,
  "student_name": "Priya Kumari",
  "roll_no": "1001",
  "amount": 5000,
  "payment_method": "Cash",
  "purpose": "Monthly Fee",
  "receipt_number": "RCP-00001",
  "payment_date": "2026-02-26"
}
```

**Response:**
```json
{
  "success": true,
  "receipt": "ESC/POS byte commands as string",
  "message": "Receipt generated successfully"
}
```

### 2. Generate HTML Receipt
**Endpoint:** `POST /api/receipt/html`

**Request Body:**
```json
{
  "receipt_number": "RCP-00001",
  "payment_date": "2026-02-26",
  "student_name": "Priya Kumari",
  "roll_no": "1001",
  "amount": 5000,
  "payment_method": "Cash",
  "purpose": "Monthly Fee"
}
```

**Response:** HTML document (returns as `text/html`)

---

## Browser Printing (Regular Printer)

If your thermal printer is connected via USB and shows up as a regular printer in Windows:

1. Click the **Print** button
2. Select **Cancel** when prompted (to skip thermal option)
3. Your browser's print dialog will open
4. Select your thermal printer from the printer list
5. Adjust page size to **80mm x Auto** if available
6. Click **Print**

---

## Web Serial API (Direct USB Connection)

### Requirements
- **Chrome/Edge v89+** or **Brave Browser**
- USB thermal printer connected directly to computer
- User permission to access the serial port

### How It Works
1. Click **Print** button
2. Select **OK** (Thermal Printer option)
3. A dialog will ask for printer permission
4. Receipt sends directly to printer via USB

---

## Terminal Printer Setup (Windows)

### Check Printer Connection
```powershell
# PowerShell command to list USB devices
Get-PnpDevice | Where-Object { $_.Class -eq 'Printer' }

# Or check COM ports
Get-PnpDevice | Where-Object { $_.Class -eq 'Ports' }
```

### Configure as Network Printer
```powershell
# Share printer on network
net share printername=C:\port /grant:Everyone,FULL

# Add to network
Add-Printer -ConnectionName "\\computername\printername"
```

---

## Troubleshooting

### Issue: Printer Not Detected
**Solution:**
1. Check USB cable connection
2. Install printer drivers from manufacturer
3. Restart the browser and try again
4. Check Windows Device Manager for the printer

### Issue: Receipt Prints Incorrectly
**Solution:**
1. Check paper width (80mm or 58mm)
2. Try HTML format instead of thermal
3. Adjust paper size in printer settings
4. Check printer ESC/POS compatibility

### Issue: Web Serial API Not Available
**Solution:**
1. Use Chrome, Edge, or Brave browser
2. Update to latest browser version
3. Enable the feature if disabled:
   - Chrome: `chrome://flags/#serial-ui`
   - Edge: `edge://flags/#serial-ui`

### Issue: Thermal Receipt Cuts Paper at Wrong Position
**Solution:**
1. Check paper roll alignment
2. Clean printer head with provided tools
3. Adjust cut position in settings (if supported)

---

## Settings & Customization

### Customize School Name in Receipt
Edit the backend file `/backend/01_app.py`:

```python
# Line ~478: Change school name
receipt.append("YOUR SCHOOL NAME\n".encode('utf-8'))
receipt.append("Fee Receipt\n".encode('utf-8'))
```

### Change Receipt Number Format
Modify in `/frontend/script.js`:

```javascript
// Line ~698: Change format
receipt_number: 'RCP-' + String(AppState.receipts.length + 1).padStart(5, '0')
// Or use custom format:
receipt_number: 'KHUSHI-' + new Date().getFullYear() + '-' + receiptCount
```

### Adjust Paper Width
For 58mm printers, modify the backend:

```python
# Change from 80mm to 58mm format
# Reduce spacing and adjust text width
```

---

## Features Coming Soon
- 🔜 Barcode/QR Code on receipts
- 🔜 Multiple receipt copies
- 🔜 Network printer support
- 🔜 Batch receipt printing
- 🔜 Receipt templates customization
- 🔜 Digital receipt (Email/WhatsApp)

---

## FAQ

**Q: Do I need to connect a physical thermal printer?**  
A: No! You can test with browser print dialog. A physical printer is needed only for actual thermal formatting.

**Q: Can I use this with a regular A4 printer?**  
A: Yes, use the HTML receipt format and print via browser dialog.

**Q: What if my printer uses a different format?**  
A: Contact support. Most modern thermal printers support ESC/POS standard.

**Q: Can receipts be emailed to parents?**  
A: Currently, HTML receipts can be printed and saved. Email feature coming soon.

**Q: Do I need special paper?**  
A: Yes, thermal printer paper (80mm x 30m roll is standard). Available at most office supply stores.

**Q: What's the cost per receipt?**  
A: Thermal paper costs ₹3-5 per receipt (much cheaper than ink printing).

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify your printer model supports ESC/POS
3. Check the browser console for error messages (F12)
4. Contact the development team with error details

---

## Resources

- [ESC/POS Command Reference](https://www.sparkfun.com/datasheets/Receipt%20Printer/ESCPOS.pdf)
- [Thermal Printer Setup Guide](https://www.posist.com/blog/thermal-printer-setup/)
- [Web Serial API Documentation](https://developer.chrome.com/articles/serial/)

---

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Ready for Production
