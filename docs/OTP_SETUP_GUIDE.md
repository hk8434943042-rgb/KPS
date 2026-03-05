# 📱 OTP Setup Guide - Send SMS & Email OTP

Your school admin portal has **built-in OTP functionality** for:
- Password reset
- Two-factor authentication
- Secure login verification

## 🎯 Two Options to Send OTP

### Option 1: Email OTP (FREE - Recommended for Testing)
### Option 2: SMS OTP (Twilio - Paid but professional)

---

## 📧 Option 1: Email OTP Setup (FREE with Gmail)

### Step 1: Enable Gmail App Password

1. **Go to your Google Account**: https://myaccount.google.com/
2. **Enable 2-Step Verification**:
   - Go to Security → 2-Step Verification
   - Follow the setup wizard
3. **Create App Password**:
   - Go to Security → App passwords
   - Select app: Mail
   - Select device: Other (Custom name)
   - Enter name: "School Admin Portal"
   - Click **Generate**
   - **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

### Step 2: Update .env File

Open `.env` file and update these values:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_actual_email@gmail.com
SMTP_PASS=your_16_char_app_password_here
SMTP_FROM=your_actual_email@gmail.com
SMTP_USE_TLS=true
```

**Example:**
```env
SMTP_USER=himanshu.school@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM=Khushi Public School <himanshu.school@gmail.com>
```

### Step 3: Restart Backend Server

```bash
# Stop current server (Ctrl + C)
# Restart server
cd backend
python app.py
```

### ✅ Test Email OTP

1. Go to login page
2. Click "Forgot Password"
3. Select **Email** as OTP channel
4. Enter your email
5. Click "Send OTP"
6. Check your email inbox

---

## 📱 Option 2: SMS OTP Setup (Twilio)

### Why Twilio?
- ✅ **FREE Trial**: $15.50 credit (approx. 400 SMS)
- ✅ Professional SMS delivery
- ✅ Works worldwide
- ✅ Reliable and fast

### Step 1: Create Twilio Account

1. **Sign up**: https://www.twilio.com/try-twilio
   - Email: Your email
   - Password: Create strong password
   - Verify email
2. **Verify your phone number**
   - Enter your mobile number
   - Enter OTP received

### Step 2: Get Twilio Credentials

1. **Go to Console**: https://console.twilio.com/
2. **Get Account SID and Auth Token**:
   - You'll see them on dashboard
   - **Account SID**: Starts with `AC...`
   - **Auth Token**: Click "Show" to view
3. **Get Phone Number** (Required for sending SMS):
   - Click "Get a Trial Number"
   - Or go to Phone Numbers → Manage → Buy a number
   - **Copy the number** (e.g., `+1234567890`)

### Step 3: Update .env File

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
```

### Step 4: Add Verified Phone Numbers (Trial Mode)

⚠️ **Important**: In trial mode, you can only send SMS to verified numbers.

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
2. Click **Add a new Caller ID**
3. Enter mobile number with country code (e.g., `+919572746736`)
4. Verify with OTP

### Step 5: Restart Backend Server

```bash
# Stop current server (Ctrl + C)
# Restart server
cd backend
python app.py
```

### ✅ Test SMS OTP

1. Go to login page
2. Click "Forgot Password"
3. Select **SMS (Mobile)** as OTP channel
4. Enter verified mobile number: `+919572746736`
5. Click "Send OTP"
6. Check your SMS

---

## 🔧 Quick Configuration Summary

### Minimum Required (Choose ONE):

**For Email OTP:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com
SMTP_USE_TLS=true
```

**For SMS OTP:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_FROM_NUMBER=+1234567890
```

**Optional:**
```env
OTP_TTL_SECONDS=300  # OTP valid for 5 minutes
```

---

## 🧪 Testing Your OTP Setup

### Test via Forgot Password Flow:

1. Open: http://localhost:5000 or your login page
2. Click **"Forgot Password"**
3. Select channel (Email or SMS)
4. Enter recipient (email or mobile)
5. Click **"Send OTP"**
6. Check email/SMS for 6-digit code
7. Enter OTP and verify

### Test via API (Advanced):

```bash
# Send OTP
curl -X POST http://localhost:5000/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email",
    "recipient": "test@example.com",
    "purpose": "password_reset"
  }'

# Verify OTP
curl -X POST http://localhost:5000/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "xxx",
    "otp_code": "123456"
  }'
```

---

## 🚨 Troubleshooting

### Email OTP Not Working?

**Error: "SMTP is not configured"**
- Check `.env` file has correct SMTP values
- Restart backend server after editing `.env`

**Error: "Authentication failed"**
- Use **App Password**, NOT your Gmail password
- Enable 2-Step Verification on Google Account
- Generate new App Password

**Email not received?**
- Check Spam/Junk folder
- Verify SMTP_USER is correct
- Check if 2FA is enabled on Gmail

### SMS OTP Not Working?

**Error: "Twilio SMS is not configured"**
- Check all 3 Twilio variables in `.env`
- Restart backend server

**Error: "Unable to create record"**
- Add recipient to Verified Caller IDs (Trial mode)
- Check phone number format: `+919572746736`

**Error: "Invalid phone number"**
- Use international format: `+91` + 10-digit number
- Remove spaces/dashes

### Check Backend Logs:

```bash
# View console output
# Look for OTP-related errors
```

---

## 💰 Cost Comparison

| Method | Setup | Cost | Speed | Recommended For |
|--------|-------|------|-------|----------------|
| **Email** | 5 min | FREE | 2-5 sec | Development, Testing |
| **SMS (Twilio)** | 10 min | $0.0075/SMS | 1-2 sec | Production, Professional |

---

## 🎯 Recommended Setup for You

### For Development/Testing:
✅ **Use Email OTP** (FREE with Gmail)

### For Production:
✅ **Use SMS OTP** (Twilio) for better user experience
✅ Keep Email OTP as backup

---

## 📝 Next Steps

1. ✅ Choose your OTP method (Email or SMS)
2. ✅ Update `.env` file with credentials
3. ✅ Restart backend server
4. ✅ Test OTP functionality
5. ✅ Deploy to production

---

## 🔒 Security Best Practices

- ✅ Never commit `.env` file to Git
- ✅ Use different credentials for production
- ✅ Rotate credentials periodically
- ✅ Keep OTP TTL short (5 minutes)
- ✅ Rate limit OTP requests
- ✅ Use HTTPS in production

---

## 📞 Need Help?

If you need help setting up:
1. Check error messages in browser console
2. Check backend logs
3. Verify `.env` file configuration
4. Make sure you restarted the backend server

---

**📌 Quick Start:** Use **Email OTP** with Gmail for immediate testing!
