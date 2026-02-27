# Razorpay Payment Integration Guide

## Overview

This document provides instructions for integrating and configuring Razorpay payment gateway for fee payments in the School Admin Portal's Parent Portal.

## Features

✅ **Secure Online Payment Processing**: Parents can pay fees using Razorpay's secure checkout  
✅ **Multiple Payment Methods**: UPI, Credit Cards, Debit Cards, Net Banking, Digital Wallets  
✅ **Real-time Payment Status**: Immediate confirmation and receipt generation  
✅ **Payment Tracking**: All payment records stored with Razorpay details  
✅ **Student-Specific Payments**: Fees linked to individual student records  

## Prerequisites

- Razorpay Account (Free to create at https://razorpay.com)
- Test Mode Keys (for development/testing)
- Live Mode Keys (for production)

## Step 1: Create Razorpay Account

1. Visit https://razorpay.com
2. Sign up for a free account
3. Complete the verification process
4. Log in to your Razorpay Dashboard

## Step 2: Get Your API Keys

### For Testing/Development:
1. Go to **Settings** → **API Keys** in your Razorpay Dashboard
2. Copy your **Key ID** from the Test Mode section
3. Keep your **Key Secret** safe (store on backend only)

### For Production:
1. Activate Live Mode in your Razorpay account
2. Copy your **Key ID** from the Live Mode section
3. Ensure Key Secret is stored securely on backend

## Step 3: Configure in Application

### Frontend Configuration (index.html & script.js)

#### 1. Update Razorpay Key in `script.js`

Find this section in `script.js`:

```javascript
const RAZORPAY_CONFIG = {
  keyId: 'rzp_test_1OfccbDDELVqHo',  // Replace with your actual key
  keySecret: 'test_key_secret',       // Store safely on backend only
  serviceName: 'KHUSHI PUBLIC SCHOOL - Fee Payment'
};
```

Replace `keyId` with your actual Key ID from Razorpay:

```javascript
const RAZORPAY_CONFIG = {
  keyId: 'rzp_live_YOUR_ACTUAL_KEY_ID_HERE',  // Your production key
  keySecret: 'keep_on_backend_only',
  serviceName: 'KHUSHI PUBLIC SCHOOL - Fee Payment'
};
```

### Backend Configuration (Recommended)

For production, you should implement a backend API endpoint to:
1. Create orders on Razorpay
2. Verify payment signatures
3. Update fee records securely

**Example Node.js/Express endpoint:**

```javascript
// Backend: POST /api/fee-payment/create-order
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.post('/api/fee-payment/create-order', async (req, res) => {
  try {
    const { amount, roll, studentName } = req.body;
    
    const options = {
      amount: amount * 100, // Amount in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        studentRoll: roll,
        studentName: studentName
      }
    };
    
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backend: POST /api/fee-payment/verify
app.post('/api/fee-payment/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
  const crypto = require('crypto');
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  
  if (expectedSignature === razorpay_signature) {
    // Payment verified - update fee records
    res.json({ status: 'success', verified: true });
  } else {
    res.status(400).json({ status: 'failed', verified: false });
  }
});
```

## Step 4: Parent Portal Usage

### How Parents Pay Fees:

1. **Login**: Parent logs in with their credentials
2. **Select Child**: If multiple children, select the child
3. **Go to Fees Tab**: Click on the "💳 Fees" tab in the parent portal
4. **Pay Fee Button**: Click "💳 Pay Fee" button
5. **Fill Details**: 
   - Enter amount to pay
   - Enter full name
   - Enter email address
   - Enter phone number
6. **Authorize**: Click "Pay with Razorpay"
7. **Select Method**: Choose UPI, Card, or other payment method
8. **Complete Payment**: Authenticate and complete the payment
9. **Receipt**: Automatic receipt generation and fee update

## Testing

### Test Mode (Development)

Use these test credentials provided by Razorpay:

**Test Cards:**
- **Visa**: 4111 1111 1111 1111
- **Mastercard**: 5555 5555 5555 4444

**CVV**: Any 3 digits  
**Expiry**: Any future date

**UPI**: Any UPI ID (e.g., success@razorpay)

### Test Payment Flow:

1. Open Parent Portal
2. Login with test credentials (parent1 / parent123)
3. Go to Fees tab
4. Click "Pay Fee"
5. Fill in test details
6. Click "Pay with Razorpay"
7. Use test card/UPI credentials
8. Complete the payment
9. Verify receipt is generated

## Production Setup

### Before Going Live:

1. ✅ Complete Razorpay's business verification
2. ✅ Activate Live Mode in your Razorpay account
3. ✅ Update API keys to production keys
4. ✅ Implement backend verification endpoint
5. ✅ Set environment variables securely
6. ✅ Test end-to-end with small amount
7. ✅ Configure DNS and SSL certificates
8. ✅ Set up automated payment reconciliation
9. ✅ Configure email/SMS notifications

### Razorpay Live Dashboard:

- Monitor all transactions
- View payment reports
- Set up webhooks for real-time updates
- Configure refunds if needed

## Security Best Practices

1. **Never expose Key Secret**: Keep it on backend only
2. **Use HTTPS**: Ensure all payment communication is encrypted
3. **Verify Signatures**: Always verify Razorpay payment signatures on backend
4. **Secure Storage**: Encrypt payment data in database
5. **Environment Variables**: Use .env files for sensitive data
6. **Rate Limiting**: Implement rate limiting on payment endpoints
7. **Audit Logs**: Log all payment transactions

## Troubleshooting

### "Razorpay not defined" error:
- Ensure Razorpay script is loaded: `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>`

### Payment modal not opening:
- Check if JavaScript console has errors
- Verify Razorpay key ID is correct
- Check browser console for network errors

### Payment succeeds but fee not updated:
- Verify backend verification endpoint is working
- Check localStorage for AppState
- Review browser developer tools

### Test payment not working:
- Use only Razorpay test card numbers
- Ensure you're in Test Mode in Razorpay Dashboard
- Clear browser cache and try again

## Support & Resources

- **Razorpay Documentation**: https://razorpay.com/docs/
- **Razorpay Support**: https://razorpay.com/contact/
- **Integration Guide**: https://razorpay.com/docs/payments/integration/

## File Changes Summary

### Modified Files:

1. **index.html**
   - Added Razorpay script CDN link
   - Updated payment modal HTML with new form fields
   - Removed manual payment method selection

2. **script.js**
   - Added RAZORPAY_CONFIG with key settings
   - Added RazorpayState for payment tracking
   - Created initiateRazorpayPayment() function
   - Created handleRazorpaySuccess() function
   - Created handleRazorpayError() function
   - Created handleRazorpayCancel() function
   - Created processRazorpayPayment() function
   - Updated initParentPayFeeModal() to support Razorpay

## Sample Receipt Format

After successful payment, parents receive:
```
✅ Payment Successful!

Receipt No: R-0001
Amount: ₹5000
Payment ID: pay_1A2B3C4D5E6F7G8H
Student: Priya Kumari (Roll: 1001)
Payment Method: Razorpay
Date: 2026-02-09

Thank you for the payment!
```

## Next Steps

1. Create Razorpay account
2. Get test mode API keys
3. Update RAZORPAY_CONFIG in script.js
4. Test payment flow in your browser
5. Once satisfied, implement backend verification
6. Go live with production keys

---

**Last Updated**: February 2026  
**Maintained By**: Himanshu Kumar  
**Version**: 1.0
