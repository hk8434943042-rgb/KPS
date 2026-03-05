#!/usr/bin/env python3
"""Test SMTP configuration for Gmail"""

import smtplib
import os
from email.message import EmailMessage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get SMTP config
smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
smtp_port = int(os.environ.get('SMTP_PORT', '587'))
smtp_user = os.environ.get('SMTP_USER', '')
smtp_pass = os.environ.get('SMTP_PASS', '')
smtp_from = os.environ.get('SMTP_FROM', '')

print("=" * 60)
print("SMTP Configuration Test")
print("=" * 60)
print(f"Host: {smtp_host}")
print(f"Port: {smtp_port}")
print(f"User: {smtp_user}")
print(f"From: {smtp_from}")
print(f"Password: {'*' * len(smtp_pass)} (length: {len(smtp_pass)})")
print("=" * 60)

if not all([smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from]):
    print("❌ ERROR: Missing SMTP configuration!")
    exit(1)

try:
    print("\n📡 Connecting to SMTP server...")
    server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
    print("✓ Connected to server")
    
    print("🔒 Starting TLS...")
    server.starttls()
    print("✓ TLS enabled")
    
    print("🔐 Logging in...")
    server.login(smtp_user, smtp_pass)
    print("✓ Login successful!")
    
    print("\n📧 Sending test email...")
    msg = EmailMessage()
    msg['Subject'] = 'SMTP Test - School Admin Portal'
    msg['From'] = smtp_from
    msg['To'] = smtp_user
    msg.set_content('This is a test email from School Admin Portal OTP system.\n\nIf you received this, SMTP is working correctly!')
    
    server.send_message(msg)
    print("✓ Email sent!")
    
    server.quit()
    print("\n" + "=" * 60)
    print("✅ SUCCESS! Gmail SMTP is configured correctly!")
    print("=" * 60)
    
except smtplib.SMTPAuthenticationError as e:
    print(f"\n❌ AUTHENTICATION FAILED: {e}")
    print("\nPossible causes:")
    print("1. Wrong app password (check Google Account settings)")
    print("2. 2-Step Verification not enabled")
    print("3. Email or password has extra spaces")
    exit(1)
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    exit(1)
