# 🏢 Reception Access Control

## Access Comparison: Admin vs Reception

| Feature | Main Admin | Reception | Notes |
|---------|------------|-----------|-------|
| **Dashboard** | ✅ Full Access | ✅ Full Access | View KPIs, stats, charts |
| **Students** | ✅ Full Access | ✅ Full Access | Add, edit, view students |
| **Fees** | ✅ Full Access | ✅ Full Access | Collect payments, view receipts |
| **Classes** | ✅ Full Access | ✅ Full Access | Manage classes and sections |
| **Exams** | ✅ Full Access | ❌ **No Access** | **ADMIN ONLY** |
| **Teachers** | ✅ Full Access | ✅ Full Access | View and manage teachers |
| **Staff** | ✅ Full Access | ✅ Full Access | View and manage staff |
| **Parents** | ✅ Full Access | ❌ **No Access** | **ADMIN ONLY** |
| **Transport** | ✅ Full Access | ✅ Full Access | Manage routes and vehicles |
| **Notices** | ✅ Full Access | ✅ Full Access | Post and manage announcements |
| **Settings** | ✅ Full Access | ❌ **No Access** | **ADMIN ONLY** - System configuration |
| **Audit Logs** | ✅ Full Access | ❌ **No Access** | **ADMIN ONLY** - Security tracking |

---

## 🔐 Login Credentials

### Main Admin (Full Access)
```
Username: admin
Password: admin123
```

### Reception (Limited Access)
```
Username: reception
Password: reception123
```

---

## 🎯 Reception Capabilities

**Reception users CAN:**
- ✅ View dashboard and statistics
- ✅ Add new student admissions
- ✅ Edit existing student information
- ✅ Collect fee payments
- ✅ Print/generate receipts
- ✅ Manage student attendance
- ✅ View teacher and staff information
- ✅ Post notices and announcements
- ✅ Manage transport assignments

**Reception users CANNOT:**
- ❌ Access system settings
- ❌ Change security credentials
- ❌ View audit logs
- ❌ Manage exam schedules
- ❌ Access parent portal management
- ❌ Modify user permissions

---

## 🛡️ Security Features

### Visual Indicators
When logged in as **Reception**, you'll see:
- Username display: **"[Name] (Reception)"** in top-right
- Hidden menu items: Settings, Exams, Audit, Parents sections won't appear
- Access denied alerts: If trying to access restricted sections

### Protection
- URL-based access blocked (can't access by typing URL)
- Menu items hidden from view
- Alert notifications for unauthorized access attempts
- Automatic redirect to Dashboard if restricted view is accessed

---

## 💡 How It Works

```javascript
// System checks user role on every action
if (userRole === 'reception') {
  // Hide admin-only sections
  // Block access to restricted views
  // Show role indicator in UI
}
```

---

## 🔄 Switching Between Roles

### To Login as Admin:
1. Go to login page
2. Click **"Main Admin"** tab
3. Use admin credentials

### To Login as Reception:
1. Go to login page
2. Click **"Reception"** tab
3. Use reception credentials

### To Logout and Switch:
1. Click **"Logout"** button in top-right
2. You'll return to login page
3. Select different role tab

---

## 📊 Use Cases

### Reception Desk Workflow:
1. **Morning:** Check dashboard for today's attendance
2. **Admissions:** Add new student when they arrive
3. **Fee Collection:** Record payments and print receipts
4. **Inquiries:** Look up student information
5. **Announcements:** Post notices about events

### Admin Workflow:
1. **System Setup:** Configure school settings
2. **Security:** Review audit logs
3. **Exam Management:** Schedule and manage exams
4. **Parent Portal:** Manage parent accounts
5. **All Reception Tasks:** Plus full system control

---

## 🔧 Customization

If you need to adjust Reception permissions, you can modify:

**File:** `frontend/script.js`
**Function:** `applyRoleBasedAccess()`

```javascript
// Add/remove views from these arrays:
const receptionAllowedViews = [
  'dashboard', 'students', 'fees', 
  'classes', 'teachers', 'staff', 
  'transport', 'notices'
];

const adminOnlyViews = [
  'exams', 'settings', 'audit', 'parents'
];
```

---

## 📞 Support

For questions about access control:
- Email: himanshunsingh3596@gmail.com
- Check: Documentation in `/docs` folder

---

*Last Updated: March 4, 2026*
