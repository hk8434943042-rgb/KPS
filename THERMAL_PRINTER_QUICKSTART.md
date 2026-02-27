# 🖨️ Quick Start: Thermal Printer Receipts

## 5-Minute Setup

### Step 1: Code is Already Installed ✅
- Backend Flask endpoints ready
- Frontend JavaScript ready
- Documentation complete

### Step 2: Connect Your Thermal Printer

**USB Connection (Easiest):**
1. Connect thermal printer via USB
2. Install printer drivers from manufacturer
3. Restart your browser
4. Done!

### Step 3: Test It

Go to Admin Dashboard → Finances → Fee Management → Scroll down to "Recent Receipts"

Click any **🖨️ Print** button

You'll see:
```
🖨️ Print Options:
OK → Thermal Printer (ESC/POS Format)
Cancel → Regular Printer (Browser Print)
```

- Click **OK** for thermal printer
- Click **Cancel** for regular printer

### Done! 🎉

---

## How to Use

### Method 1: From Admin Dashboard
1. Admin Dashboard → Finances → Fee Management
2. Find receipt in "Recent Receipts" table
3. Click **🖨️ Print**
4. Choose thermal or regular printer
5. Receipt prints!

### Method 2: After Student Payment
1. Make student payment in Parent Portal
2. Receipt notification appears
3. Click print button in dialog
4. Choose printer
5. Receipt prints!

---

## What Gets Printed

Your receipt looks like this:

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

---

## Printer Requirements

### What You Need
- A thermal printer (like Epson TM-T88V, Zebra, Star Micronics, etc.)
- Thermal receipt paper (80mm wide)
- USB cable or network connection

### Popular Printers That Work
- Epson TM-T88V
- Zebra P88
- Star Micronics SRP-382
- Bixolon SRP-S300
- Any ESC/POS compatible printer

---

## Troubleshooting

### Problem: "Printer not detected"
**Solution:** Check USB cable, install drivers, restart browser

### Problem: "Text is garbled/wrong"
**Solution:** Verify printer supports ESC/POS, update printer drivers

### Problem: "Won't print to thermal"
**Solution:** Try HTML format (Browser Print) instead

### Problem: "Paper isn't feeding"
**Solution:** Check paper roll alignment, clean printer head

---

## Features

✅ Professional receipts  
✅ Automatic number generation  
✅ Date & time included  
✅ Student info automatic  
✅ Payment method tracked  
✅ Paper cuts automatically  
✅ Fast (2-3 seconds per receipt)  
✅ No ink needed  

---

## Customization

### Change School Name
Edit `/backend/01_app.py` around line 478:
```python
receipt.append("YOUR SCHOOL NAME\n".encode('utf-8'))
```

### Change Receipt Format
Edit `/frontend/script.js` around line 698:
```javascript
receipt_number: 'YOUR-FORMAT-' + String(number).padStart(5, '0')
```

---

## FAQ

**Q: Do I need a physical printer?**  
A: No! Test with browser print dialog. Physical printer only for actual thermal printing.

**Q: Works with regular A4 printer?**  
A: Yes! Click "Cancel" when prompted to use regular printer.

**Q: How much does it cost?**  
A: Paper: ₹2-5 per receipt. No ink needed!

**Q: Can I print multiple receipts?**  
A: Yes, click print button for each receipt.

**Q: Where are receipts stored?**  
A: In application data. Receipts can be reprinted anytime.

**Q: Can I email receipts?**  
A: Not yet, coming soon!

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Printer offline | Check USB cable, restart printer |
| Paper not feeding | Clean printer head, realign paper |
| Text is garbled | Update printer drivers |
| No printer option | Install printer & drivers |
| Slow printing | Check printer is not busy |

---

## Next Steps

1. ✅ Connect thermal printer (or regular printer for testing)
2. ✅ Go to Admin Dashboard
3. ✅ Click on Finances → Fee Management
4. ✅ Find a receipt and click Print
5. ✅ Choose your printer type
6. ✅ Receipt prints!

---

## Get More Help

- Detailed Guide: [THERMAL_PRINTER_GUIDE.md](docs/THERMAL_PRINTER_GUIDE.md)
- Setup Instructions: [THERMAL_PRINTER_SETUP.md](docs/THERMAL_PRINTER_SETUP.md)
- API Documentation: [THERMAL_PRINTER_API.md](docs/THERMAL_PRINTER_API.md)

---

## Support

**Questions?** Check the detailed documentation or contact support.

**Ready?** Go print your first receipt! 🎉

---

**Version:** 1.0  
**Status:** Ready to Use
