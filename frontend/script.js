/**
 * @fileoverview School Admin Portal - Main Application Script
 * Note: This file uses template literals with HTML. VS Code may show false 
 * JSX errors which can be ignored - the code is valid JavaScript.
 * 
 * eslint-disable no-unused-expressions, no-undef
 */
/* eslint-disable */
/* ============================
   School Admin Portal — script.js
   Author: Himanshu Kumar
   ============================ */

console.log('📜 script.js loading...');

// global error catching (helps debug freezes)
window.addEventListener('error', e => {
  console.error('Global error caught:', e.message, e.filename + ':' + e.lineno);
  // Don't show alert - it blocks the page
  // alert('An error occurred: ' + e.message);
});
window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled promise rejection:', e.reason);
  // Don't show alert - it blocks the page  
  // alert('An unhandled promise rejection occurred: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});

// ===========================
// AUTHENTICATION CHECK
// ===========================
// ===========================
// GLOBAL API CONFIGURATION
// ===========================
// API resolution order:
// 1) window.__API_BASE_URL (set in api-config.js)
// 2) localStorage API_URL_OVERRIDE
// 3) localhost -> local Flask server
// 4) production -> same origin /api
const API_URL = (() => {
  const configuredApi = (localStorage.getItem('API_URL_OVERRIDE') || window.__API_BASE_URL || '').trim();
  if (configuredApi) {
    return configuredApi.replace(/\/+$/, '');
  }

  const host = window.location.hostname;
  const port = window.location.port;
  if (window.location.protocol === 'file:') {
    return 'http://localhost:5000/api';
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://${host}:5000/api`;
  }

  // If frontend is served from a dev/static server port (e.g. 8000/5500/5173),
  // assume backend is running on port 5000 on the same machine/IP.
  if (port && port !== '5000') {
    return `http://${host}:5000/api`;
  }

  return `${window.location.origin}/api`;
})();

// ---------- Global State ----------
const AppState = {
  theme: 'system',
  view: 'dashboard', // Always start on dashboard
  selectedChildAdmissionNo: null, // For parent portal - tracks which child's data to display

  // Core data
  students: [],
  fees: {},          // key: `${admission_no}|${YYYY-MM}` -> { heads, paid, discount, lateFee, lastReceipt? }
  receipts: [],      // { no, date, roll (admission_no), name, method, amount, ref }

  // KPIs used by dashboard
  kpi: {
    totalStudents: 0,
    attendanceToday: 0.942,
    feesCollectedMonth: 0,
    issuesOpen: 0
  },

  // Pagination config
  pagination: {
    students: { page: 1, pageSize: 10, totalPages: 1, filtered: [] },
    fees: { page: 1, pageSize: 12, totalPages: 1, filtered: [] }
  },

  // Fee heads by class
  feeHeadsByClass: {},

  // Late fee rules (with sensible defaults)
  lateFeeRules: {
    cutoffDay: 10,
    graceDays: 0,
    cap: 200,
    startAfter: 0,
    slabs: [],                          // [{from:1, to:10, perDay:10}, {from:11, to:null, perDay:20}]
    skipSat: false,
    skipSun: false,
    holidays: [],                       // ["2026-03-08", ...]
    shiftRule: 'none',                  // 'none' | 'nextBusiness' | 'prevBusiness'
    applyToHeads: {                     // when true → late fee applies only if that head is included
      Tuition: true,
      Transport: true,
      Lab: false,
      Activity: false,
      Miscellaneous: true
    },
    classOverrides: {}                  // e.g., { "IX": { cap:300 }, "X": { cutoffDay:12 } }
  },

  // Settings (+ School profile)
  settings: {
    theme: 'system',
    currency: '₹',
    locale: 'en-IN',
    studentsPageSize: 10,
    defaultFeesMonth: null,
    chartAnimation: false,
    school: {
      name: 'KHUSHI PUBLIC SCHOOL',
      tagline: 'Deoley Sheikhpura',
      address: 'Sheikhpura, Bihar',
      phone: '+91-XXXXXXXXXX',
      email: 'himanshunsingh3596@gmail.com',
      logo: 'assets/logo.png'
    }
  },

  // Transport module
  transport: {
    routes: [],
    vehicles: [],
    assignments: [] // { roll (admission_no), routeId, stop, fee, status }
  },

  // Exams module
  exams: [],
  marks: {}, // key: `${examId}|${admission_no}` -> { obtainedMarks, status }

  // Teachers module
  teachers: [], // { id, name, phone, email, subjects, joinDate, salary, status }
  teacherAttendance: {}, // key: `${teacherId}|${date}` -> { status: 'present'|'absent'|'leave', remarks }
  salaryPayments: [], // { id, teacherId, month, amount, date, status }

  // Staff module (non-teaching)
  staff: [], // { id, name, role, phone, joinDate, salary, status }
  staffSalaryPayments: [], // { id, staffId, month, amount, date, status }

  // Classes module
  classes: [], // { id, class, section, classTeacherId, subjects: {subjectName: teacherId}, capacity, status }

  // Notices module
  notices: [], // { id, title, description, author, date, priority, status, audience }

  // Parents module
  parents: [], // { id, name, email, phone, address, relation, children? }
  selectedParentId: null
};

// ---------- Persistence ----------
const STORAGE_KEY = 'khushi_school_admin';
const RECEIPTS_CACHE_KEY = 'khushi_receipts_cache';

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
  if (Array.isArray(AppState.receipts) && AppState.receipts.length > 0) {
    localStorage.setItem(RECEIPTS_CACHE_KEY, JSON.stringify(AppState.receipts));
  }
}

function restoreReceiptsFromBackupIfNeeded() {
  const hasReceipts = Array.isArray(AppState.receipts) && AppState.receipts.length > 0;
  if (hasReceipts) return false;

  try {
    const backupRaw = localStorage.getItem(RECEIPTS_CACHE_KEY);
    if (!backupRaw) return false;
    const backupReceipts = JSON.parse(backupRaw);
    if (Array.isArray(backupReceipts) && backupReceipts.length > 0) {
      AppState.receipts = backupReceipts;
      return true;
    }
  } catch (e) {
    console.warn('Failed to restore receipt backup cache:', e);
  }

  return false;
}

// helper that performs fetch with a timeout (default 5s)
async function fetchWithTimeout(url, opts = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, ...opts });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// Merge server receipts with local list, preserving unsynced entries.
// Server receipts should include an `id` field; local receipts may only have
// a generated `no` value and `synced: false`.
function mergeReceipts(serverReceipts = []) {
  const map = new Map();
  (AppState.receipts || []).forEach(r => {
    const key = r.id != null ? `id:${r.id}` : `local:${r.no}`;
    map.set(key, r);
  });
  serverReceipts.forEach(sr => {
    const key = sr.id != null ? `id:${sr.id}` : `local:${sr.no}`;
    if (map.has(key)) {
      // merge, preserving any local-only fields (like months, previousUnpaid)
      const existing = map.get(key);
      map.set(key, { ...existing, ...sr, synced: true });
    } else {
      map.set(key, { ...sr, synced: true });
    }
  });
  return Array.from(map.values());
}

// Save a single local student to backend and get back the database ID
async function syncLocalStudentToBackend(student) {
  try {
    const payload = {
      roll_no: student.roll,
      admission_date: student.admission_date || '',
      aadhar_number: student.aadhar || '',
      name: student.name,
      email: student.email || '',
      phone: student.phone || '',
      class_name: student.class || '',
      section: student.section || '',
      date_of_birth: student.dob || '',
      address: student.address || '',
      father_name: student.father_name || '',
      mother_name: student.mother_name || '',
      status: student.status || 'Active'
    };
    
    const response = await fetchWithTimeout(`${API_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 10000);
    
    if (!response || !response.ok) {
      throw new Error(`Failed to save student: ${response?.status || 'no response'}`);
    }
    
    const result = await response.json();
    console.log('✅ Synced student to database:', result);
    return result.id; // Return the database ID
  } catch (e) {
    console.error('Error syncing student to backend:', e);
    throw e;
  }
}

// Fetch students from backend API and update AppState.students
async function fetchStudentsFromBackend() {
  try {
    console.log('[API] Fetching students from:', API_URL + '/students');
    const response = await fetchWithTimeout(`${API_URL}/students`, {}, 8000);
    if (!response || !response.ok) throw new Error(`Failed to fetch students: ${response?.status || 'no response'}`);
    const students = await response.json();
    
    // Map database fields to AppState format
    const backendList = students.map(s => ({
      id: s.id,
      roll: s.roll_no,               // Map roll_no to roll
      admission_date: s.admission_date || '',
      aadhar: s.aadhar_number || '',
      name: s.name,
      email: s.email || '',
      phone: s.phone || '',
      class: s.class_name || '',     // Map class_name to class
      section: s.section || '',
      dob: s.date_of_birth || '',
      address: s.address || '',
      father_name: s.father_name || '',
      mother_name: s.mother_name || '',
      status: s.status || 'Active',  // Persisted status or default
      created_at: s.created_at,
      updated_at: s.updated_at
    }));
    // if there are any students already in local state that the backend
    // did not return (e.g. added while offline), keep them so they don't
    // vanish unexpectedly.
    const backendIds = new Set(backendList.map(s => s.id));
    const localOnly = AppState.students.filter(s => s.id == null || !backendIds.has(s.id));

    // also, merge fields from local students into backend list where the
    // backend version is missing something useful. this helps when a user
    // edits a record while offline: the UI won't lose their changes when the
    // backend list (still old) comes back.
    const byId = {};
    backendList.forEach(s => { if(s.id!=null) byId[s.id] = s; });
    AppState.students.forEach(ls => {
      if(ls.id != null && byId[ls.id]){
        const bs = byId[ls.id];
        // prefer non-empty fields from local state
        ['admission_date','name','class','section','phone','status'].forEach(f=>{
          if((bs[f]===undefined || bs[f]==='' || bs[f]===null) && ls[f]){
            bs[f] = ls[f];
          }
        });
      }
    });

    AppState.students = backendList.concat(localOnly);
    
    AppState.kpi.totalStudents = AppState.students.length;
    console.log('Loaded students from backend:', AppState.students);
    return AppState.students;
  } catch (e) {
    console.warn('Could not load students from backend:', e);
    return [];
  }
}

// ---------- Server Connection Check ----------
let serverStatusCheckInterval = null;
let dataAutoSyncInterval = null;
let isServerConnected = false;

async function checkServerConnection() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    // Always resolve the latest runtime override (localStorage/window) so
    // server status doesn't stay stale after tunnel URL changes.
    const runtimeApi = (localStorage.getItem('API_URL_OVERRIDE') || window.__API_BASE_URL || API_URL || '').trim()
      .replace(/\/+$/, '');

    // Compute base address by stripping trailing "/api" so we can hit a simple
    // health URL regardless of api path configuration.
    const base = runtimeApi.replace(/\/api$/, '');

    // The backend exposes `/health` which responds quickly without CORS issues.
    const response = await fetch(base + '/health', {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const isConnected = response && response.ok;
    updateServerStatus(isConnected);
    console.log('Server check:', isConnected ? 'Connected ✓' : 'Disconnected ✗');
  } catch (e) {
    console.warn('Server connection check failed:', e.message);
    updateServerStatus(false);
  }
}

function updateServerStatus(isConnected) {
  isServerConnected = isConnected;
  if(isConnected){
    // attempt to push any receipts that were saved while offline
    if (typeof syncPendingReceipts === 'function') {
      syncPendingReceipts();
    }
  }
  const statusTopbar = document.getElementById('serverStatusTopbar');
  const statusDot = document.getElementById('serverStatusDot');
  const statusLabel = document.getElementById('serverStatusLabel');
  
  // also update login page indicator if present
  const loginStatusTopbar = document.getElementById('loginServerStatusTopbar');
  const loginStatusDot = document.getElementById('loginServerStatusDot');
  const loginStatusLabel = document.getElementById('loginServerStatusLabel');
  
  if (statusTopbar && statusDot && statusLabel) {
    if (isConnected) {
      statusDot.classList.add('connected');
      statusDot.classList.remove('disconnected');
      statusLabel.textContent = 'Online';
      statusTopbar.classList.add('connected');
      statusTopbar.classList.remove('disconnected');
    } else {
      statusDot.classList.remove('connected');
      statusDot.classList.add('disconnected');
      statusLabel.textContent = 'Offline';
      statusTopbar.classList.remove('connected');
      statusTopbar.classList.add('disconnected');
    }
  }
  
  if (loginStatusDot && loginStatusLabel) {
    if (isConnected) {
      loginStatusDot.classList.add('connected');
      loginStatusDot.classList.remove('disconnected');
      loginStatusLabel.textContent = 'Online';
    } else {
      loginStatusDot.classList.remove('connected');
      loginStatusDot.classList.add('disconnected');
      loginStatusLabel.textContent = 'Offline';
    }
  }
}

// Auto-sync data from database every 30 seconds
async function autoSyncData() {
  if (!isServerConnected) {
    console.log('📴 Skipping auto-sync: Server offline');
    return;
  }
  
  try {
    console.log('🔄 Auto-syncing data from database...');
    await fetchStudentsFromBackend();
    await fetchTeachersFromBackend();
    console.log('✅ Auto-sync complete');
    saveState(); // Save synced data to localStorage as backup
    
    // Re-render if on students view
    if (AppState.view === 'students' && typeof renderStudents === 'function') {
      renderStudents();
    }
    if (AppState.view === 'teachers' && typeof renderTeachers === 'function') {
      renderTeachers();
    }
  } catch (e) {
    console.warn('⚠️ Auto-sync failed:', e.message);
  }
}

function startDataAutoSync() {
  // Do initial sync immediately
  setTimeout(autoSyncData, 2000);
  
  // Then start auto-sync every 30 seconds
  if (dataAutoSyncInterval) clearInterval(dataAutoSyncInterval);
  dataAutoSyncInterval = setInterval(autoSyncData, 30000);
  console.log('🔄 Auto-sync enabled (every 30 seconds)');
}

function stopDataAutoSync() {
  if (dataAutoSyncInterval) {
    clearInterval(dataAutoSyncInterval);
    dataAutoSyncInterval = null;
    console.log('🛑 Auto-sync disabled');
  }
}

function startServerStatusCheck() {
  // Initial check
  checkServerConnection();
  
  // Check every 10 seconds
  if (serverStatusCheckInterval) clearInterval(serverStatusCheckInterval);
  serverStatusCheckInterval = setInterval(checkServerConnection, 10000);
  
  // Start auto-sync of data from database
  startDataAutoSync();
}

function stopServerStatusCheck() {
  if (serverStatusCheckInterval) {
    clearInterval(serverStatusCheckInterval);
    serverStatusCheckInterval = null;
  }
  stopDataAutoSync();
}

function loadState() {
  try {
    // First: Load cached state from localStorage as a quick fallback
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      // Preserve last view on page load
      Object.assign(AppState, stored);
      if (!AppState.view) AppState.view = 'dashboard';
      // Check if stored data has all new classes, if not, reseed
      const requiredClasses = ['Nursery', 'LKG', 'UKG', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      const hasAllClasses = requiredClasses.every(cls => AppState.feeHeadsByClass[cls]);
      if (!hasAllClasses) {
        console.log('Updating to new class structure...');
        seedDemoData();
        saveState();
      }
    } else {
      seedDemoData();
      saveState();
    }
  } catch (e) {
    console.warn('Failed to load state', e);
    seedDemoData();
    saveState();
  }

  // Recover receipts from dedicated backup cache if main state has none.
  // This prevents Recent Receipts from disappearing due to partial/stale state writes.
  restoreReceiptsFromBackupIfNeeded();
  
  // IMPORTANT: Always fetch fresh data from database on page reload
  // This ensures data is always up-to-date, not stale from cache
  console.log('📡 Fetching fresh data from database on page reload...');
  fetchStudentsFromBackend()
    .then(() => {
      console.log('✅ Fresh data loaded from database');
      // After fetching backend data, save it to localStorage as backup
      saveState();
    })
    .catch(e => {
      console.warn('[WARN] Could not fetch from database, using cached data:', e.message);
    });

  fetchTeachersFromBackend()
    .then(() => {
      console.log('✅ Teachers loaded from database');
      saveState();
    })
    .catch(e => {
      console.warn('[WARN] Could not fetch teachers from database, using cached data:', e.message);
    });

  hydrateReceiptsFromBackend()
    .then((loaded) => {
      if (loaded) {
        console.log('✅ Payments/receipts loaded from database');
        saveState();
      }
    })
    .catch(e => {
      console.warn('[WARN] Could not fetch payments from database, using cached receipts:', e.message);
    });
}

// ---------- Authentication ----------
const AUTH_KEY = 'khushi_portal_auth';
const ROLE_KEY = 'khushi_portal_role';
const USER_KEY = 'khushi_portal_user';
const ADMIN_PANEL_ROLE_KEY = 'khushi_admin_panel_role';
const MANAGED_CREDENTIALS_KEY = 'khushi_managed_credentials';

const ADMIN_PANEL_PERMISSIONS = {
  main_admin: {
    allowedViews: ['dashboard', 'students', 'attendance', 'fees', 'classes', 'exams', 'teachers', 'staff', 'parents', 'transport', 'notices', 'settings', 'audit'],
    hiddenActionIds: []
  },
  reception: {
    allowedViews: ['dashboard', 'students', 'fees', 'teachers', 'staff', 'notices'],
    hiddenActionIds: [
      'btnExportCSV',
      'btnBulkSMS',
      'btnBulkExport',
      'feesBtnExport',
      'feesBtnHeads',
      'feesBtnConcession',
      'feesBtnImport',
      'feesBtnAging',
      'feesBtnReceiptsExport',
      'teacherBtnAdd',
      'teacherBtnExport',
      'noticeBtnCreate',
      'noticeBtnExport'
    ]
  }
};

// Multi-role user credentials
const VALID_USERS = {
  admin: [
    { username: 'H9m@nshu', password: 'admin123', name: 'Himanshu Kumar' },
    { username: 'admin', password: 'admin123', name: 'Administrator' }
  ],
  parent: [
    { username: 'parent1', password: 'parent123', name: 'Rajesh Sharma', rolls: ['1001', '1002'] },
    { username: 'parent2', password: 'parent123', name: 'Priya Verma', rolls: ['1002'] },
    { username: 'parent3', password: 'parent123', name: 'Amit Singh', rolls: ['1004'] }
  ],
  public: [
    { username: 'public', password: 'public123', name: 'Visitor' }
  ]
};

// ---------- Razorpay Configuration ----------
// Note: Replace with your actual Razorpay Key ID from dashboard
const RAZORPAY_CONFIG = {
  keyId: 'rzp_test_1OfccbDDELVqHo',  // Replace with your live key ID
  keySecret: 'test_key_secret',       // Store safely on backend - NEVER expose in frontend
  serviceName: 'KHUSHI PUBLIC SCHOOL - Fee Payment'
};

// Razorpay payment state tracking
const RazorpayState = {
  currentPayment: null,
  paymentInProgress: false
};

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

function getUserRole() {
  return sessionStorage.getItem(ROLE_KEY) || 'public';
}

function getAdminPanelRole() {
  const userType = sessionStorage.getItem('userType');
  if (userType && userType !== 'admin') return 'main_admin';

  const stored = (sessionStorage.getItem(ADMIN_PANEL_ROLE_KEY) || '').trim();
  if (stored === 'reception' || stored === 'main_admin') return stored;

  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const fromUser = (user.panelRole || user.role || '').trim();
    if (fromUser === 'reception' || fromUser === 'main_admin') return fromUser;
  } catch {}

  return 'main_admin';
}

function canAccessAdminView(viewId) {
  const panelRole = getAdminPanelRole();
  const permissions = ADMIN_PANEL_PERMISSIONS[panelRole] || ADMIN_PANEL_PERMISSIONS.main_admin;
  return (permissions.allowedViews || []).includes(viewId);
}

function applyAdminPanelPermissions() {
  if (getUserRole() !== 'admin') return;

  const panelRole = getAdminPanelRole();
  const permissions = ADMIN_PANEL_PERMISSIONS[panelRole] || ADMIN_PANEL_PERMISSIONS.main_admin;
  const allowedSet = new Set(permissions.allowedViews || []);

  qsa('.menu__item[data-view]').forEach(item => {
    const view = item.getAttribute('data-view') || '';
    item.style.display = allowedSet.has(view) ? '' : 'none';
  });

  const teacherMenuItem = document.querySelector('.menu__item[data-view="teachers"]');
  if (teacherMenuItem) {
    const teacherMenuLabel = teacherMenuItem.querySelector('span:last-child');
    if (teacherMenuLabel) {
      teacherMenuLabel.textContent = panelRole === 'reception' ? 'Teacher Attendance' : 'Teachers';
    }
  }

  const adminSection = document.querySelector('.menu__section');
  if (adminSection) adminSection.style.display = panelRole === 'reception' ? 'none' : '';

  const hiddenActionIds = permissions.hiddenActionIds || [];
  hiddenActionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  if (!canAccessAdminView(AppState.view || 'dashboard')) {
    AppState.view = 'dashboard';
  }
}

function getManagedCredentials() {
  try {
    return JSON.parse(localStorage.getItem(MANAGED_CREDENTIALS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function getCurrentUser() {
  return sessionStorage.getItem(USER_KEY) || '';
}

function accessPublicPortal() {
  // Allow direct access to public portal without authentication
  sessionStorage.setItem(AUTH_KEY, 'true');
  sessionStorage.setItem(ROLE_KEY, 'public');
  sessionStorage.setItem(USER_KEY, JSON.stringify({ username: 'visitor', name: 'Visitor', role: 'public' }));
  const loginPage = document.getElementById('loginPage');
  if (loginPage) loginPage.classList.add('hidden');
  document.body.style.overflow = 'auto';
  // Reset all forms (if any)
  document.querySelectorAll('.login-form').forEach(f => f.reset());
  switchRole('public');
}

function handleLogin(event, role) {
  console.log('handleLogin invoked', role, event);
  event.preventDefault();
  
  // Get form fields for this specific role
  const form = event.target;
  const usernameInput = form.querySelector('.loginUsername');
  const passwordInput = form.querySelector('.loginPassword');
  const errorDiv = form.querySelector('.login-error');
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!username || !password) {
    errorDiv.textContent = 'Please enter username and password';
    errorDiv.classList.add('show');
    return;
  }

  // Allow public role without strict credential checking
  if (role === 'public') {
    sessionStorage.setItem(AUTH_KEY, 'true');
    sessionStorage.setItem(ROLE_KEY, 'public');
    sessionStorage.setItem(USER_KEY, JSON.stringify({ username: 'visitor', name: 'Visitor', role: 'public' }));
    const loginPage = document.getElementById('loginPage');
    if (loginPage) loginPage.classList.add('hidden');
    document.body.style.overflow = 'auto';
    document.querySelectorAll('.login-form').forEach(f => f.reset());
    switchRole('public');
    return;
  }

  const users = VALID_USERS[role] || [];
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    sessionStorage.setItem(ROLE_KEY, role);
    sessionStorage.setItem(USER_KEY, JSON.stringify({ ...user, role }));
    errorDiv.classList.remove('show');
    const loginPage = document.getElementById('loginPage');
    if (loginPage) loginPage.classList.add('hidden');
    document.body.style.overflow = 'auto';
    document.querySelectorAll('.login-form').forEach(f => f.reset());
    switchRole(role);
  } else {
    errorDiv.textContent = 'Invalid credentials';
    errorDiv.classList.add('show');
  }
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    stopServerStatusCheck();
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(ADMIN_PANEL_ROLE_KEY);
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('userType');
    sessionStorage.removeItem('user');
    
    // Call backend logout endpoint
    fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    }).catch(err => console.error('Logout error:', err)).finally(() => {
      // Redirect to login page
      window.location.href = 'login.html';
    });
  }
}

function initializeAuth() {
  const isAuthed = sessionStorage.getItem('isAuthenticated') === 'true';
  if (!isAuthed) {
    window.location.replace('login.html');
    return;
  }

  const userType = sessionStorage.getItem('userType');
  if (isAuthed) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    if (!sessionStorage.getItem(ROLE_KEY)) {
      const mappedRole = userType === 'parent' ? 'parent' : (userType === 'public' ? 'public' : 'admin');
      sessionStorage.setItem(ROLE_KEY, mappedRole);
    }
  }

  const loginPage = document.getElementById('loginPage');
  if (loginPage) {
    // remove from DOM entirely, no need for hidden toggling
    loginPage.parentNode.removeChild(loginPage);
  }
  document.body.style.overflow = 'auto';

  // Display logged-in user's name in topbar
  try {
    displayUserInfo();
  } catch (e) {
    console.warn('⚠️ displayUserInfo error:', e);
  }

  // Setup logout button (still works if present)
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
    console.log('✓ Logout button handler attached');
  }

  // Setup server status topbar click to manually check
  const serverStatusTopbar = document.getElementById('serverStatusTopbar');
  if (serverStatusTopbar) {
    serverStatusTopbar.addEventListener('click', checkServerConnection);
    console.log('✓ Server status topbar handler attached');
  }
  
  // Auto-check server connection on initialization
  console.log('Starting auto server connection check...');
  checkServerConnection();
}

function displayUserInfo() {
  const userDisplayEl = document.getElementById('userDisplayName');
  const userStr = sessionStorage.getItem('user');
  if (userDisplayEl && userStr) {
    try {
      const user = JSON.parse(userStr);
      let displayName = user.full_name || user.username || 'Himanshu Kumar';
      if (getUserRole() === 'admin' && getAdminPanelRole() !== 'reception') {
        displayName = 'Himanshu Kumar';
      }
      userDisplayEl.textContent = displayName;
    } catch (e) {
      userDisplayEl.textContent = 'Himanshu Kumar';
    }
  } else if (userDisplayEl) {
    userDisplayEl.textContent = 'Himanshu Kumar';
  }
}

// ---------- Login helpers ----------
function initLoginHandlers() {
  // attach submit listeners to forms; rely on data-role attribute
  document.querySelectorAll('.login-form').forEach(form => {
    const role = form.dataset.role;
    if (!role) return;
    form.addEventListener('submit', e => {
      console.log('login form submit for role', role, e);
      handleLogin(e, role);
    });
  });

  // as a safety net, also watch the login buttons directly so we can log clicks
  document.querySelectorAll('.login-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      console.log('login button clicked', btn);
      // ensure the surrounding form is submitted in case default prevented
      const form = btn.closest('form');
      if (form) {
        const role = form.dataset.role;
        if (role) {
          handleLogin({ preventDefault: () => {}, target: form }, role);
        }
      }
    });
  });

  // server check button on login page
  const loginCheckBtn = document.getElementById('btnLoginCheckServer');
  if (loginCheckBtn) {
    loginCheckBtn.addEventListener('click', async () => {
      await checkServerConnection();
      alert(isServerConnected ? 'Server is Online' : 'Server is Offline');
    });
  }
}

function updatePortalTitles() {
  const role = getUserRole();
  const panelRole = getAdminPanelRole();
  const dashTitle = qs('#dash-title');

  if (role === 'admin' && panelRole === 'reception') {
    if (dashTitle) dashTitle.textContent = 'Reception Dashboard';
    document.title = 'Khushi Public School Reception';
    return;
  }

  if (role === 'admin') {
    if (dashTitle) dashTitle.textContent = 'Dashboard';
    document.title = 'Khushi Public School Admin';
    return;
  }

  if (role === 'parent') {
    document.title = 'Khushi Public School Parent Portal';
    return;
  }

  document.title = 'Khushi Public School';
}

// ---------- Role-based Switching ----------
function switchRole(role) {
  const role_val = role || getUserRole();
  
  // Get key elements
  const sidebar = document.querySelector('.sidebar');
  const app = document.querySelector('.app');
  
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  
  if (role_val === 'admin') {
    // Show admin interface
    if (sidebar) sidebar.classList.remove('hidden');
    if (app) app.classList.remove('hidden');
    applyAdminPanelPermissions();
    updatePortalTitles();
    initFeePaymentButton();
    // Start server status monitoring for admin
    startServerStatusCheck();
    switchView(AppState.view || 'dashboard');
  } else if (role_val === 'parent') {
    // Hide admin UI, show parent portal
    stopServerStatusCheck();
    if (sidebar) sidebar.classList.add('hidden');
    if (app) app.classList.add('hidden');
    updatePortalTitles();
    renderParentPortal();
  } else if (role_val === 'public') {
    // Hide admin UI, show public portal
    stopServerStatusCheck();
    if (sidebar) sidebar.classList.add('hidden');
    if (app) app.classList.add('hidden');
    updatePortalTitles();
    renderPublicPortal();
  }
}

function renderParentPortal() {
  const view = document.getElementById('view-parent');
  if (view) view.classList.remove('hidden');
  
  const currentUser = JSON.parse(getCurrentUser() || '{}');
  const parentRolls = currentUser.rolls || [currentUser.roll]; // Handle both old (single) and new (multiple) format
  
  // Initialize selected child if not set
  if (!AppState.selectedChildRoll || !parentRolls.includes(AppState.selectedChildRoll)) {
    AppState.selectedChildRoll = parentRolls[0] || null;
  }
  
  if (!AppState.selectedChildRoll) return;
  
  // Update welcome message
  const welcome = document.getElementById('parentWelcome');
  if (welcome) welcome.textContent = `Welcome, ${currentUser.name}!`;
  
  // Setup child selector if multiple children
  const childSelectorDiv = document.getElementById('parentChildSelector');
  if (childSelectorDiv && parentRolls.length > 1) {
    childSelectorDiv.classList.remove('hidden');
    const selector = document.getElementById('parentChildSelect');
    if (selector) {
      // Clear and populate selector
      selector.innerHTML = parentRolls.map(roll => {
        const student = AppState.students.find(s => s.roll === roll);
        return `<option value="${roll}">${student ? student.name + ' (' + student.roll + ')' : 'Admission No. ' + roll}</option>`;
      }).join('');
      selector.value = AppState.selectedChildRoll;
      selector.onchange = (e) => {
        AppState.selectedChildRoll = e.target.value;
        renderParentPortal();
      };
    }
  } else if (childSelectorDiv) {
    childSelectorDiv.classList.add('hidden');
  }
  
  // Get selected student
  const student = AppState.students.find(s => s.roll === AppState.selectedChildRoll);
  if (!student) return;
  
  // Update student info
  document.getElementById('parentChildName').textContent = student.name;
  document.getElementById('parentChildClass').textContent = `${student.class}-${student.section}`;
  document.getElementById('parentRoll').textContent = student.roll;
  document.getElementById('parentName').textContent = student.name;
  document.getElementById('parentClass').textContent = student.class;
  document.getElementById('parentSection').textContent = student.section;
  document.getElementById('parentStatus').textContent = student.status;
  document.getElementById('parentPhone').textContent = student.phone;
  
  // Calculate fees from admission date (all months since admission)
  const feeData = calculateTotalUnpaidFees(student);
  const monthsSinceAdmission = feeData.months || genMonthsSinceAdmission(student);
  
  document.getElementById('parentFeesDue').textContent = fmtINR(feeData.totalDue);
  
  // Show summary of unpaid months
  const summaryEl = document.getElementById('parentFeesSummary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="p-12 chip-bg br-8 mb-12">
        <p><strong>Months since Admission:</strong> ${feeData.monthsCount}</p>
        <p><strong>Unpaid Months:</strong> <span class="danger bold">${feeData.unpaidMonths}</span></p>
        <p><strong>Total Due:</strong> <span class="primary bold">${fmtINR(feeData.totalDue)}</span></p>
      </div>
    `;
  }
  
  // Render fees table for all months since admission
  const feesTable = document.getElementById('parentFeesTable');
  if (feesTable) {
    feesTable.innerHTML = monthsSinceAdmission.map(month => {
      const key = `${student.roll}|${month}`;
      const fee = AppState.fees[key] || {};
      const heads = fee.heads || getFeesForStudentMonth(student, month) || {};
      const paid = Number(fee.paid||0);
      const discount = Number(fee.discount||0);
      const lateFee = Number(fee.lateFee||0);

      // Extract individual fee heads
      const tuition = heads.Tuition || 0;
      const transport = heads.Transport || 0;
      const miscellaneous = heads.Miscellaneous || 0;

      // Calculate Other as sum of remaining heads (excluding Tuition, Transport, Miscellaneous)
      let other = 0;
      for (const [hkey, value] of Object.entries(heads)) {
        if (!['Tuition', 'Transport', 'Miscellaneous'].includes(hkey)) {
          other += value;
        }
      }

      const headTotal = Object.values(heads).reduce((a,b) => a+b, 0);
      const due = Math.max(0, headTotal + lateFee - discount - paid);
      return `
        <tr>
          <td>${month}</td>
          <td>${fmtINR(tuition)}</td>
          <td>${fmtINR(transport)}</td>
          <td>${fmtINR(miscellaneous)}</td>
          <td>${fmtINR(other)}</td>
          <td><strong>${fmtINR(headTotal)}</strong></td>
          <td>${fmtINR(paid)}</td>
          <td>${fmtINR(due)}</td>
          <td><span class="badge ${due > 0 ? 'danger' : 'success'}">${due > 0 ? 'Due' : 'Paid'}</span></td>
        </tr>
      `;
    }).join('');
  }
  
  // Render parent notices
  const parentNoticesList = document.getElementById('parentNoticesList');
  if (parentNoticesList) {
    const noticesHTML = AppState.notices
      .filter(n => n.status === 'active' && (n.audience === 'all' || n.audience === 'parents'))
      .map(n => `
        <div style="padding:12px; border-bottom:1px solid var(--border);">
          <h4 style="margin:0;">${escapedText(n.title)} <span class="badge" style="margin-left:8px;">${n.priority}</span></h4>
          <p style="margin:4px 0; color:var(--text-muted); font-size:12px;">${n.date} • by ${escapedText(n.author)}</p>
          <p style="margin:8px 0;">${escapedText(n.description)}</p>
        </div>
      `).join('');
    parentNoticesList.innerHTML = noticesHTML || '<p>No notices to display.</p>';
  }
  
  // Setup pay fee button
  const payFeeBtn = document.getElementById('parentBtnPayFee');
  if (payFeeBtn) {
    payFeeBtn.onclick = () => {
      if (openModal('#modalParentPayFee')) {
        initParentPayFeeModal(student);
      }
    };
  }
  
  // Setup tab switching
  setupTabSwitching('parent');
  
  // Setup logout button
  const logoutBtn = document.getElementById('parentBtnLogout');
  if (logoutBtn) logoutBtn.onclick = handleLogout;
}

function renderPublicPortal() {
  const view = document.getElementById('view-public');
  if (view) view.classList.remove('hidden');
  
  // Render public notices
  const publicNoticesList = document.getElementById('publicNoticesList');
  if (publicNoticesList) {
    const noticesHTML = AppState.notices
      .filter(n => n.status === 'active')
      .slice(0, 5)
      .map(n => `
        <div style="padding:12px; border:1px solid var(--border); border-radius:8px; margin-bottom:12px;">
          <h4 style="margin:0;">${escapedText(n.title)} <span class="badge" style="margin-left:8px;">${n.priority}</span></h4>
          <p style="margin:4px 0; color:var(--text-muted); font-size:12px;">${n.date} • ${n.audience}</p>
          <p style="margin:8px 0;">${escapedText(n.description)}</p>
        </div>
      `).join('');
    publicNoticesList.innerHTML = noticesHTML || '<p>No announcements at this time.</p>';
  }
  
  // Setup logout button
  const logoutBtn = document.getElementById('publicBtnLogout');
  if (logoutBtn) logoutBtn.onclick = handleLogout;
}

function setupTabSwitching(portal) {
  const tabBtns = document.querySelectorAll(`#view-${portal} .tab-btn`);
  const tabContents = document.querySelectorAll(`#view-${portal} .tab-content`);
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(t => t.classList.add('hidden'));
      
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const tabContent = document.getElementById(tabId);
      if (tabContent) tabContent.classList.remove('hidden');
    });
  });
}

// ---------- Parent Payment Functions ----------
function initParentPayFeeModal(student) {
  const form = qs('#formParentPayFee');
  const modal = qs('#modalParentPayFee');
  const currentUser = JSON.parse(getCurrentUser() || '{}');
  if (!form || !student) return;
  
  // Calculate total due for this month
  const month = monthOfToday();
  const key = `${student.roll}|${month}`;
  const fee = AppState.fees[key];
  const headTotal = fee ? Object.values(fee.heads).reduce((a,b) => a+b, 0) : 0;
  const paid = fee ? (fee.paid || 0) : 0;
  const due = Math.max(0, headTotal - paid);
  
  // Populate modal
  document.getElementById('payFeeStudentName').textContent = student.name;
  document.getElementById('payFeeRoll').textContent = student.roll;
  document.getElementById('payFeeTotalDue').textContent = fmtINR(due);
  
  const amountField = document.getElementById('payFeeAmount');
  if (amountField) amountField.value = due;
  
  // Pre-fill parent's details
  const nameField = document.getElementById('payFeeFullName');
  const emailField = document.getElementById('payFeeEmail');
  const phoneField = document.getElementById('payFeePhone');
  
  if (nameField) nameField.value = currentUser.name || '';
  if (emailField) emailField.value = currentUser.email || '';
  if (phoneField) phoneField.value = '';
  
  // Handle form submission
  form.onsubmit = (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('payFeeAmount')?.value || 0);
    const fullName = document.getElementById('payFeeFullName')?.value?.trim() || '';
    const email = document.getElementById('payFeeEmail')?.value?.trim() || '';
    const phone = document.getElementById('payFeePhone')?.value?.trim() || '';
    
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!fullName) {
      alert('Please enter your full name');
      return;
    }
    if (!email) {
      alert('Please enter your email address');
      return;
    }
    if (!phone) {
      alert('Please enter your phone number');
      return;
    }
    
    // Initiate Razorpay payment
    initiateRazorpayPayment(student, amount, fullName, email, phone, modal);
  };
}

// ---------- Razorpay Payment Integration ----------
function initiateRazorpayPayment(student, amount, fullName, email, phone, modal) {
  if (RazorpayState.paymentInProgress) {
    alert('A payment is already in progress. Please wait.');
    return;
  }
  
  RazorpayState.paymentInProgress = true;
  
  // Store current payment details
  RazorpayState.currentPayment = {
    student,
    amount,
    fullName,
    email,
    phone,
    modal,
    orderId: 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  };
  
  // Razorpay options
  const options = {
    key: RAZORPAY_CONFIG.keyId,
    amount: amount * 100,  // Amount in paise (smallest currency unit)
    currency: 'INR',
    name: RAZORPAY_CONFIG.serviceName,
    description: `Fee payment for ${student.name} (Admission No.: ${student.roll})`,
    order_id: RazorpayState.currentPayment.orderId,
    prefill: {
      name: fullName,
      email: email,
      contact: phone
    },
    notes: {
      studentName: student.name,
      studentRoll: student.roll,
      studentClass: student.class,
      orderId: RazorpayState.currentPayment.orderId
    },
    theme: {
      color: '#2563eb'
    },
    handler: handleRazorpaySuccess,
    modal: {
      ondismiss: handleRazorpayCancel
    }
  };
  
  // Open Razorpay checkout
  const razorpay = new Razorpay(options);
  razorpay.open();
  
  razorpay.on('payment.failed', handleRazorpayError);
}

function handleRazorpaySuccess(response) {
  const payment = RazorpayState.currentPayment;
  if (!payment) {
    alert('Payment session lost. Please try again.');
    RazorpayState.paymentInProgress = false;
    return;
  }
  
  // Process successful payment
  const receiptData = {
    razorpayPaymentId: response.razorpay_payment_id,
    razorpayOrderId: response.razorpay_order_id,
    razorpaySignature: response.razorpay_signature,
    studentName: payment.student.name,
    studentRoll: payment.student.roll,
    paidBy: payment.fullName,
    email: payment.email,
    phone: payment.phone
  };
  
  processRazorpayPayment(payment.student, payment.amount, receiptData, payment.modal);
  RazorpayState.paymentInProgress = false;
}

function handleRazorpayError(error) {
  RazorpayState.paymentInProgress = false;
  alert('❌ Payment Failed!\n\nCode: ' + error.code + '\nDescription: ' + error.description + '\n\nPlease try again.');
}

function handleRazorpayCancel() {
  RazorpayState.paymentInProgress = false;
  console.log('Payment cancelled by user');
}

function processRazorpayPayment(student, amount, receiptData, modal) {
  const month = monthOfToday();
  const key = `${student.roll}|${month}`;
  
  // Update fee data
  if (!AppState.fees[key]) {
    AppState.fees[key] = { heads: {}, paid: 0, discount: 0, lateFee: 0 };
  }
  AppState.fees[key].paid = (AppState.fees[key].paid || 0) + amount;
  
  // Create receipt with Razorpay details
  const receipt = {
    no: 'R-' + String(AppState.receipts.length + 1).padStart(4, '0'),
    date: todayYYYYMMDD(),
    roll: student.roll,
    name: student.name,
    method: 'razorpay',
    amount: amount,
    ref: receiptData.razorpayPaymentId,
    razorpayData: receiptData,
    status: 'completed'
  };
  
  AppState.receipts.push(receipt);
  saveState();
  const receiptNo = getReceiptKey(receipt);
  
  // Show success message with Razorpay details
  const successMsg = `✅ Payment Successful!\n\nReceipt No: ${receiptNo}\nAmount: ₹${amount}\nPayment ID: ${receiptData.razorpayPaymentId}\n\nThank you for the payment!`;
  alert(successMsg);
  
  // Close modal and refresh
  if (modal) modal.close();
  renderParentPortal();
}

// ========== THERMAL PRINTER RECEIPT FUNCTIONS ==========

/**
 * Print receipt on thermal printer (ESC/POS format)
 * Works with thermal printers like the ones used in petrol pumps
 */
async function printThermalReceipt(paymentId, studentName, rollNo, amount, paymentMethod, purpose) {
  try {
    const school = (AppState.settings && AppState.settings.school) ? AppState.settings.school : {};
    const receiptData = {
      payment_id: paymentId,
      student_name: studentName,
      roll_no: rollNo,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      purpose: purpose || 'School Fee',
      course: purpose || 'School Fee',
      duration: '',
      paid_by: paymentMethod || 'Cash',
      school_name: school.name || 'KIDS CARE PLAY SCHOOL',
      school_address: school.address || '1751, Gali no 5, Rajiv Puram, Karnal-132001',
      school_contact: school.phone || '0149-2082596',
      school_email: school.email || 'kidscps@gmail.co.in',
      font_variant: 'large',
      particulars: [purpose || 'School Fee'],
      receipt_number: 'RCP-' + String(AppState.receipts.length + 1).padStart(5, '0'),
      payment_date: todayYYYYMMDD()
    };
    
    const response = await fetch(`${API_URL}/receipt/thermal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData)
    });
    
    if (!response.ok) throw new Error('Failed to generate receipt');
    
    const result = await response.json();
    
    // Convert string back to bytes and send to printer
    if (result.receipt) {
      // Check if Web Serial API is available (for direct USB/Serial thermal printer)
      if (navigator.serial) {
        await sendToSerialPrinter(result.receipt);
      } else {
        alert('⚠️ Web Serial API not available.\n\nReceipt generated. Please use the Print option from your printer settings.');
        printHTMLReceipt(receiptData);
      }
    }
  } catch (error) {
    console.error('Thermal receipt error:', error);
    alert('Error generating receipt: ' + error.message);
  }
}

/**
 * Print receipt via browser print dialog (for thermal printer connected via USB)
 */
async function printHTMLReceipt(receiptData) {
  try {
    const response = await fetch(`${API_URL}/receipt/html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData)
    });
    
    if (!response.ok) throw new Error('Failed to generate HTML receipt');
    
    const htmlContent = await response.text();
    
    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
    
  } catch (error) {
    console.error('HTML receipt error:', error);
    alert('Error generating receipt: ' + error.message);
  }
}

/**
 * Send ESC/POS commands directly to serial thermal printer
 * Requires Web Serial API and appropriate permissions
 */
async function sendToSerialPrinter(receiptData) {
  try {
    // Request serial port access
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    
    const writer = port.writable.getWriter();
    
    // Convert string to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(receiptData);
    
    // Send to printer
    await writer.write(data);
    writer.releaseLock();
    
    // Close port
    await port.close();
    
    alert('✅ Receipt sent to thermal printer!');
  } catch (error) {
    console.error('Serial printer error:', error);
    alert('Could not connect to printer. Error: ' + error.message);
  }
}

/**
 * Quick print button for admin dashboard
 * Prints receipt for any payment transaction
 */
function printPaymentReceipt(paymentIndex) {
  const payment = AppState.receipts[paymentIndex];
  if (!payment) {
    alert('Payment not found');
    return;
  }
  
  printThermalReceipt(
    paymentIndex,
    payment.name,
    payment.roll,
    payment.amount,
    payment.method,
    'School Fee'
  );
}

// ---------- Demo Seed Data ----------
function seedDemoData() {
  // Initialize with empty students array - ready for real data
  AppState.students = [];
  AppState.kpi.totalStudents = 0;

  // Fee heads per class (Transport is dynamically added based on assignment)
  AppState.feeHeadsByClass = {
    'Nursery': { Tuition: 300, Activity: 20, Miscellaneous: 50 },
    'LKG':     { Tuition: 350, Activity: 25, Miscellaneous: 60 },
    'UKG':     { Tuition: 400, Activity: 30, Miscellaneous: 70 },
    'I':       { Tuition: 450, Activity: 35, Miscellaneous: 75 },
    'II':      { Tuition: 500, Activity: 40, Miscellaneous: 85 },
    'III':     { Tuition: 550, Activity: 45, Miscellaneous: 95 },
    'IV':      { Tuition: 600, Activity: 50, Miscellaneous: 100 },
    'V':       { Tuition: 650, Lab: 75, Miscellaneous: 110 },
    'VI':      { Tuition: 700, Lab: 100, Miscellaneous: 120 },
    'VII':     { Tuition: 700, Lab: 100, Miscellaneous: 120 },
    'VIII':    { Tuition: 700, Activity: 50, Miscellaneous: 120 },
    'IX':      { Tuition: 800, Lab: 100, Miscellaneous: 130 },
    'X':       { Tuition: 900, Lab: 120, Miscellaneous: 130 }
  };

  // No demo fees - will be created when students pay
  // AppState.fees remains as is (empty or existing)

  // Preserve real receipts; only initialize if missing/corrupt
  if (!Array.isArray(AppState.receipts)) {
    AppState.receipts = [];
  }

  // KPIs
  AppState.kpi.feesCollectedMonth = sumReceiptsThisMonth();
  AppState.kpi.issuesOpen = 6;

  // Transport seed (only if empty)
  if (AppState.transport.routes.length === 0) {
    AppState.transport.routes.push({
      id: 'R1',
      name: 'Ariari Morning',
      stops: ['Ariari Chowk', 'Khushalganj'],
      pickup: '07:15',
      drop: '14:30',
      status: 'active'
    });
  }
  if (AppState.transport.vehicles.length === 0) {
    AppState.transport.vehicles.push({
      id: 'V1',
      label: 'Bus #1',
      reg: 'BR-01-AB-1234',
      capacity: 40,
      driverName: 'Suresh',
      driverPhone: '+91-9XXXXXXX',
      routeId: 'R1',
      status: 'active'
    });
  }
  if (AppState.transport.assignments.length === 0) {
    AppState.transport.assignments.push({
      roll: '1001',
      routeId: 'R1',
      stop: 'Ariari Chowk',
      fee: 300,
      status: 'active'
    });
  }

  // No demo notices - ready for real notices
  if (AppState.notices.length === 0) {
    AppState.notices = [];
  }
}

// ---------- Utilities ----------
const qs  = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

function fmtINR(n) {
  const val = Number(n || 0);
  const sym = AppState.settings?.currency || '₹';
  const loc = AppState.settings?.locale || 'en-IN';
  return sym + ' ' + val.toLocaleString(loc, { maximumFractionDigits: 0 });
}

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function monthOfToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${yyyy}-${mm}`;
}

let topbarDayTimer = null;
let topbarReceiptSearchQuery = '';
let teacherAttendanceMonthView = currentMonth();
function formatTopbarDay(dateObj = new Date()) {
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = weekDays[dateObj.getDay()];
  const dateText = `${String(dateObj.getDate()).padStart(2, '0')} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  return `${dayName} . ${dateText}`;
}

function initTopbarDayPill() {
  const pill = qs('#topbarDayPill');
  if (!pill) return;

  const render = () => {
    pill.textContent = formatTopbarDay(new Date());
  };

  render();
  if (topbarDayTimer) clearInterval(topbarDayTimer);
  topbarDayTimer = setInterval(render, 60000);
}

function initTopbarGlobalSearch() {
  const searchInput = qs('#topbarSearchInput');
  const searchBtn = qs('#topbarSearchBtn');
  if (!searchInput || !searchBtn) return;

  const executeSearch = () => {
    const raw = (searchInput.value || '').trim();
    const query = raw.toLowerCase();

    if (!query) {
      topbarReceiptSearchQuery = '';
      return;
    }

    const studentScore = (AppState.students || []).reduce((score, s) => {
      const hay = `${s.roll || ''} ${s.name || ''} ${s.phone || ''} ${s.class || ''} ${s.section || ''}`.toLowerCase();
      return score + (hay.includes(query) ? 1 : 0);
    }, 0);

    const receiptScore = (AppState.receipts || []).reduce((score, r) => {
      const hay = `${getReceiptKey(r)} ${r.date || ''} ${r.roll || ''} ${r.name || ''} ${r.method || ''} ${r.ref || ''}`.toLowerCase();
      return score + (hay.includes(query) ? 1 : 0);
    }, 0);

    const classScore = (AppState.classes || []).reduce((score, c) => {
      const teacherName = AppState.teachers.find(t => String(t.id) === String(c.classTeacherId))?.name || '';
      const hay = `${c.class || ''} ${c.section || ''} ${teacherName}`.toLowerCase();
      return score + (hay.includes(query) ? 1 : 0);
    }, 0);

    const ranked = [
      { view: 'students', score: studentScore },
      { view: 'fees', score: receiptScore },
      { view: 'classes', score: classScore }
    ].sort((a, b) => b.score - a.score);

    const best = ranked[0]?.view || 'students';

    if (best === 'fees') {
      topbarReceiptSearchQuery = query;
      switchView('fees');
      setTimeout(() => {
        if (AppState.view === 'fees') renderRecentReceipts();
      }, 120);
      return;
    }

    topbarReceiptSearchQuery = '';

    if (best === 'students') {
      switchView('students');
      const studentSearch = qs('#searchStudent');
      if (studentSearch) studentSearch.value = raw;
      renderStudents();
      return;
    }

    switchView('classes');
    const classSearch = qs('#classSearch');
    if (classSearch) classSearch.value = raw;
    renderClasses();
  };

  searchBtn.onclick = executeSearch;
  searchInput.onkeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      executeSearch();
    }
  };
}

// return YYYY-MM string for the month following the given one
function nextMonth(ym){
  if(!ym) return '';
  const [y,m] = ym.split('-').map(Number);
  let ny = y, nm = m+1;
  if(nm>12){ nm = 1; ny++; }
  return `${ny}-${String(nm).padStart(2,'0')}`;
}

// ===== MISCELLANEOUS FEE HELPER =====
// Miscellaneous fee is collected 4 times per year at 3-month intervals
// Collection months: January (1), April (4), July (7), October (10)
function isMiscellaneousFeeMonth(monthStr) {
  try {
    const parts = monthStr.split('-');
    const monthNum = parseInt(parts[1], 10);
    return [1, 4, 7, 10].includes(monthNum);
  } catch (e) {
    return false;
  }
}

// Get fee heads for a student in a specific month
// This dynamically adds/removes miscellaneous fee based on the month
// Get fee heads for a student in a specific month.
// Accepts either (studentClass, month) or (studentObject, month) or (rollString, month).
// Behavior:
// - Removes Miscellaneous if month not one of collection months
// - If student is provided and admission_date is present, do not charge for months before admission.
// - If admission happens during the month, prorate each head based on days remaining in that month (inclusive).
function getFeesForStudentMonth(studentClassOrStudent, month) {
  // Resolve student/class
  let student = null;
  let studentClass = studentClassOrStudent;
  if (typeof studentClassOrStudent === 'object' && studentClassOrStudent !== null) {
    student = studentClassOrStudent;
    studentClass = student.class;
  } else if (typeof studentClassOrStudent === 'string') {
    // could be a roll or a class name; prefer matching a student roll first
    const s = AppState.students.find(x => x.roll === studentClassOrStudent);
    if (s) { student = s; studentClass = s.class; }
  }

  const baseHeads = AppState.feeHeadsByClass[studentClass] || { Tuition: 800 };
  let heads = { ...baseHeads };

  // If this month is NOT a miscellaneous fee month, remove it
  if (!isMiscellaneousFeeMonth(month)) {
    delete heads.Miscellaneous;
  }

  // If we have a student with admission_date, adjust charges based on admission
  if (student && student.admission_date) {
    // admission_date expected as YYYY-MM-DD
    const adm = new Date(student.admission_date);
    if (!adm || isNaN(adm.getTime())) return heads;

    const [yStr, mStr] = month.split('-');
    const year = Number(yStr);
    const mon = Number(mStr);
    if (!year || !mon) return heads;

    const monthStart = new Date(year, mon - 1, 1);
    const monthDays = daysInMonth(year, mon);
    const monthEnd = new Date(year, mon - 1, monthDays);

    // If admission is after the end of this month => not admitted yet => no heads
    if (adm > monthEnd) return {};

    // If admission is on or before the first day of month => full heads
    if (adm <= monthStart) return heads;

    // Admission happened during this month => prorate heads
    const admDay = adm.getDate();
    const daysRemaining = monthDays - admDay + 1; // inclusive of admission day
    const ratio = daysRemaining / monthDays;

    const prorated = {};
    for (const [h, amt] of Object.entries(heads)) {
      prorated[h] = Math.round(Number(amt || 0) * ratio);
    }
    return prorated;
  }

  return heads;
}

// ===== END MISCELLANEOUS FEE HELPER =====
function genLastNMonths(n) {
  const list=[]; const d=new Date();
  for (let i=n-1;i>=0;i--) {
    const d2=new Date(d.getFullYear(), d.getMonth()-i, 1);
    const yyyy=d2.getFullYear(); const mm=String(d2.getMonth()+1).padStart(2,'0');
    list.push(`${yyyy}-${mm}`);
  }
  return list;
}

// return array of months between start (inclusive) and end (exclusive), both in "YYYY-MM" format
function genMonthsBetween(start, end) {
  const result = [];
  if (!start || !end) return result;
  const [ys, ms] = start.split('-').map(Number);
  const [ye, me] = end.split('-').map(Number);
  if (!ys || !ms || !ye || !me) return result;
  let y = ys, m = ms;
  while (y < ye || (y === ye && m < me)) {
    result.push(`${y}-${String(m).padStart(2,'0')}`);
    m++;
    if (m > 12) {
      m = 1; y++;
    }
  }
  return result;
}

// Generate all months from student's admission date to current month
// helper to convert YYYY-MM string to a human-friendly month name + year
function formatMonthYear(ym){
  if (!ym) return '';
  const parts = ym.split('-');
  if (parts.length !== 2) return ym;
  const y = parseInt(parts[0],10);
  const m = parseInt(parts[1],10) - 1;
  const d = new Date(y, m, 1);
  // use locale from settings or fallback to default
  return d.toLocaleString(AppState.settings.locale || 'en-IN', { month: 'long', year: 'numeric' });
}

function genMonthsSinceAdmission(student) {
  if (!student) return [];
  
  // if no admission date is set, fall back to showing the past year of
  // months so that the fee modal still allows choosing a period. we mark
  // this case by returning a special value in the array so callers can
  // show a warning.
  if (!student.admission_date) {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; --i) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    // prepend a flag string to indicate fallback
    months.unshift('__NO_ADMISSION_DATE__');
    return months;
  }
  
  // Parse admission date (YYYY-MM-DD format)
  const [admYear, admMonth] = student.admission_date.split('-').map(Number);
  if (!admYear || !admMonth) return [];
  
  // Current date
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  
  const months = [];
  let y = admYear, m = admMonth;
  
  while (y < curYear || (y === curYear && m <= curMonth)) {
    months.push(`${y}-${String(m).padStart(2,'0')}`);
    m++;
    if (m > 12) {
      m = 1; y++;
    }
  }
  
  return months;
}

// Calculate total unpaid fees from admission date to current month
function calculateTotalUnpaidFees(student) {
  if (!student) return { totalDue: 0, totalPaid: 0, monthsCount: 0, unpaidMonths: 0 };
  
  const months = genMonthsSinceAdmission(student);
  let totalDue = 0;
  let totalPaid = 0;
  let unpaidMonths = 0;
  
  months.forEach(month => {
    const key = `${student.roll}|${month}`;
    const fee = AppState.fees[key] || {};
    const heads = fee.heads || getFeesForStudentMonth(student, month) || {};
    const paid = Number(fee.paid || 0);
    const discount = Number(fee.discount || 0);
    const lateFee = Number(fee.lateFee || 0);
    
    const headTotal = Object.values(heads).reduce((a, b) => a + b, 0);
    const due = Math.max(0, headTotal + lateFee - discount - paid);
    
    totalDue += due;
    totalPaid += paid;
    
    if (due > 0) unpaidMonths++;
  });
  
  return {
    totalDue,
    totalPaid,
    monthsCount: months.length,
    unpaidMonths,
    months // include months for detailed breakdown
  };
}

function arrayToCSV(rows){
  return rows.map(r => r.map(val => {
    const v=(val??'').toString().replace(/"/g,'""');
    return `"${v}"`;
  }).join(',')).join('\n');
}
function downloadFile(filename, content, mime='text/csv'){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0);
}

// ===== Late Fee Helpers =====
function parseYearMonth(yyyyMM){ if(!yyyyMM||!/^(\d{4})-(\d{2})$/.test(yyyyMM)) return null; const [y,m]=yyyyMM.split('-').map(Number); return {year:y,month:m}; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function ymd(d){ const yyyy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; }
function isWeekend(d){ const day=d.getDay(); return day===0||day===6; }
function makeHolidaySet(holidays){ const set=new Set(); (holidays||[]).forEach(h=>{ if(h&&/^\d{4}-\d{2}-\d{2}$/.test(h)) set.add(h); }); return set; }
function isHoliday(d,holidaySet){ return holidaySet.has(ymd(d)); }
function isBusinessDay(d,rules,holidaySet){ if(rules.skipSun && d.getDay()===0) return false; if(rules.skipSat && d.getDay()===6) return false; if(isHoliday(d,holidaySet)) return false; return true; }
function effectiveLateRulesForClass(klass){ const base=AppState.lateFeeRules||{}; const ovr=(base.classOverrides&&base.classOverrides[klass])||{}; return { ...base, cutoffDay: ovr.cutoffDay??base.cutoffDay, graceDays: ovr.graceDays??base.graceDays, cap: ovr.cap??base.cap, startAfter: ovr.startAfter??base.startAfter }; }
function daysInMonth(year,month){ return new Date(year,month,0).getDate(); }
function computeDueDate(yyyyMM,rules){
  const parsed=parseYearMonth(yyyyMM); if(!parsed) return null;
  const {year,month}=parsed;
  const cutoff=Math.max(1,Math.min(rules.cutoffDay||1, daysInMonth(year,month)));
  let due=new Date(year,month-1,cutoff);
  const holidaySet=makeHolidaySet(rules.holidays||[]);
  const needsShift=(rules.skipSun||rules.skipSat)?isWeekend(due):false;
  const isHol=isHoliday(due,holidaySet);
  if((rules.shiftRule&&rules.shiftRule!=='none')&&(needsShift||isHol)){
    if(rules.shiftRule==='nextBusiness'){
      do{ due=addDays(due,1);} while(!isBusinessDay(due,rules,holidaySet));
    } else if(rules.shiftRule==='prevBusiness'){
      do{ due=addDays(due,-1);} while(!isBusinessDay(due,rules,holidaySet));
    }
  }
  return due;
}
function countChargeableDays(startDateExclusive,endDateInclusive,rules){
  const holidaySet=makeHolidaySet(rules.holidays||[]);
  let d=addDays(startDateExclusive,1);
  const end=new Date(endDateInclusive);
  let days=0;
  while(d<=end){ if(isBusinessDay(d,rules,holidaySet)) days++; d=addDays(d,1); }
  return days;
}
function applySlabs(totalDays,slabs){
  if(!Array.isArray(slabs)||slabs.length===0||totalDays<=0) return 0;
  let amount=0;
  for(let i=1;i<=totalDays;i++){
    const slab=slabs.find(s=> i>=(s.from||1) && (s.to? i<=s.to : true));
    amount+=Number(slab?.perDay||0);
  }
  return amount;
}
function computeLateFee(roll,yyyyMM,today=new Date()){
  const student=AppState.students.find(s=>s.roll===roll); if(!student) return 0;
  const rules=effectiveLateRulesForClass(student.class);
  const appliesToHeads=rules.applyToHeads||{};
  const applicableHeadNames=Object.entries(appliesToHeads).filter(([_,on])=>!!on).map(([h])=>h);

  // Only if any applicable head is included (if rule restricts)
  // If the user has unchecked all heads (intent: pay only late fee), allow late fee calculation.
  let hasApplicableHeadIncluded = true;
  const headsWrap = document.querySelector('#rpHeads');
  if (headsWrap) {
    const includedAll = Array.from(headsWrap.querySelectorAll('input[type="checkbox"][data-include]'));
    const included = includedAll.filter(x => x.checked).map(x => x.getAttribute('data-include'));
    // If no checkboxes are checked at all, assume admin intends to add only late fee — allow calculation
    if (included.length === 0) {
      hasApplicableHeadIncluded = true;
    } else {
      hasApplicableHeadIncluded = included.some(h => applicableHeadNames.includes(h));
    }
  }
  if (!hasApplicableHeadIncluded && applicableHeadNames.length > 0) return 0;

  const parsed=parseYearMonth(yyyyMM); if(!parsed) return 0;
  const mStrToday=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  if(yyyyMM>mStrToday) return 0;

  const due=computeDueDate(yyyyMM,rules); if(!due) return 0;
  let startChargeDate=addDays(due, Number(rules.graceDays||0)+Number(rules.startAfter||0));
  const todayYMD=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  if(todayYMD<=startChargeDate) return 0;

  const chargeDays=countChargeableDays(startChargeDate,todayYMD,rules);
  if(chargeDays<=0) return 0;

  const slabs=Array.isArray(rules.slabs)?rules.slabs:[];
  let fee=applySlabs(chargeDays,slabs);
  const cap=Number(rules.cap||0);
  if(cap>0) fee=Math.min(fee,cap);
  return Math.max(0,Math.round(fee));
}

// ---------- Theme ----------
function applyThemeFromSettings() {
  const t = AppState.settings?.theme || 'system';
  AppState.theme = t; // keep in sync if used elsewhere
  document.documentElement.setAttribute('data-theme', t);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = (t === 'dark') ? '🌞' : '🌙';
}
function initThemeToggle(){
  const btn=qs('#themeToggle');
  const nextTheme = (t) => t==='dark'?'light':'dark';
  if (!btn) return;
  btn.addEventListener('click',()=>{
    AppState.settings.theme = nextTheme(AppState.settings.theme || 'light');
    applyThemeFromSettings();
    saveState();
  });
}

// ---------- Branding ----------
function applySchoolBranding() {
  const sch = AppState.settings.school;
  const brandLogo = document.querySelector('.sidebar .brand-logo');
  const brandTextStrong = document.querySelector('.sidebar .brand-text strong');
  const brandTextSmall  = document.querySelector('.sidebar .brand-text small');
  const resolvedTagline = (!sch.tagline || sch.tagline === 'Admin Portal') ? 'Deoley Sheikhpura' : sch.tagline;
  if (brandLogo) brandLogo.src = sch.logo || 'assets/logo.png';
  if (brandTextStrong) brandTextStrong.textContent = sch.name || 'KHUSHI PUBLIC SCHOOL';
  if (brandTextSmall)  brandTextSmall.textContent  = resolvedTagline;
}

// ---------- Sidebar & Routing ----------
function initSidebarNavigation(){
  const sidebar = qs('#sidebar');
  const sidebarOpen = qs('#sidebarOpen');
  const sidebarClose = qs('#sidebarClose');
  
  if (sidebarOpen) sidebarOpen.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar?.classList.add('open');
  });
  
  if (sidebarClose) sidebarClose.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sidebar?.classList.remove('open');
  });

  const menuItems = qsa('.menu__item');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const view = item.getAttribute('data-view');
      if (!view) return;
      
      // Remove active from all items
      menuItems.forEach(i => i.classList.remove('active'));
      // Add active to clicked item
      item.classList.add('active');
      
      // Close mobile sidebar
      if (sidebar) sidebar.classList.remove('open');
      
      // Switch view
      switchView(view);
    });
  });

  // Initial view is handled by switchRole('admin') during app init.
}

// ---------- Performance Optimization ----------
let viewSwitchInProgress = false;
let switchViewTimeout;

function ensureViewVisible(viewId) {
  const requested = document.getElementById(`view-${viewId}`);
  const fallback = document.getElementById('view-dashboard');
  const visible = document.querySelector('.view:not(.hidden)');

  if (visible) return;

  if (requested) {
    requested.classList.remove('hidden');
    return;
  }

  if (fallback) {
    fallback.classList.remove('hidden');
    AppState.view = 'dashboard';
    qsa('.menu__item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === 'dashboard');
    });
  }
}

function switchView(viewId) {
  if (viewId === 'attendance') {
    viewId = 'dashboard';
  }

  if (getUserRole() === 'admin' && !canAccessAdminView(viewId)) {
    viewId = 'dashboard';
  }

  // Debounce rapid view switches
  if (viewSwitchInProgress) return;
  viewSwitchInProgress = true;
  
  clearTimeout(switchViewTimeout);
  switchViewTimeout = setTimeout(() => {
    viewSwitchInProgress = false;
  }, 300);

  AppState.view = viewId;

  // Keep sidebar state in sync for programmatic navigation (dashboard quick actions)
  qsa('.menu__item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-view') === viewId);
  });
  
  // Hide all views
  const views = document.querySelectorAll('.view');
  views.forEach(v => v.classList.add('hidden'));
  
  // Show target view
  const target = document.getElementById(`view-${viewId}`);
  if (target) {
    target.classList.remove('hidden');
  } else {
    console.warn(`View not found: view-${viewId}. Falling back to dashboard.`);
    const fallback = document.getElementById('view-dashboard');
    if (fallback) {
      fallback.classList.remove('hidden');
      viewId = 'dashboard';
      AppState.view = 'dashboard';
    }
  }

  ensureViewVisible(viewId);
  
  // Scroll to top without animation to prevent UI flicker on low-end devices
  window.scrollTo({ top: 0, behavior: 'auto' });

  // Use requestAnimationFrame for smooth rendering
  requestAnimationFrame(async () => {
    if (viewId === 'dashboard') renderDashboard();
    else if (viewId === 'students')  renderStudents();
    else if (viewId === 'fees')      await renderFees();
    else if (viewId === 'exams')     renderExams();
    else if (viewId === 'classes')   renderClasses();
    else if (viewId === 'teachers')  renderTeachers();
    else if (viewId === 'staff')     renderStaff();
    else if (viewId === 'parents')   renderParents();
    else if (viewId === 'transport') renderTransport();
    else if (viewId === 'notices')   renderNotices();
    else if (viewId === 'settings')  renderSettings();

    // Safety check for any runtime path that accidentally leaves all views hidden
    ensureViewVisible(viewId);
  });
}

// ---------- Dashboard ----------
let admissionsChart, attendanceChart;
let chartRenderInProgress = false;
let dashboardInteractionsBound = false;
let dashboardMapBound = false;
let issuesDeltaInitialized = false;
const dashboardIssueRowMap = new Map();
const kpiAnimationFrameByElement = new WeakMap();
const RECEIPT_SCHOOL_HEADER = 'KHUSHI PUBLIC SCHOOL';

function buildGoogleMapEmbedUrl(query = '') {
  const normalized = String(query || '').trim() || 'Khushi Public School Deoley Shekhpura';
  return `https://www.google.com/maps?q=${encodeURIComponent(normalized)}&output=embed`;
}

function extractNumericValue(text = '') {
  const cleaned = String(text).replace(/[^0-9.-]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

function animateKpiValue(element, targetValue, formatter, duration = 700) {
  if (!element) return;

  const target = Number(targetValue);
  if (!Number.isFinite(target)) {
    element.textContent = typeof formatter === 'function' ? formatter(0) : String(targetValue ?? '');
    return;
  }

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const format = typeof formatter === 'function' ? formatter : (value) => String(value);

  if (reduceMotion) {
    element.textContent = format(target);
    element.dataset.kpiValue = String(target);
    return;
  }

  const previousFrame = kpiAnimationFrameByElement.get(element);
  if (previousFrame) cancelAnimationFrame(previousFrame);

  const storedValue = Number(element.dataset.kpiValue);
  const parsedTextValue = extractNumericValue(element.textContent);
  const startValue = Number.isFinite(storedValue)
    ? storedValue
    : (Number.isFinite(parsedTextValue) ? parsedTextValue : 0);

  if (startValue === target) {
    element.textContent = format(target);
    element.dataset.kpiValue = String(target);
    return;
  }

  const startTime = performance.now();
  const delta = target - startValue;

  const tick = (timestamp) => {
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = startValue + (delta * eased);

    element.textContent = format(current);
    element.dataset.kpiValue = String(current);

    if (progress < 1) {
      const frameId = requestAnimationFrame(tick);
      kpiAnimationFrameByElement.set(element, frameId);
    } else {
      element.textContent = format(target);
      element.dataset.kpiValue = String(target);
      kpiAnimationFrameByElement.delete(element);
    }
  };

  const firstFrame = requestAnimationFrame(tick);
  kpiAnimationFrameByElement.set(element, firstFrame);
}

function openStudentsViewWithFilters({ status = '', search = '' } = {}) {
  switchView('students');

  requestAnimationFrame(() => {
    const filterClass = qs('#filterClass');
    const filterSection = qs('#filterSection');
    const filterStatus = qs('#filterStatus');
    const searchInput = qs('#searchStudent');

    if (!filterClass || !filterSection || !filterStatus || !searchInput) return;

    filterClass.value = '';
    filterSection.value = '';
    filterStatus.value = status;
    searchInput.value = search;

    filterStatus.dispatchEvent(new Event('change', { bubbles: true }));
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function initDashboardInteractions() {
  if (dashboardInteractionsBound) return;
  dashboardInteractionsBound = true;

  qsa('.kpi--interactive').forEach(card => {
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const handleActivate = () => {
      const targetView = card.getAttribute('data-kpi-target') || 'dashboard';
      const status = card.getAttribute('data-kpi-status') || '';

      if (targetView === 'issues') {
        openDashboardIssuesModal();
        return;
      }

      if (targetView === 'students') {
        openStudentsViewWithFilters({ status });
        return;
      }
      switchView(targetView);
    };

    card.addEventListener('click', handleActivate);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleActivate();
      }
    });
  });
}

function initDashboardGoogleMap() {
  const mapInput = qs('#dashboardMapQuery');
  const mapIframe = qs('#dashboardGoogleMap');
  const updateBtn = qs('#dashboardMapBtnUpdate');
  if (!mapInput || !mapIframe || !updateBtn) return;

  const MAP_QUERY_KEY = 'kps_dashboard_map_query';
  const savedQuery = localStorage.getItem(MAP_QUERY_KEY) || 'Khushi Public School Deoley Shekhpura';

  mapInput.value = savedQuery;
  mapIframe.src = buildGoogleMapEmbedUrl(savedQuery);

  if (dashboardMapBound) return;
  dashboardMapBound = true;

  const applyMap = () => {
    const query = String(mapInput.value || '').trim() || 'Khushi Public School Deoley Shekhpura';
    mapIframe.src = buildGoogleMapEmbedUrl(query);
    localStorage.setItem(MAP_QUERY_KEY, query);
  };

  updateBtn.onclick = applyMap;
  mapInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyMap();
    }
  });
}

function updateIssuesDelta(nextIssuesCount) {
  const deltaEl = qs('#kpiIssuesDelta');
  if (!deltaEl) return;

  const previous = Number(AppState?.kpi?.issuesOpen || 0);
  const next = Number(nextIssuesCount || 0);

  if (!issuesDeltaInitialized) {
    issuesDeltaInitialized = true;
    deltaEl.classList.remove('positive', 'negative', 'delta-pop');
    deltaEl.classList.add('neutral');
    deltaEl.textContent = '—';
    return;
  }

  const diff = next - previous;

  deltaEl.classList.remove('positive', 'negative', 'neutral', 'delta-pop');

  if (!Number.isFinite(diff) || diff === 0) {
    deltaEl.textContent = '— no change';
    deltaEl.classList.add('neutral');
    return;
  }

  if (diff < 0) {
    deltaEl.textContent = `▼ ${Math.abs(diff)} decreased`;
    deltaEl.classList.add('positive');
  } else {
    deltaEl.textContent = `▲ ${diff} increased`;
    deltaEl.classList.add('negative');
  }

  void deltaEl.offsetWidth;
  deltaEl.classList.add('delta-pop');
}

async function openDashboardIssuesModal() {
  const body = qs('#dashboardIssuesBody');
  const meta = qs('#dashboardIssuesMeta');
  if (!body || !meta) return;

  meta.textContent = 'Loading payment issues...';
  body.innerHTML = '<tr><td colspan="8" class="muted">Loading...</td></tr>';

  try {
    const allPayments = await fetchAllPayments();
    const normalizedPayments = Array.isArray(allPayments)
      ? allPayments
      : (allPayments && Array.isArray(allPayments.payments) ? allPayments.payments : []);

    const issueRows = getPaymentIssueRows(normalizedPayments);

    if (!issueRows.length) {
      meta.textContent = 'No open payment issues found.';
      body.innerHTML = '<tr><td colspan="8" class="muted">No pending/failed payments.</td></tr>';
      openModal('#modalDashboardIssues');
      return;
    }

    const pendingCount = issueRows.filter(p => String(p?.status || '').toLowerCase() === 'pending').length;
    const failedCount = issueRows.filter(p => String(p?.status || '').toLowerCase() === 'failed').length;

    meta.textContent = `${issueRows.length} payment issue(s): Pending ${pendingCount}, Failed ${failedCount}.`;
    body.innerHTML = buildPaymentIssuesRowsHtml(issueRows, 'modal');
    bindPaymentIssueActions('modal');

    openModal('#modalDashboardIssues');
  } catch (error) {
    console.warn('Failed to load dashboard issues:', error);
    meta.textContent = 'Unable to load payment issues right now.';
    body.innerHTML = '<tr><td colspan="8" class="muted">Could not load payment issues.</td></tr>';
    openModal('#modalDashboardIssues');
  }
}

function renderDashboardIssuesTab(allPayments) {
  const meta = qs('#dashboardIssuesTabMeta');
  const body = qs('#dashboardIssuesTabBody');
  if (!meta || !body) return;

  const normalizedPayments = Array.isArray(allPayments)
    ? allPayments
    : (allPayments && Array.isArray(allPayments.payments) ? allPayments.payments : []);

  const issueRows = getPaymentIssueRows(normalizedPayments);

  if (!issueRows.length) {
    meta.textContent = 'No open issues right now.';
    body.innerHTML = '<tr><td colspan="8" class="muted">No pending/failed payments.</td></tr>';
    return;
  }

  const pendingCount = issueRows.filter(p => String(p?.status || '').toLowerCase() === 'pending').length;
  const failedCount = issueRows.filter(p => String(p?.status || '').toLowerCase() === 'failed').length;
  meta.textContent = `${issueRows.length} issue(s): Pending ${pendingCount}, Failed ${failedCount}.`;

  body.innerHTML = buildPaymentIssuesRowsHtml(issueRows, 'tab');
  bindPaymentIssueActions('tab');
}

function getPaymentIssueRows(payments = []) {
  return (payments || [])
    .filter(p => {
      const status = String(p?.status || '').toLowerCase();
      return status === 'pending' || status === 'failed';
    })
    .sort((a, b) => String(b?.payment_date || '').localeCompare(String(a?.payment_date || '')));
}

function buildPaymentIssuesRowsHtml(issueRows = [], scope = 'tab') {
  dashboardIssueRowMap.clear();
  return issueRows.map(p => {
    const paymentId = Number(p?.id);
    if (Number.isFinite(paymentId)) {
      dashboardIssueRowMap.set(paymentId, p);
    }

    return `
      <tr>
        <td>${p.id || '-'}</td>
        <td>${p.payment_date || '-'}</td>
        <td>${p.roll_no || '-'}</td>
        <td>${p.name || '-'}</td>
        <td>${p.payment_method || '-'}</td>
        <td>${fmtINR(Number(p.amount || 0))}</td>
        <td>${p.status || '-'}</td>
        <td>
          <div class="flex gap-8">
            <button type="button" class="btn btn-ghost small" data-issue-act="set-completed" data-issue-id="${p.id}" data-issue-scope="${scope}">Mark Completed</button>
            <button type="button" class="btn btn-ghost small" data-issue-act="set-failed" data-issue-id="${p.id}" data-issue-scope="${scope}">Mark Failed</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindPaymentIssueActions(scope = 'tab') {
  qsa(`button[data-issue-scope="${scope}"]`).forEach(btn => {
    btn.onclick = async () => {
      const action = btn.getAttribute('data-issue-act');
      const paymentId = Number(btn.getAttribute('data-issue-id'));
      if (!Number.isFinite(paymentId)) return;

      const nextStatus = action === 'set-completed' ? 'Completed' : 'Failed';
      await updatePaymentIssueStatus(paymentId, nextStatus);
    };
  });
}

async function updatePaymentIssueStatus(paymentId, nextStatus) {
  const payment = dashboardIssueRowMap.get(Number(paymentId));
  if (!payment) {
    alert('Could not update issue status. Please refresh dashboard and try again.');
    return;
  }

  const payload = {
    amount: Number(payment.amount || 0),
    payment_date: payment.payment_date || todayYYYYMMDD(),
    payment_method: payment.payment_method || payment.method || 'Cash',
    transaction_id: payment.transaction_id || payment.ref || '',
    purpose: payment.purpose || 'Fee',
    status: nextStatus,
    remarks: payment.remarks || ''
  };

  try {
    const resp = await fetch(`${API_URL}/payments/${paymentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      throw new Error(`Failed to update payment (${resp.status})`);
    }

    await loadDashboardData();

    const modal = qs('#modalDashboardIssues');
    if (modal && modal.open) {
      await openDashboardIssuesModal();
    }
  } catch (error) {
    console.warn('Failed to update payment issue status:', error);
    alert('Could not update issue status in database. Please try again.');
  }
}

function getAdmissionsSeries(students = [], rangeMonths = 6) {
  const safeMonths = Math.max(1, Number(rangeMonths) || 6);
  const now = new Date();
  const labels = [];
  const keys = [];
  const countsByMonth = {};

  for (let i = safeMonths - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    const label = date.toLocaleDateString('en-IN', {
      month: 'short',
      year: safeMonths > 6 ? '2-digit' : undefined
    });

    keys.push(key);
    labels.push(label);
    countsByMonth[key] = 0;
  }

  students.forEach(student => {
    const admissionDate = student.admission_date || student.admissionDate;
    if (!admissionDate) return;

    const parsed = new Date(admissionDate);
    if (Number.isNaN(parsed.getTime())) return;

    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
    if (key in countsByMonth) countsByMonth[key] += 1;
  });

  return {
    labels,
    data: keys.map(key => countsByMonth[key])
  };
}

function getTeacherAttendanceSummaryForDate(dateYMD, teachers = AppState.teachers || []) {
  const teacherList = Array.isArray(teachers) ? teachers : [];
  const totalTeachers = teacherList.length;
  if (!totalTeachers) {
    return { present: 0, marked: 0, total: 0, percent: 0 };
  }

  let presentCount = 0;
  let markedCount = 0;
  teacherList.forEach(teacher => {
    const key = `${teacher.id}|${dateYMD}`;
    const record = (AppState.teacherAttendance || {})[key];
    if (!record) return;
    markedCount += 1;
    if (String(record.status || '').toLowerCase() === 'present') {
      presentCount += 1;
    }
  });

  const attendancePercent = (presentCount / totalTeachers) * 100;
  return {
    present: presentCount,
    marked: markedCount,
    total: totalTeachers,
    percent: Number.isFinite(attendancePercent) ? attendancePercent : 0
  };
}

// Fetch dashboard statistics from database (with timeout)
async function fetchDashboardStats() {
  try {
    const response = await fetchWithTimeout(`${API_URL}/stats/dashboard`, {}, 8000);
    if (!response || !response.ok) throw new Error('Failed to fetch dashboard stats');
    const stats = await response.json();
    return stats;
  } catch (e) {
    console.error('Error fetching dashboard stats:', e);
    return null;
  }
}

// Fetch attendance data for today (with timeout)
async function fetchTodayAttendance() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetchWithTimeout(`${API_URL}/attendance?date=${today}`, {}, 8000);
    if (!response || !response.ok) throw new Error('Failed to fetch attendance');
    const attendance = await response.json();
    return attendance;
  } catch (e) {
    console.error('Error fetching attendance:', e);
    return [];
  }
}

// Fetch all students
async function fetchAllStudents() {
  try {
    const response = await fetchWithTimeout(`${API_URL}/students`);
    if (!response || !response.ok) throw new Error('Failed to fetch students');
    const students = await response.json();
    return students;
  } catch (e) {
    console.error('Error fetching students:', e);
    return [];
  }
}

// Fetch all payments
async function fetchAllPayments() {
  try {
    const response = await fetchWithTimeout(`${API_URL}/payments`);
    if (!response || !response.ok) throw new Error('Failed to fetch payments');
    const payments = await response.json();
    return payments;
  } catch (e) {
    console.error('Error fetching payments:', e);
    return [];
  }
}

async function hydrateReceiptsFromBackend() {
  try {
    const payments = await fetchAllPayments();
    const normalizedPayments = Array.isArray(payments)
      ? payments
      : (payments && Array.isArray(payments.payments) ? payments.payments : []);

    if (!normalizedPayments.length) return false;

    const serverReceipts = normalizedPayments.map(p => ({
      id: p.id,
      no: p.id,
      date: p.payment_date,
      roll: p.roll_no || p.roll || '',
      name: p.name || '',
      method: p.payment_method || p.method || '',
      amount: Number(p.amount || 0),
      ref: p.transaction_id || p.ref || '',
      status: p.status || 'completed',
      discount: Number(p.discount || 0),
      late_fee: Number(p.late_fee || 0)
    }));

    AppState.receipts = mergeReceipts(serverReceipts);
    saveState();
    return true;
  } catch (e) {
    console.warn('Failed to hydrate receipts from backend:', e);
    return false;
  }
}

async function fetchTeachersFromBackend() {
  try {
    const response = await fetchWithTimeout(`${API_URL}/teachers`, {}, 8000);
    if (!response || !response.ok) throw new Error(`Failed to fetch teachers: ${response?.status || 'no response'}`);
    const teachers = await response.json();

    const backendList = (teachers || []).map(t => ({
      id: t.id,
      emp_id: t.emp_id || '',
      name: t.name || '',
      phone: t.phone || '',
      email: t.email || '',
      subjects: t.subject || '',
      joinDate: t.date_of_joining || '',
      salary: Number(t.salary || 0),
      status: (t.status || 'active').toLowerCase()
    }));

    const backendIds = new Set(backendList.map(t => String(t.id)));
    const localOnly = (AppState.teachers || []).filter(t => t.id == null || !backendIds.has(String(t.id)));

    AppState.teachers = backendList.concat(localOnly);
    return AppState.teachers;
  } catch (e) {
    console.warn('Could not load teachers from backend:', e);
    return [];
  }
}

function renderDashboard(){
  if (chartRenderInProgress) return;
  
  // Initialize server status check
  startServerStatusCheck();
  
  // Update month label for fees KPI
  const titleEl = qs('#kpiFeesTitle');
  const isReceptionPanel = getUserRole() === 'admin' && getAdminPanelRole() === 'reception';
  if (titleEl) {
    titleEl.textContent = isReceptionPanel
      ? 'Fees Collected (Today)'
      : `Fees Collected (${formatMonthYear(monthOfToday())})`;
  }
  
  // Load data from database
  loadDashboardData();
  
  // Setup refresh button
  const btnRefresh = qs('#btnRefreshDash');
  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      btnRefresh.disabled = true;
      btnRefresh.textContent = '⏳ Syncing...';
      try {
        await loadDashboardData();
      } catch (err) {
        console.error('Refresh failed:', err);
      } finally {
        btnRefresh.disabled = false;
        btnRefresh.textContent = '🔄 Refresh';
      }
    };
  }
  
  const btnExportCSV = qs('#btnExportCSV');
  if (btnExportCSV) btnExportCSV.onclick = exportStudentsCSV;
  const btnPrint = qs('#btnPrint');
  if (btnPrint) btnPrint.onclick = ()=> window.print();

  initDashboardInteractions();
  initDashboardGoogleMap();
}

function renderStudentStatusOverview(students = []) {
  const container = qs('#studentStatusContainer');
  if (!container) return;

  // Count students by status
  const statusCounts = {};
  const statusIcons = {
    'Active': '✓',
    'Alumni': '🎓',
    'Pending': '⏳',
    'Inactive': '✗',
    'Left': '📤'
  };
  
  const statusColors = {
    'Active': '#22c55e',
    'Alumni': '#8b5cf6',
    'Pending': '#f59e0b',
    'Inactive': '#ef4444',
    'Left': '#6b7280'
  };

  students.forEach(s => {
    const status = s.status || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Generate HTML for status cards
  const statusHTML = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([status, count]) => `
      <div
        class="status-card"
        data-status="${status}"
        role="button"
        tabindex="0"
        title="Filter students by ${status}"
        style="
          background: linear-gradient(135deg, ${statusColors[status] || '#6366f1'}15 0%, ${statusColors[status] || '#6366f1'}05 100%);
          border: 1px solid ${statusColors[status] || '#6366f1'}30;
        "
      >
        <div class="status-card__icon">
          ${statusIcons[status] || '📌'}
        </div>
        <div class="status-card__count" style="color: ${statusColors[status] || '#6366f1'};">
          ${count}
        </div>
        <div class="status-card__label">
          ${status}
        </div>
      </div>
    `)
    .join('');

  container.innerHTML = statusHTML || '<div style="padding: 12px; color: #999;">No student data available</div>';

  // Open students view and apply status filter on interaction
  qsa('.status-card').forEach(card => {
    const activateStatusFilter = () => {
      const status = card.getAttribute('data-status') || '';
      openStudentsViewWithFilters({ status });
    };

    card.addEventListener('click', activateStatusFilter);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateStatusFilter();
      }
    });
  });
}


async function loadDashboardData() {
  // Fetch all data in parallel, but don't let one slow request block everything
  const [statsRes, attendanceRes, studentsRes, paymentsRes, teachersRes] = await Promise.allSettled([
    fetchDashboardStats(),
    fetchTodayAttendance(),
    fetchAllStudents(),
    fetchAllPayments(),
    fetchTeachersFromBackend()
  ]);

  const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
  const todayAttendance = attendanceRes.status === 'fulfilled' ? attendanceRes.value : [];
  const allStudents = studentsRes.status === 'fulfilled' ? studentsRes.value : [];
  const allPayments = paymentsRes.status === 'fulfilled' ? paymentsRes.value : [];
  const allTeachers = teachersRes.status === 'fulfilled' ? teachersRes.value : (AppState.teachers || []);
  const normalizedPayments = Array.isArray(allPayments)
    ? allPayments
    : (allPayments && Array.isArray(allPayments.payments) ? allPayments.payments : []);

  if (statsRes.status === 'rejected') console.warn('Dashboard stats failed:', statsRes.reason);
  if (attendanceRes.status === 'rejected') console.warn('Attendance fetch failed:', attendanceRes.reason);
  if (studentsRes.status === 'rejected') console.warn('Students fetch failed:', studentsRes.reason);
  if (paymentsRes.status === 'rejected') console.warn('Payments fetch failed:', paymentsRes.reason);
  if (teachersRes.status === 'rejected') console.warn('Teachers fetch failed:', teachersRes.reason);

  renderDashboardIssuesTab(normalizedPayments);

  // Map backend payments into AppState.receipts so fee KPIs use real data
  try {
    const studentById = {};
    allStudents.forEach(s => { studentById[s.id] = s; });
    const serverReceipts = (normalizedPayments || []).map(p => {
      const student = studentById[p.student_id] || {};
      return {
        id: p.id,
        no: p.id,
        date: p.payment_date,
        roll: student.roll_no || student.roll || '',
        name: student.name || '',
        method: p.payment_method || p.method || '',
        amount: Number(p.amount || 0),
        ref: p.transaction_id || p.ref || '',
        status: p.status || ''
      };
    });

    // merge server receipts with any local unsynced entries
    AppState.receipts = mergeReceipts(serverReceipts);
    saveState();
  } catch (e) {
    console.warn('Failed to map payments to receipts:', e);
  }

  // Update KPI cards with real data
  const kpiStudents = qs('#kpiStudents');
  const kpiAttendance = qs('#kpiAttendance');
  const kpiAttendanceDelta = qs('#kpiAttendanceDelta');
  const kpiFees = qs('#kpiFees');
  const kpiFeesDelta = qs('#kpiFeesDelta');
  const kpiIssues = qs('#kpiIssues');
  // refresh label since month may have changed since last render
  const titleEl = qs('#kpiFeesTitle');
  const isReceptionPanel = getUserRole() === 'admin' && getAdminPanelRole() === 'reception';
  if (titleEl) {
    titleEl.textContent = isReceptionPanel
      ? 'Fees Collected (Today)'
      : `Fees Collected (${formatMonthYear(monthOfToday())})`;
  }
  if (kpiFeesDelta) {
    if (isReceptionPanel) {
      const breakdown = getTodayMethodBreakdown();
      kpiFeesDelta.textContent = [
        `Cash ${breakdown.cash.count} (${fmtINR(breakdown.cash.amount)})`,
        `Bank ${breakdown.bank.count} (${fmtINR(breakdown.bank.amount)})`,
        `UPI ${breakdown.upi.count} (${fmtINR(breakdown.upi.amount)})`
      ].join(' | ');
    } else {
      kpiFeesDelta.textContent = formatMonthYear(monthOfToday());
    }
  }
  
  if (stats) {
    const issuesCount = normalizedPayments.filter(p => {
      const status = String(p?.status || '').toLowerCase();
      return status === 'pending' || status === 'failed';
    }).length;

    if (kpiStudents) {
      animateKpiValue(
        kpiStudents,
        Number(stats.total_students || 0),
        (value) => Math.round(value).toLocaleString('en-IN')
      );
    }
    // Prefer receipt-derived totals (already mapped from /payments), then fallback to stats.
    const computedRev = isReceptionPanel ? sumReceiptsToday() : sumReceiptsThisMonth();
    const rev = Number(computedRev || 0) > 0
      ? computedRev
      : (isReceptionPanel
        ? (stats.today_revenue !== undefined ? stats.today_revenue : 0)
        : (stats.month_revenue !== undefined ? stats.month_revenue : stats.total_revenue));
    if (kpiFees) {
      animateKpiValue(
        kpiFees,
        Number(rev || 0),
        (value) => fmtINR(Math.round(value))
      );
    }
    // keep AppState in sync so offline/dashboard refreshes behave
    AppState.kpi.feesCollectedMonth = rev;
    if (kpiIssues) {
      animateKpiValue(
        kpiIssues,
        issuesCount,
        (value) => String(Math.round(value))
      );
    }
    updateIssuesDelta(issuesCount);
    AppState.kpi.issuesOpen = issuesCount;
  } else {
    const issuesCount = normalizedPayments.filter(p => {
      const status = String(p?.status || '').toLowerCase();
      return status === 'pending' || status === 'failed';
    }).length || Number(AppState.kpi.issuesOpen || 0);

    if (kpiStudents) {
      animateKpiValue(
        kpiStudents,
        Number(AppState.kpi.totalStudents || 0),
        (value) => Math.round(value).toLocaleString('en-IN')
      );
    }
    if (kpiFees) {
      animateKpiValue(
        kpiFees,
        Number(AppState.kpi.feesCollectedMonth || 0),
        (value) => fmtINR(Math.round(value))
      );
    }
    if (kpiIssues) {
      animateKpiValue(
        kpiIssues,
        issuesCount,
        (value) => String(Math.round(value))
      );
    }
    updateIssuesDelta(issuesCount);
  }

  // Dashboard Attendance Today KPI = Teacher attendance marked for today.
  const teacherAttendanceToday = getTeacherAttendanceSummaryForDate(todayYYYYMMDD(), allTeachers);
  if (kpiAttendance) {
    animateKpiValue(
      kpiAttendance,
      Number(teacherAttendanceToday.percent || 0),
      (value) => `${value.toFixed(1)}%`
    );
  }
  if (kpiAttendanceDelta) {
    kpiAttendanceDelta.textContent = `Present ${teacherAttendanceToday.present} / Total ${teacherAttendanceToday.total}`;
    kpiAttendanceDelta.classList.remove('positive', 'negative');
    kpiAttendanceDelta.classList.add('neutral');
  }

  // Render student status overview
  renderStudentStatusOverview(allStudents);

  // Update fees view KPIs if visible
  if (AppState.view === 'fees' || qs('#view-fees') && !qs('#view-fees').classList.contains('hidden')) {
    await renderFees();
  }

  // Render charts with real data
  requestAnimationFrame(() => {
    chartRenderInProgress = true;
    initAdmissionsChart(allStudents);
    initAttendanceChart(allStudents, todayAttendance);
    chartRenderInProgress = false;
  });
}

function initAdmissionsChart(students = []){
  const ctx = qs('#chartAdmissions');
  if (!ctx) return;
  
  try {
    if (admissionsChart) {
      admissionsChart.destroy();
      admissionsChart = null;
    }

    const rangeSel = qs('#admissionsRange');
    const months = Number(rangeSel?.value || 6);
    const series = getAdmissionsSeries(students, months);
    const animate = !!(AppState.settings?.chartAnimation);

    admissionsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [{
          label: 'Admissions',
          data: series.data,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: animate ? { duration: 300 } : false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    if (rangeSel) {
      rangeSel.onchange = () => {
        initAdmissionsChart(students);
      };
    }
  } catch (e) {
    console.error('Error rendering admissions chart:', e);
  }
}

function initAttendanceChart(students = [], attendanceData = []){
  const ctx = qs('#chartAttendance');
  if (!ctx) return;

  try {
    if (attendanceChart) {
      attendanceChart.destroy();
      attendanceChart = null;
    }

    // Group attendance by class
    const classAttendance = {};
    students.forEach(s => {
      const cls = s.class_name || 'Unknown';
      if (!classAttendance[cls]) {
        classAttendance[cls] = { present: 0, total: 0 };
      }
      classAttendance[cls].total++;
    });

    // Count present students by class
    attendanceData.forEach(a => {
      const student = students.find(s => s.id === a.student_id);
      if (student) {
        const cls = student.class_name || 'Unknown';
        if (classAttendance[cls] && a.status === 'Present') {
          classAttendance[cls].present++;
        }
      }
    });

    const classes = Object.keys(classAttendance).sort();
    const data = classes.map(cls => 
      classAttendance[cls].total > 0 
        ? Math.round((classAttendance[cls].present / classAttendance[cls].total) * 100)
        : 0
    );
    
    const animate = !!(AppState.settings?.chartAnimation);

    attendanceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: classes,
        datasets: [{
          label: 'Attendance %',
          data,
          backgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: animate ? { duration: 300 } : false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100 },
          x: { ticks: { autoSkip: true, maxTicksLimit: 10 } }
        }
      }
    });
  } catch (e) {
    console.error('Error rendering attendance chart:', e);
  }
}

// ---------- Students View ----------
function renderStudents(){
  const filterClass=qs('#filterClass');
  const filterSection=qs('#filterSection');
  const filterStatus=qs('#filterStatus');
  const searchInput=qs('#searchStudent');
  const tbody=qs('#studentsBody');
  const pagination=qs('#pagination');

  if (!filterClass || !filterSection || !filterStatus || !searchInput || !tbody || !pagination) {
    console.error('Missing required student view elements');
    return;
  }

  function applyFilters(){
    let rows=[...AppState.students];
    const fc=filterClass.value;
    const fs=filterSection.value;
    const fstatus=filterStatus.value;
    const q=(searchInput.value||'').trim().toLowerCase();

    if(fc) rows=rows.filter(r=> r.class===fc);
    if(fs) rows=rows.filter(r=> r.section===fs);
    if(fstatus) rows=rows.filter(r=> r.status===fstatus);
    if(q){
      rows=rows.filter(r=>
        r.name.toLowerCase().includes(q) ||
        r.roll.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        (r.aadhar||'').toLowerCase().includes(q) ||
        (r.admission_date||'').toLowerCase().includes(q)
      );
    }

    AppState.pagination.students.filtered=rows;
    const pageSize=AppState.pagination.students.pageSize;
    AppState.pagination.students.totalPages=Math.max(1, Math.ceil(rows.length/pageSize));
    renderStudentsTable(); renderStudentsPagination();
  }

  function estimateMonthlyFee(student){
    // Use getFeesForStudentMonth for current month so admission date is considered
    const month = monthOfToday();
    const heads = getFeesForStudentMonth(student, month) || {};
    return Object.values(heads).reduce((a,b)=> a+Number(b||0),0);
  }

  function getCurrentMonthDue(student){
    const month = monthOfToday();
    const financials = getStudentMonthFinancials(student, month);
    return Number(financials.balance || 0);
  }

  function getDueHighlightClass(dueAmount){
    if (dueAmount > 2000) return 'student-due-high';
    if (dueAmount > 1000 && dueAmount <= 2000) return 'student-due-mid-high';
    if (dueAmount >= 500 && dueAmount <= 1000) return 'student-due-mid';
    if (dueAmount < 500) return 'student-due-low';
    return '';
  }

  function renderStudentsTable(){
    const {page,pageSize,filtered}=AppState.pagination.students;
    const start=(page-1)*pageSize;
    const pageRows=filtered.slice(start,start+pageSize);
    tbody.innerHTML=pageRows.map(r=> {
      const dueAmount = getCurrentMonthDue(r);
      const dueClass = getDueHighlightClass(dueAmount);
      return `
      <tr>
        <td><input type="checkbox" aria-label="Select row" /></td>
        <td>${r.roll}</td>
        <td>${r.admission_date||''}</td>
        <td>${r.aadhar||''}</td>
        <td class="student-due-name ${dueClass}">${r.name}</td>
        <td>${r.class}</td>
        <td>${r.section}</td>
        <td>${r.phone}</td>
        <td><span class="badge">${r.status}</span></td>
        <td>${fmtINR(estimateMonthlyFee(r))}</td>
        <td style="text-align:right;">
          <button class="btn btn-ghost small" data-act="edit" data-roll="${r.roll}">Edit</button>
          <button class="btn btn-ghost small" data-act="delete" data-roll="${r.roll}">Delete</button>
        </td>
      </tr>
    `;
    }).join('');
    qsa('button[data-act="edit"]').forEach(btn=>{
      btn.onclick=()=> openEditStudent(btn.getAttribute('data-roll'));
    });
    qsa('button[data-act="delete"]').forEach(btn=>{
      btn.onclick=async ()=>{
        const roll=btn.getAttribute('data-roll');
        const student=AppState.students.find(s=> s.roll===roll);
        if(!student) return;
        
        // If student doesn't have an ID, sync it to backend first
        if(!student.id) {
          if(!confirm(`This student hasn't been saved to the database yet. Save it now and then delete?`)) return;
          
          try {
            const newId = await syncLocalStudentToBackend(student);
            student.id = newId; // Update the student with the new ID
            saveState();
            console.log(`✅ Student ${student.name} saved to database with ID: ${newId}`);
          } catch (err) {
            alert(`Error saving student to database: ${err.message}. Cannot delete until saved.`);
            return;
          }
        }
        
        if(!confirm(`Delete student ${student.name} (Roll: ${roll})? This action cannot be undone.`)) return;
        
        try {
          // Delete from backend database by student id (stable)
          // the fetch itself will fail if the server is unreachable; the
          // offline flag is only advisory so we no longer block based solely
          // on it.
          const response = await fetch(`${API_URL}/students/${student.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          });

          if (!response || !response.ok) {
            const text = await (response ? response.text() : Promise.resolve('no response'));
            throw new Error(`Failed to delete student: ${response ? response.status : 'no response'} ${text}`);
          }

          // Remove from AppState only after successful backend deletion
          AppState.students = AppState.students.filter(s => s.id !== student.id);
          AppState.kpi.totalStudents = AppState.students.length;
          saveState();
          renderStudents();
          alert(`Student ${student.name} deleted successfully from database!`);
        } catch (err) {
          console.error('Delete error:', err);
          alert(`Error deleting student: ${err.message}`);
        }
      };
    });
  }

  function renderStudentsPagination(){
    const {page,totalPages}=AppState.pagination.students;
    let html='';
    html+=`<button class="btn btn-ghost small" ${page<=1?'disabled':''} data-pg="prev">◀ Prev</button>`;
    html+=`<span class="muted"> Page ${page} of ${totalPages} </span>`;
    html+=`<button class="btn btn-ghost small" ${page>=totalPages?'disabled':''} data-pg="next">Next ▶</button>`;
    pagination.innerHTML=html;
    qsa('button[data-pg]').forEach(b=>{
      b.onclick=()=>{
        const act=b.getAttribute('data-pg');
        if(act==='prev'&&AppState.pagination.students.page>1) AppState.pagination.students.page--;
        if(act==='next'&&AppState.pagination.students.page<AppState.pagination.students.totalPages) AppState.pagination.students.page++;
        renderStudentsTable(); renderStudentsPagination();
      };
    });
  }

  // Page size from settings
  AppState.pagination.students.page=1;
  AppState.pagination.students.pageSize = AppState.settings.studentsPageSize || 10;

  applyFilters();
  filterClass.onchange=applyFilters;
  filterSection.onchange=applyFilters;
  filterStatus.onchange=applyFilters;
  searchInput.oninput=applyFilters;

  const btnAddStudent = qs('#btnAddStudent');
  if (btnAddStudent) btnAddStudent.onclick = ()=> {
    // ensure we start in add mode (clear any previous editRoll that might
    // have been left behind when user opened the edit dialog and then
    // cancelled). also reset the form fields so they don't show old data.
    const form = qs('#formAddStudent');
    if(form){
      delete form.dataset.editRoll;
      form.reset();
      // make sure header/button text is correct for add mode
      const hdr = qs('#modalAddStudent .modal__header h3');
      if(hdr) hdr.textContent = 'Add Student';
      const submitBtn = qs('#modalAddStudent .modal__footer button[value="submit"]');
      if(submitBtn) submitBtn.textContent = 'Save';
    }
    openModal('#modalAddStudent');
  };
  const btnImportCSV = qs('#btnImportCSV');
  if (btnImportCSV) btnImportCSV.onclick = ()=> openModal('#modalImportCSV');
  const btnBulkExport = qs('#btnBulkExport');
  if (btnBulkExport) btnBulkExport.onclick = exportStudentsCSV;
  const btnBulkSMS = qs('#btnBulkSMS');
  if (btnBulkSMS) btnBulkSMS.onclick = ()=> alert('SMS integration to be added (e.g., Twilio/Msg91).');
}
function openEditStudent(roll){ 
  const student=AppState.students.find(s=> s.roll===roll);
  if(!student) { alert('Student not found'); return; }
  
  // Set form to edit mode and clear any stale inputs first
  const form=qs('#formAddStudent');
  if(!form){ alert('Form not found'); return; }
  form.reset();
  form.dataset.editRoll=roll;
  
  // Populate form with student data
  qs('input[name="name"]', form).value=student.name;
  qs('input[name="roll"]', form).value=student.roll;
  qs('input[name="admission_date"]', form).value=student.admission_date || '';
  qs('input[name="dob"]', form).value=student.dob || '';
  qs('input[name="aadhar"]', form).value=student.aadhar || '';
  qs('input[name="father_name"]', form).value=student.father_name || '';
  qs('input[name="mother_name"]', form).value=student.mother_name || '';
  qs('select[name="class"]', form).value=student.class;
  qs('select[name="section"]', form).value=student.section;
  qs('input[name="phone"]', form).value=student.phone;
  qs('select[name="status"]', form).value=student.status;
  
  // Change modal title
  const header=qs('#modalAddStudent .modal__header h3');
  header.textContent='Edit Student';
  
  // Change submit button text
  const submitBtn=qs('#modalAddStudent .modal__footer button[value="submit"]');
  submitBtn.textContent='Update';
  
  openModal('#modalAddStudent');
}

// ---------- Parents View ----------
async function fetchParentsFromBackend() {
  try {
    const response = await fetchWithTimeout(`${API_URL}/parents`, {}, 8000);
    if (!response || !response.ok) throw new Error(`Failed to fetch parents: ${response?.status || 'no response'}`);
    const parents = await response.json();
    AppState.parents = Array.isArray(parents) ? parents : [];
    return AppState.parents;
  } catch (e) {
    console.error('Error fetching parents:', e);
    AppState.parents = [];
    return [];
  }
}

async function fetchParentDetails(parentId) {
  const response = await fetchWithTimeout(`${API_URL}/parents/${parentId}`, {}, 8000);
  if (!response || !response.ok) throw new Error(`Failed to fetch parent details: ${response?.status || 'no response'}`);
  return response.json();
}

function renderParents() {
  const tableBody = qs('#parentsTableBody');
  const filterInput = qs('#filterParent');
  const detailBody = qs('#parentDetailBody');
  const btnAddParent = qs('#btnAddParent');
  const btnRefreshParents = qs('#btnRefreshParents');
  const btnExportParents = qs('#btnExportParents');
  const formParentEdit = qs('#formParentEdit');
  const parentModalTitle = qs('#parentModalTitle');

  if (!tableBody || !filterInput || !detailBody || !btnAddParent || !btnRefreshParents || !formParentEdit) {
    console.error('Parents view elements missing');
    return;
  }

  const renderTable = () => {
    const search = (filterInput.value || '').trim().toLowerCase();
    const rows = (AppState.parents || []).filter(p => {
      const name = (p.name || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      return !search || name.includes(search) || phone.includes(search) || email.includes(search);
    });

    tableBody.innerHTML = rows.map(p => {
      const childrenCount = Array.isArray(p.children) ? p.children.length : 0;
      return `
        <tr>
          <td>${p.name || ''}</td>
          <td>${p.phone || ''}</td>
          <td>${p.email || ''}</td>
          <td>${childrenCount}</td>
          <td style="text-align:right;">
            <button class="btn btn-ghost small" data-parent-act="view" data-id="${p.id}">View</button>
            <button class="btn btn-ghost small" data-parent-act="edit" data-id="${p.id}">Edit</button>
            <button class="btn btn-ghost small" data-parent-act="delete" data-id="${p.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="5" class="muted">No parents found.</td></tr>';

    qsa('button[data-parent-act="view"]').forEach(btn => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute('data-id'));
        AppState.selectedParentId = id;
        await renderParentDetails(id, detailBody);
      };
    });

    qsa('button[data-parent-act="edit"]').forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.getAttribute('data-id'));
        const parent = (AppState.parents || []).find(p => Number(p.id) === id);
        if (!parent) return;
        formParentEdit.dataset.parentId = String(id);
        if (parentModalTitle) parentModalTitle.textContent = 'Edit Parent';
        qs('#parentNameInput').value = parent.name || '';
        qs('#parentRelationInput').value = parent.relation || '';
        qs('#parentPhoneInput').value = parent.phone || '';
        qs('#parentEmailInput').value = parent.email || '';
        qs('#parentAddressInput').value = parent.address || '';
        openModal('#modalParentEdit');
      };
    });

    qsa('button[data-parent-act="delete"]').forEach(btn => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute('data-id'));
        const parent = (AppState.parents || []).find(p => Number(p.id) === id);
        if (!parent) return;
        if (!confirm(`Delete parent ${parent.name}?`)) return;

        try {
          const response = await fetchWithTimeout(`${API_URL}/parents/${id}`, { method: 'DELETE' }, 8000);
          if (!response || !response.ok) throw new Error(`Delete failed: ${response?.status || 'no response'}`);
          await refreshParents();
          if (AppState.selectedParentId === id) {
            AppState.selectedParentId = null;
            detailBody.innerHTML = '<p class="muted">Select a parent to view details and manage children.</p>';
          }
        } catch (e) {
          alert(`Failed to delete parent: ${e.message}`);
        }
      };
    });
  };

  const renderParentDetails = async (parentId, targetEl) => {
    if (!parentId || !targetEl) return;
    targetEl.innerHTML = '<p class="muted">Loading parent details…</p>';
    try {
      const details = await fetchParentDetails(parentId);
      const children = Array.isArray(details.children) ? details.children : [];
      const childrenHtml = children.length
        ? `<ul class="m-8-0-0-20">${children.map(c => `<li>${c.name || ''} (${c.roll_no || ''})</li>`).join('')}</ul>`
        : '<p class="muted">No children linked yet.</p>';

      targetEl.innerHTML = `
        <div class="grid gap-8">
          <div><strong>Name:</strong> ${details.name || ''}</div>
          <div><strong>Relation:</strong> ${details.relation || ''}</div>
          <div><strong>Phone:</strong> ${details.phone || ''}</div>
          <div><strong>Email:</strong> ${details.email || ''}</div>
          <div><strong>Address:</strong> ${details.address || ''}</div>
          <div><strong>Children:</strong>${childrenHtml}</div>
        </div>
      `;
    } catch (e) {
      targetEl.innerHTML = `<p class="error-note">Failed to load parent details: ${e.message}</p>`;
    }
  };

  const refreshParents = async () => {
    await fetchParentsFromBackend();
    renderTable();
    if (AppState.selectedParentId) {
      await renderParentDetails(AppState.selectedParentId, detailBody);
    }
  };

  btnAddParent.onclick = () => {
    formParentEdit.reset();
    delete formParentEdit.dataset.parentId;
    if (parentModalTitle) parentModalTitle.textContent = 'Create Parent';
    openModal('#modalParentEdit');
  };

  btnRefreshParents.onclick = refreshParents;

  if (btnExportParents) {
    btnExportParents.onclick = () => {
      const header = ['id', 'name', 'relation', 'phone', 'email', 'address'];
      const rows = (AppState.parents || []).map(p => [p.id || '', p.name || '', p.relation || '', p.phone || '', p.email || '', p.address || '']);
      const csv = arrayToCSV([header, ...rows]);
      downloadFile('parents_export.csv', csv);
    };
  }

  filterInput.oninput = renderTable;

  formParentEdit.onsubmit = async (e) => {
    e.preventDefault();
    const parentId = formParentEdit.dataset.parentId;
    const payload = {
      name: (qs('#parentNameInput')?.value || '').trim(),
      relation: (qs('#parentRelationInput')?.value || '').trim(),
      phone: (qs('#parentPhoneInput')?.value || '').trim(),
      email: (qs('#parentEmailInput')?.value || '').trim(),
      address: (qs('#parentAddressInput')?.value || '').trim()
    };

    if (!payload.name) {
      alert('Parent name is required');
      return;
    }

    try {
      const url = parentId ? `${API_URL}/parents/${parentId}` : `${API_URL}/parents`;
      const method = parentId ? 'PUT' : 'POST';
      const response = await fetchWithTimeout(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 8000);

      if (!response || !response.ok) {
        const body = await (response ? response.text() : Promise.resolve('no response'));
        throw new Error(`${response?.status || ''} ${body}`.trim());
      }

      formParentEdit.closest('dialog')?.close();
      await refreshParents();
    } catch (err) {
      alert(`Failed to save parent: ${err.message}`);
    }
  };

  refreshParents();
}

function exportStaffCSV() {
  const header = ['id', 'name', 'role', 'phone', 'join_date', 'monthly_salary', 'status'];
  const rows = (AppState.staff || []).map(s => [
    s.id || '',
    s.name || '',
    s.role || '',
    s.phone || '',
    s.joinDate || '',
    Number(s.salary || 0),
    s.status || 'active'
  ]);
  const csv = arrayToCSV([header, ...rows]);
  downloadFile('staff_export.csv', csv);
}

function exportStaffJSON() {
  const json = JSON.stringify(AppState.staff || [], null, 2);
  downloadFile('staff_export.json', json);
}

function exportStaffPDF() {
  const data = AppState.staff || [];
  let html = '<h2>Staff Report</h2><p>Generated: ' + new Date().toDateString() + '</p><table border="1" cellpadding="5" cellspacing="0">';
  html += '<tr><th>Name</th><th>Role</th><th>Phone</th><th>Join Date</th><th>Salary</th><th>Status</th></tr>';
  data.forEach(s => {
    html += '<tr><td>' + (s.name || '') + '</td><td>' + (s.role || '') + '</td><td>' + (s.phone || '') + '</td><td>' + (s.joinDate || '') + '</td><td>' + fmtINR(Number(s.salary || 0)) + '</td><td>' + (s.status || 'active') + '</td></tr>';
  });
  html += '</table>';
  alert('PDF preview:\n\n' + html.replace(/<[^>]*>/g, '\n'));
}

function renderStaff() {
  const tableBody = qs('#staffTableBody');
  const searchInput = qs('#staffSearch');
  const btnAdd = qs('#staffBtnAdd');
  const prefBtn = qs('#staffBtnPreferences');
  const prefBox = qs('#staffPreferencesBox');
  const closePrefBtn = qs('#closePrefBtn');
  const tableContainer = qs('#staffTableContainer');
  const cardsContainer = qs('#staffCardsContainer');
  const listContainer = qs('#staffListContainer');
  const addStaffModal = qs('#addStaffModal');
  const closeAddStaffBtn = qs('#closeAddStaffBtn');
  const cancelAddStaffBtn = qs('#cancelAddStaffBtn');
  const addStaffForm = qs('#addStaffForm');
  const salaryGroup = qs('#salaryGroup');
  
  if (!tableBody || !searchInput || !btnAdd || !prefBtn || !prefBox) return;

  if (!Array.isArray(AppState.staff)) AppState.staff = [];
  const isMainAdmin = getUserRole() === 'admin' && getAdminPanelRole() === 'main_admin';

  // Show/hide salary field based on admin role
  if (salaryGroup) {
    salaryGroup.style.display = isMainAdmin ? 'flex' : 'none';
  }

  // Initialize preferences from localStorage
  const prefKey = 'staffPreferences';
  let prefs = JSON.parse(localStorage.getItem(prefKey)) || {
    viewMode: 'table',
    columns: {
      name: true,
      role: true,
      phone: true,
      joinDate: true,
      salary: true,
      status: true
    },
    staffTypeFilter: ''
  };

  // Save preferences
  const savePrefs = () => localStorage.setItem(prefKey, JSON.stringify(prefs));

  // Toggle preferences box
  prefBtn.onclick = () => prefBox.classList.toggle('hidden');
  closePrefBtn.onclick = () => prefBox.classList.add('hidden');

  // Modal handlers
  const openAddStaffModal = () => {
    addStaffModal.classList.remove('hidden');
    qs('#staffName').focus();
  };

  const closeModal = () => {
    addStaffModal.classList.add('hidden');
    addStaffForm.reset();
  };

  btnAdd.onclick = openAddStaffModal;
  closeAddStaffBtn.onclick = closeModal;
  cancelAddStaffBtn.onclick = closeModal;

  // Close modal when clicking outside
  addStaffModal.onclick = (e) => {
    if (e.target === addStaffModal) closeModal();
  };

  // Handle form submission
  addStaffForm.onsubmit = (e) => {
    e.preventDefault();

    const name = (qs('#staffName').value || '').trim();
    const role = (qs('#staffRole').value || '').trim();
    const phone = (qs('#staffPhone').value || '').trim();
    let salary = 0;

    if (!name || !role || !phone) {
      alert('Please fill in all required fields.');
      return;
    }

    if (isMainAdmin) {
      const salaryInput = qs('#staffSalary').value || '0';
      salary = Number(salaryInput);
      if (!Number.isFinite(salary) || salary < 0) {
        alert('Please enter a valid non-negative salary amount.');
        return;
      }
    }

    const status = (qs('#staffStatus').value || 'active').trim();

    AppState.staff.push({
      id: Date.now(),
      name,
      role,
      phone,
      joinDate: todayYYYYMMDD(),
      salary,
      status
    });

    saveState();
    closeModal();
    render();
  };

  // View mode toggles
  qsa('.view-toggle').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view-mode') === prefs.viewMode);
    btn.onclick = () => {
      qsa('.view-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      prefs.viewMode = btn.getAttribute('data-view-mode');
      savePrefs();
      render();
    };
  });

  // Column checkboxes
  ['Name', 'Role', 'Phone', 'JoinDate', 'Salary', 'Status'].forEach(col => {
    const key = col.charAt(0).toLowerCase() + col.slice(1);
    const checkbox = qs('#col' + col);
    if (checkbox) {
      checkbox.checked = prefs.columns[key] !== false;
      checkbox.onchange = () => {
        prefs.columns[key] = checkbox.checked;
        savePrefs();
        render();
      };
    }
  });

  // Staff type filter
  const staffTypeSelect = qs('#staffTypeFilter');
  if (staffTypeSelect) {
    staffTypeSelect.value = prefs.staffTypeFilter || '';
    staffTypeSelect.onchange = () => {
      prefs.staffTypeFilter = staffTypeSelect.value;
      savePrefs();
      render();
    };
  }

  // Export buttons
  const exportCSVBtn = qs('#exportCSV');
  const exportJSONBtn = qs('#exportJSON');
  const exportPDFBtn = qs('#exportPDF');
  
  if (exportCSVBtn) exportCSVBtn.onclick = exportStaffCSV;
  if (exportJSONBtn) exportJSONBtn.onclick = exportStaffJSON;
  if (exportPDFBtn) exportPDFBtn.onclick = exportStaffPDF;

  // Get filtered staff
  const getFilteredStaff = () => {
    const query = (searchInput.value || '').trim().toLowerCase();
    let filtered = AppState.staff.filter(s => {
      const hay = `${s.name || ''} ${s.role || ''} ${s.phone || ''}`.toLowerCase();
      const matchesSearch = !query || hay.includes(query);
      const matchesType = !prefs.staffTypeFilter || (s.role || '').toLowerCase() === prefs.staffTypeFilter.toLowerCase();
      return matchesSearch && matchesType;
    });
    return filtered;
  };

  // Table view
  const renderTableView = () => {
    const rows = getFilteredStaff();
    const cells = [];
    
    if (prefs.columns.name) cells.push('name');
    if (prefs.columns.role) cells.push('role');
    if (prefs.columns.phone) cells.push('phone');
    if (prefs.columns.joinDate) cells.push('joinDate');
    if (prefs.columns.salary) cells.push('salary');
    if (prefs.columns.status) cells.push('status');

    // Update table headers
    const thead = qs('#staffTableContainer thead tr');
    if (thead) {
      qsa('#staffTableContainer th').forEach((th, idx) => {
        if (idx < qsa('#staffTableContainer th').length - 1) {
          const classList = th.className;
          const colClass = classList.split('col-')[1]?.split(' ')[0];
          if (colClass && !cells.includes(colClass === 'joinDate' ? 'joinDate' : colClass.replace(/Date/, 'Date'))) {
            th.classList.add('hidden');
          } else {
            th.classList.remove('hidden');
          }
        }
      });
    }

    tableBody.innerHTML = rows.map(s => `
      <tr>
        ${prefs.columns.name ? `<td class="col-name">${s.name || ''}</td>` : ''}
        ${prefs.columns.role ? `<td class="col-role">${s.role || ''}</td>` : ''}
        ${prefs.columns.phone ? `<td class="col-phone">${s.phone || ''}</td>` : ''}
        ${prefs.columns.joinDate ? `<td class="col-joinDate">${s.joinDate || ''}</td>` : ''}
        ${prefs.columns.salary ? `<td class="col-salary">${isMainAdmin ? fmtINR(Number(s.salary || 0)) : '—'}</td>` : ''}
        ${prefs.columns.status ? `<td class="col-status"><span class="badge ${String(s.status || 'active').toLowerCase() === 'active' ? 'success' : 'warn'}">${s.status || 'active'}</span></td>` : ''}
        <td style="text-align:right;">
          ${isMainAdmin ? `<button class="btn btn-ghost small" data-staff-salary="${s.id}">💰</button>` : ''}
          <button class="btn btn-ghost small" data-staff-del="${s.id}">🗑️</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="muted">No staff records found.</td></tr>';

    attachTableListeners();
  };

  // Card view
  const renderCardView = () => {
    const rows = getFilteredStaff();
    const html = rows.map(s => `
      <div class="staff-card">
        <div class="staff-card-header">
          <p class="staff-card-name">${s.name || ''}</p>
          <p class="staff-card-role">${s.role || ''}</p>
        </div>
        <div class="staff-card-body">
          ${prefs.columns.phone ? `<div class="staff-card-field"><span class="staff-card-label">📞 Phone:</span><span class="staff-card-value">${s.phone || ''}</span></div>` : ''}
          ${prefs.columns.joinDate ? `<div class="staff-card-field"><span class="staff-card-label">📅 Join Date:</span><span class="staff-card-value">${s.joinDate || ''}</span></div>` : ''}
          ${prefs.columns.salary && isMainAdmin ? `<div class="staff-card-field"><span class="staff-card-label">💰 Salary:</span><span class="staff-card-value">${fmtINR(Number(s.salary || 0))}</span></div>` : ''}
          ${prefs.columns.status ? `<div class="staff-card-status"><span class="badge ${String(s.status || 'active').toLowerCase() === 'active' ? 'success' : 'warn'}">${s.status || 'active'}</span></div>` : ''}
        </div>
        <div class="staff-card-actions">
          ${isMainAdmin ? `<button class="btn btn-ghost small" data-staff-salary="${s.id}">💰 Salary</button>` : ''}
          <button class="btn btn-ghost small" data-staff-del="${s.id}">🗑️ Delete</button>
        </div>
      </div>
    `).join('') || '<p class="muted" style="text-align:center;padding:20px;">No staff records found.</p>';

    qs('#staffCardsContent').innerHTML = html;
    attachCardListeners();
  };

  // List view
  const renderListView = () => {
    const rows = getFilteredStaff();
    const html = rows.map(s => `
      <div class="staff-list-item">
        <div class="staff-list-info">
          <p class="staff-list-name">${s.name || ''}</p>
          <p class="staff-list-details">
            <span>📍 ${s.role || ''}</span>
            ${prefs.columns.phone ? `<span>📞 ${s.phone || ''}</span>` : ''}
            ${prefs.columns.joinDate ? `<span>📅 ${s.joinDate || ''}</span>` : ''}
          </p>
        </div>
        <div class="staff-list-actions">
          ${isMainAdmin && prefs.columns.salary ? `<button class="btn btn-ghost small" data-staff-salary="${s.id}">💰</button>` : ''}
          <button class="btn btn-ghost small" data-staff-del="${s.id}">🗑️</button>
        </div>
      </div>
    `).join('') || '<p class="muted" style="text-align:center;padding:20px;">No staff records found.</p>';

    qs('#staffListContent').innerHTML = html;
    attachListListeners();
  };

  // Attach event listeners
  const attachTableListeners = () => {
    qsa('button[data-staff-salary]').forEach(btn => {
      btn.onclick = () => editSalary(Number(btn.getAttribute('data-staff-salary')));
    });
    qsa('button[data-staff-del]').forEach(btn => {
      btn.onclick = () => deleteStaff(Number(btn.getAttribute('data-staff-del')));
    });
  };

  const attachCardListeners = () => {
    qsa('#staffCardsContent button[data-staff-salary]').forEach(btn => {
      btn.onclick = () => editSalary(Number(btn.getAttribute('data-staff-salary')));
    });
    qsa('#staffCardsContent button[data-staff-del]').forEach(btn => {
      btn.onclick = () => deleteStaff(Number(btn.getAttribute('data-staff-del')));
    });
  };

  const attachListListeners = () => {
    qsa('#staffListContent button[data-staff-salary]').forEach(btn => {
      btn.onclick = () => editSalary(Number(btn.getAttribute('data-staff-salary')));
    });
    qsa('#staffListContent button[data-staff-del]').forEach(btn => {
      btn.onclick = () => deleteStaff(Number(btn.getAttribute('data-staff-del')));
    });
  };

  const editSalary = (id) => {
    const item = AppState.staff.find(s => Number(s.id) === id);
    if (!item) return;
    const nextSalaryRaw = prompt(`Enter monthly salary for ${item.name}:`, String(Number(item.salary || 0)));
    if (nextSalaryRaw == null) return;
    const nextSalary = Number(nextSalaryRaw);
    if (!Number.isFinite(nextSalary) || nextSalary < 0) {
      alert('Please enter a valid non-negative salary amount.');
      return;
    }
    item.salary = nextSalary;
    saveState();
    render();
  };

  const deleteStaff = (id) => {
    const item = AppState.staff.find(s => Number(s.id) === id);
    if (!item) return;
    if (!confirm(`Delete staff ${item.name}?`)) return;
    AppState.staff = AppState.staff.filter(s => Number(s.id) !== id);
    saveState();
    render();
  };

  const render = () => {
    tableContainer?.classList.toggle('hidden', prefs.viewMode !== 'table');
    cardsContainer?.classList.toggle('hidden', prefs.viewMode !== 'card');
    listContainer?.classList.toggle('hidden', prefs.viewMode !== 'list');

    if (prefs.viewMode === 'table') renderTableView();
    else if (prefs.viewMode === 'card') renderCardView();
    else if (prefs.viewMode === 'list') renderListView();
  };

  searchInput.oninput = render;
  
  // Handle staff tab switching
  qsa('button[data-staff-tab]').forEach(btn => {
    btn.onclick = () => {
      const targetTab = btn.getAttribute('data-staff-tab');
      qsa('button[data-staff-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      qs('#staff-list-tab')?.classList.toggle('d-none', targetTab !== 'staff-list-tab');
      qs('#staff-salary-tab')?.classList.toggle('d-none', targetTab !== 'staff-salary-tab');
      
      if (targetTab === 'staff-salary-tab') {
        renderStaffSalaryPayments();
      }
    };
  });
  
  render();
}

// ---------- Staff Salary Management ----------
function renderStaffSalaryPayments() {
  const tbody = qs('#staffSalaryTableBody');
  if (!tbody) return;

  if (!Array.isArray(AppState.staffSalaryPayments)) AppState.staffSalaryPayments = [];

  const payments = AppState.staffSalaryPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
  tbody.innerHTML = payments.slice(0, 50).map(p => {
    const staff = AppState.staff.find(s => String(s.id) === String(p.staffId));
    return `
      <tr>
        <td>${staff?.name || 'Unknown'}</td>
        <td>${p.month}</td>
        <td>${fmtINR(p.amount)}</td>
        <td>${p.date}</td>
        <td><span class="badge success">${p.status}</span></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5" class="muted">No salary payments yet.</td></tr>';

  const monthInput = qs('#staffSalaryMonth');
  if (monthInput && !monthInput.value) {
    const today = new Date();
    monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }

  const staffSelect = qs('#staffSalaryStaffSelect');
  if (staffSelect) {
    const prevValue = staffSelect.value;
    staffSelect.innerHTML = '<option value="">Select Staff</option>';
    AppState.staff
      .filter(s => s.status === 'active')
      .forEach(s => {
        const salary = Number(s.salary || 0);
        staffSelect.innerHTML += `<option value="${s.id}">${s.name} - ${s.role} (${fmtINR(salary)})</option>`;
      });
    staffSelect.value = prevValue;
  }

  const btnProcessAll = qs('#staffSalaryBtnProcessAll');
  const btnPaySingle = qs('#staffSalaryBtnPaySingle');
  
  if (btnProcessAll) {
    btnProcessAll.onclick = () => {
      const month = monthInput?.value;
      if (!month) {
        alert('Please select a month');
        return;
      }
      processAllStaffSalary(month);
    };
  }

  if (btnPaySingle) {
    btnPaySingle.onclick = () => {
      const month = monthInput?.value;
      const staffId = staffSelect?.value;
      const customAmount = Number(qs('#staffSalaryCustomAmount')?.value || 0);
      
      if (!month) {
        alert('Please select a month');
        return;
      }
      if (!staffId) {
        alert('Please select a staff member');
        return;
      }
      
      processSingleStaffSalary(month, staffId, customAmount);
    };
  }
}

function processAllStaffSalary(month) {
  if (!month) {
    alert('Please select a month');
    return;
  }

  let count = 0;
  AppState.staff.forEach(s => {
    if (s.status === 'active') {
      const exists = AppState.staffSalaryPayments.some(p => String(p.staffId) === String(s.id) && p.month === month);
      if (!exists) {
        const amount = Number(s.salary || 0);
        if (amount > 0) {
          AppState.staffSalaryPayments.push({
            id: 'staff_sal_' + Date.now() + '_' + count++,
            staffId: s.id,
            month: month,
            amount: amount,
            date: todayYYYYMMDD(),
            status: 'paid'
          });
        }
      }
    }
  });

  saveState();
  renderStaffSalaryPayments();
  alert(`Salary processed for ${count} staff members in ${month}`);
}

function processSingleStaffSalary(month, staffId, customAmount) {
  if (!month) {
    alert('Please select a month');
    return;
  }
  if (!staffId) {
    alert('Please select a staff member');
    return;
  }

  const staff = AppState.staff.find(s => String(s.id) === String(staffId));
  if (!staff) {
    alert('Staff member not found');
    return;
  }
  if (staff.status !== 'active') {
    alert('Salary can only be processed for active staff');
    return;
  }

  const exists = AppState.staffSalaryPayments.some(p => String(p.staffId) === String(staff.id) && p.month === month);
  if (exists) {
    alert(`Salary already processed for ${staff.name} in ${month}`);
    return;
  }

  const amount = customAmount > 0 ? customAmount : Number(staff.salary || 0);
  if (amount <= 0) {
    alert('No payable salary amount');
    return;
  }

  AppState.staffSalaryPayments.push({
    id: 'staff_sal_' + Date.now() + '_single',
    staffId: staff.id,
    month: month,
    amount: amount,
    date: todayYYYYMMDD(),
    status: 'paid'
  });

  saveState();
  renderStaffSalaryPayments();
  
  const customInput = qs('#staffSalaryCustomAmount');
  if (customInput) customInput.value = '';
  
  alert(`Salary processed for ${staff.name} (${month}): ${fmtINR(amount)}`);
}

// ---------- Fees View ----------
async function renderFees(){
  const topbarSearchInput = qs('#topbarSearchInput');
  if (!((topbarSearchInput?.value || '').trim())) {
    topbarReceiptSearchQuery = '';
  }

  // Always load the latest fees data from backend whenever we enter this view
  try {
    console.log('[Fees] Loading latest payment and student data...');
    const [allStudents, allPayments] = await Promise.all([
      fetchAllStudents(),
      fetchAllPayments()
    ]);
    
    // Update AppState with students
    if (allStudents && allStudents.length > 0) {
      AppState.students = allStudents.map(s => ({
        id: s.id,
        roll: s.roll_no,
        admission_date: s.admission_date || '',
        aadhar: s.aadhar_number || '',
        name: s.name,
        email: s.email || '',
        phone: s.phone || '',
        class: s.class_name || '',
        section: s.section || '',
        dob: s.date_of_birth || '',
        address: s.address || '',
        father_name: s.father_name || '',
        mother_name: s.mother_name || '',
        status: s.status || 'Active',
        created_at: s.created_at,
        updated_at: s.updated_at
      }));
      console.log('[Fees] Updated students:', AppState.students.length);
    }
    
    // Map payments to receipts
    const normalizedPayments = Array.isArray(allPayments)
      ? allPayments
      : (allPayments && Array.isArray(allPayments.payments) ? allPayments.payments : []);

    if (normalizedPayments.length > 0) {
      const studentById = {};
      AppState.students.forEach(s => { studentById[s.id] = s; });
      const serverReceipts = normalizedPayments.map(p => {
        const student = studentById[p.student_id] || {};
        return {
          id: p.id,
          no: p.id,
          date: p.payment_date,
          roll: p.roll_no || p.roll || student.roll || '',
          name: p.name || student.name || '',
          method: p.payment_method || p.method || '',
          amount: Number(p.amount || 0),
          ref: p.transaction_id || p.ref || '',
          status: p.status || 'completed'
        };
      });
      AppState.receipts = mergeReceipts(serverReceipts);
      saveState();
      console.log('[Fees] Updated receipts:', AppState.receipts.length);
    } else if (await hydrateReceiptsFromBackend()) {
      console.log('[Fees] Hydrated receipts from backend fallback:', AppState.receipts.length);
    } else if (restoreReceiptsFromBackupIfNeeded()) {
      console.log('[Fees] Restored receipts from backup cache:', AppState.receipts.length);
    } else if (!Array.isArray(allPayments)) {
      console.warn('[Fees] Unexpected payments response shape:', allPayments);
    }
  } catch (e) {
    console.warn('[Fees] Failed to load payment data:', e);
    restoreReceiptsFromBackupIfNeeded();
  }

  const isReceptionPanel = getUserRole() === 'admin' && getAdminPanelRole() === 'reception';
  const feesKpiCollectedTitle = qs('#feesKpiCollectedTitle');
  const feesKpiOverdueTitle = qs('#feesKpiOverdueTitle');
  const feesKpiReceiptsTitle = qs('#feesKpiReceiptsTitle');
  const feesKpiOutstandingTitle = qs('#feesKpiOutstandingTitle');
  if (feesKpiCollectedTitle) {
    feesKpiCollectedTitle.textContent = isReceptionPanel ? 'Collected (Today)' : 'Collected (This Month)';
  }
  if (feesKpiOverdueTitle) {
    feesKpiOverdueTitle.textContent = isReceptionPanel ? 'Overdue Students' : 'Overdue (Aging > 30d)';
  }
  if (feesKpiReceiptsTitle) {
    feesKpiReceiptsTitle.textContent = isReceptionPanel ? 'Receipts (Today)' : 'Receipts (This Month)';
  }
  if (feesKpiOutstandingTitle) {
    feesKpiOutstandingTitle.textContent = isReceptionPanel ? 'Due Students' : 'Outstanding (This Month)';
  }
  const feesKpiCollected = qs('#feesKpiCollected');
  if (feesKpiCollected) feesKpiCollected.textContent = fmtINR(isReceptionPanel ? sumReceiptsToday() : sumReceiptsThisMonth());
  const feesKpiCollectedDelta = qs('#feesKpiCollectedDelta');
  if (feesKpiCollectedDelta) {
    if (isReceptionPanel) {
      const breakdown = getTodayMethodBreakdown();
      feesKpiCollectedDelta.textContent = [
        `Cash ${breakdown.cash.count} (${fmtINR(breakdown.cash.amount)})`,
        `Bank ${breakdown.bank.count} (${fmtINR(breakdown.bank.amount)})`,
        `UPI ${breakdown.upi.count} (${fmtINR(breakdown.upi.amount)})`
      ].join(' | ');
    } else {
      feesKpiCollectedDelta.textContent = formatMonthYear(monthOfToday());
    }
  }
  const feesKpiOutstanding = qs('#feesKpiOutstanding');
  const dueStudentsCount = isReceptionPanel
    ? getDueStudentsListExcludingOverdue(3).length
    : countDueStudentsAll();
  if (feesKpiOutstanding) {
    feesKpiOutstanding.textContent = isReceptionPanel
      ? String(dueStudentsCount)
      : fmtINR(sumOutstandingThisMonth());
  }
  const feesKpiOutstandingCount = qs('#feesKpiOutstandingCount');
  if (feesKpiOutstandingCount) {
    feesKpiOutstandingCount.textContent = isReceptionPanel
      ? `${dueStudentsCount} students`
      : `${dueStudentsCount} dues`;
  }
  const feesKpiDueCard = qs('#feesKpiDueCard');
  if (feesKpiDueCard) {
    if (isReceptionPanel) {
      feesKpiDueCard.style.cursor = 'pointer';
      feesKpiDueCard.title = 'Click to view due student names';
      feesKpiDueCard.onclick = () => openReceptionDueStudentsModal();
    } else {
      feesKpiDueCard.style.cursor = '';
      feesKpiDueCard.title = '';
      feesKpiDueCard.onclick = null;
    }
  }
  const overdueSummary = getOverdueSummary();
  const feesKpiOverdue = qs('#feesKpiOverdue');
  if (feesKpiOverdue) {
    feesKpiOverdue.textContent = isReceptionPanel
      ? `${overdueSummary.studentCount} students`
      : fmtINR(overdueSummary.amount);
  }
  const feesKpiOverdueCount = qs('#feesKpiOverdueCount');
  if (feesKpiOverdueCount) feesKpiOverdueCount.textContent = `${overdueSummary.studentCount} students`;
  const feesKpiOverdueCard = qs('#feesKpiOverdueCard');
  if (feesKpiOverdueCard) {
    if (isReceptionPanel) {
      feesKpiOverdueCard.style.cursor = 'pointer';
      feesKpiOverdueCard.title = 'Click to view overdue student names';
      feesKpiOverdueCard.onclick = () => openReceptionOverdueStudentsModal();
    } else {
      feesKpiOverdueCard.style.cursor = '';
      feesKpiOverdueCard.title = '';
      feesKpiOverdueCard.onclick = null;
    }
  }
  const feesKpiReceipts = qs('#feesKpiReceipts');
  if (feesKpiReceipts) feesKpiReceipts.textContent = String(isReceptionPanel ? countReceiptsToday() : countReceiptsThisMonth());
  const feesKpiReceiptsDelta = qs('#feesKpiReceiptsDelta');
  if (feesKpiReceiptsDelta) feesKpiReceiptsDelta.textContent = isReceptionPanel ? 'Today' : formatMonthYear(monthOfToday());

  const feesBtnCollect = qs('#feesBtnCollect');
  if (feesBtnCollect) feesBtnCollect.onclick = ()=> openModal('#modalRecordPayment');
  const feesReceiptLookup = qs('#feesReceiptLookup');
  if (feesReceiptLookup) {
    feesReceiptLookup.onkeydown = (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      findAndOpenReceiptFlow();
    };
  }
  const feesBtnFindReceipt = qs('#feesBtnFindReceipt');
  if (feesBtnFindReceipt) feesBtnFindReceipt.onclick = findAndOpenReceiptFlow;
  const feesBtnExport = qs('#feesBtnExport');
  if (feesBtnExport) feesBtnExport.onclick = exportFeesDuesCSV;
  const feesBtnPrintAllDue = qs('#feesBtnPrintAllDue');
  if (feesBtnPrintAllDue) feesBtnPrintAllDue.onclick = printAllDueReceiptsThermal2Inch;
  const feesBtnPrintAllDueCompact = qs('#feesBtnPrintAllDueCompact');
  if (feesBtnPrintAllDueCompact) feesBtnPrintAllDueCompact.onclick = () => printAllDueReceipts({ ultraCompact: true });
  const feesBtnHeads = qs('#feesBtnHeads');
  if (feesBtnHeads) feesBtnHeads.onclick = ()=> openModal('#modalFeeHeads');
  const feesBtnConcession = qs('#feesBtnConcession');
  if (feesBtnConcession) feesBtnConcession.onclick = ()=> openModal('#modalConcession');
  const feesBtnImport = qs('#feesBtnImport');
  if (feesBtnImport) feesBtnImport.onclick = ()=> openModal('#modalFeesImport');
  const feesBtnAging = qs('#feesBtnAging');
  if (feesBtnAging) feesBtnAging.onclick = ()=> alert('Aging report coming soon.');

  bindFeesFilters();
  renderFeesDuesTable();
  renderRecentReceipts();
}

function getStudentMonthFinancials(student, month){
  const key = `${student.roll}|${month}`;
  const fee = AppState.fees[key] || {};
  const heads = fee.heads || getFeesForStudentMonth(student, month) || {};
  const baseDue = Object.values(heads).reduce((sum, value) => sum + Number(value || 0), 0);
  const paid = Number(fee.paid || 0);
  const discount = Number(fee.discount || 0);
  const lateFee = Number(fee.lateFee || 0);
  const due = Math.max(0, baseDue + lateFee - discount);
  const balance = Math.max(0, due - paid);
  return {
    heads,
    due,
    paid,
    balance,
    discount,
    lateFee,
    lastReceipt: fee.lastReceipt || ''
  };
}

function getStudentStatusForMonth(student, month){
  const financials = getStudentMonthFinancials(student, month);
  const todayMonth = monthOfToday();
  if (financials.balance <= 0) return 'paid';
  if (financials.paid > 0 && financials.balance > 0) return 'partial';
  if (month < todayMonth) return 'overdue';
  return 'due';
}

function bindFeesFilters(){
  const controls = [
    '#feesFilterClass',
    '#feesFilterSection',
    '#feesFilterMonth',
    '#feesFilterStatus',
    '#feesSearch'
  ];

  controls.forEach(sel => {
    const el = qs(sel);
    if (!el) return;
    if (el.dataset.boundFees === '1') return;
    el.dataset.boundFees = '1';

    const trigger = () => {
      AppState.pagination.fees.page = 1;
      renderFeesDuesTable();
    };

    el.addEventListener('change', trigger);
    el.addEventListener('input', trigger);
  });
}

function renderFeesDuesTable(){
  const tbody = qs('#feesBody');
  const pagination = qs('#feesPagination');
  if (!tbody || !pagination) return;

  const fClass = (qs('#feesFilterClass')?.value || '').trim();
  const fSection = (qs('#feesFilterSection')?.value || '').trim();
  const fMonth = (qs('#feesFilterMonth')?.value || '').trim() || monthOfToday();
  const fStatus = (qs('#feesFilterStatus')?.value || '').trim();
  const query = (qs('#feesSearch')?.value || '').trim().toLowerCase();

  const rows = (AppState.students || []).map(student => {
    const financials = getStudentMonthFinancials(student, fMonth);
    const status = getStudentStatusForMonth(student, fMonth);
    const latestReceipt = getLatestReceiptKeyForStudent(student.roll);
    return {
      student,
      month: fMonth,
      heads: financials.heads,
      due: financials.due,
      paid: financials.paid,
      balance: financials.balance,
      status,
      lastReceipt: financials.lastReceipt || latestReceipt || '—'
    };
  }).filter(r => {
    if (fClass && r.student.class !== fClass) return false;
    if (fSection && r.student.section !== fSection) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (query) {
      const text = `${r.student.name} ${r.student.roll} ${r.student.phone || ''}`.toLowerCase();
      if (!text.includes(query)) return false;
    }
    return true;
  }).sort((a, b) => b.balance - a.balance);

  AppState.pagination.fees.filtered = rows;
  const pageSize = AppState.pagination.fees.pageSize || 12;
  AppState.pagination.fees.totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  AppState.pagination.fees.page = Math.min(AppState.pagination.fees.page, AppState.pagination.fees.totalPages);

  const start = (AppState.pagination.fees.page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  tbody.innerHTML = pageRows.map(r => {
    const headSummary = Object.entries(r.heads || {}).map(([head, amt]) => `${head}: ${fmtINR(amt)}`).join(' | ');
    return `
      <tr>
        <td>${r.student.roll}</td>
        <td>${r.student.name}</td>
        <td>${r.student.class}-${r.student.section}</td>
        <td>${r.student.phone || '-'}</td>
        <td>${r.month}</td>
        <td title="${headSummary}">${headSummary || '-'}</td>
        <td>${fmtINR(r.due)}</td>
        <td>${fmtINR(r.paid)}</td>
        <td>${fmtINR(r.balance)}</td>
        <td>${r.lastReceipt}</td>
        <td style="text-align:right;">
          <button class="btn btn-ghost small" data-fee-act="collect" data-roll="${r.student.roll}">Collect</button>
          <button class="btn btn-ghost small" data-fee-act="view-due" data-roll="${r.student.roll}">View</button>
          <button class="btn btn small" data-fee-act="due-receipt" data-roll="${r.student.roll}">Due Receipt</button>
          <button class="btn btn-ghost small" data-fee-act="last-receipt" data-no="${r.lastReceipt !== '—' ? r.lastReceipt : ''}" ${r.lastReceipt === '—' ? 'disabled' : ''}>Last Receipt</button>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="11" class="muted">No records found.</td></tr>';

  qsa('button[data-fee-act="collect"]').forEach(btn => {
    btn.onclick = () => {
      const roll = btn.getAttribute('data-roll');
      const rollInput = qs('#rpRoll');
      if (rollInput) rollInput.value = roll;
      openModal('#modalRecordPayment');
    };
  });

  qsa('button[data-fee-act="due-receipt"]').forEach(btn => {
    btn.onclick = () => {
      const roll = btn.getAttribute('data-roll');
      printDueReceiptForStudent(roll);
    };
  });

  qsa('button[data-fee-act="view-due"]').forEach(btn => {
    btn.onclick = () => {
      const roll = btn.getAttribute('data-roll');
      openDueReceiptPreview(roll);
    };
  });

  qsa('button[data-fee-act="last-receipt"]').forEach(btn => {
    btn.onclick = () => {
      const receiptNo = String(btn.getAttribute('data-no') || '').trim();
      if (!receiptNo) {
        alert('No previous receipt found for this student.');
        return;
      }
      openReceiptPreview(receiptNo);
    };
  });

  pagination.innerHTML = `
    <button class="btn btn-ghost small" ${AppState.pagination.fees.page <= 1 ? 'disabled' : ''} data-fee-pg="prev">◀ Prev</button>
    <span class="muted">Page ${AppState.pagination.fees.page} of ${AppState.pagination.fees.totalPages}</span>
    <button class="btn btn-ghost small" ${AppState.pagination.fees.page >= AppState.pagination.fees.totalPages ? 'disabled' : ''} data-fee-pg="next">Next ▶</button>
  `;

  qsa('button[data-fee-pg]').forEach(btn => {
    btn.onclick = () => {
      const act = btn.getAttribute('data-fee-pg');
      if (act === 'prev' && AppState.pagination.fees.page > 1) AppState.pagination.fees.page -= 1;
      if (act === 'next' && AppState.pagination.fees.page < AppState.pagination.fees.totalPages) AppState.pagination.fees.page += 1;
      renderFeesDuesTable();
    };
  });
}

function printFromRoot(root, cleanupDelay = 800){
  if (!root) return;

  const isThermalBatch = !!root.querySelector('.thermal-batch-root');
  const prevWidth = root.style.width;
  const prevPadding = root.style.padding;

  root.classList.remove('d-none');
  root.style.display = 'block';
  if (isThermalBatch) {
    root.style.width = '58mm';
    root.style.padding = '0';
  }
  root.setAttribute('aria-hidden', 'false');

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    root.style.display = 'none';
    root.style.width = prevWidth;
    root.style.padding = prevPadding;
    root.classList.add('d-none');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '';
  };

  window.addEventListener('afterprint', cleanup, { once: true });

  requestAnimationFrame(() => {
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, cleanupDelay);
    }, 80);
  });
}

function printDueReceiptForStudent(roll){
  const student = (AppState.students || []).find(s => String(s.roll) === String(roll));
  if (!student) {
    alert('Student not found');
    return;
  }

  const summary = calculateTotalUnpaidFees(student);
  const months = (summary.months || []).filter(m => m && m !== '__NO_ADMISSION_DATE__');
  const dueRows = months.map(month => {
    const info = getStudentMonthFinancials(student, month);
    return { month, balance: info.balance };
  }).filter(r => r.balance > 0);

  if ((summary.totalDue || 0) <= 0) {
    alert('No pending due for this student.');
    return;
  }

  const sch = AppState.settings.school || {};
  const printedAt = new Date().toLocaleString(AppState.settings.locale || 'en-IN');

  const root = qs('#receiptPrintRoot');
  if (!root) return;

  root.innerHTML = createDueReceiptBlock(student, summary, dueRows, printedAt);
  printFromRoot(root, 900);
}

function buildDueReceiptText(student, summary, dueRows, printedAt) {
  const monthsText = dueRows.length
    ? dueRows.map(r => `${formatMonthYear(r.month)}: ${fmtINR(r.balance || 0)}`).join(', ')
    : 'None';

  return [
    RECEIPT_SCHOOL_HEADER,
    'Due Fee Receipt',
    `Printed: ${printedAt}`,
    `Student: ${student.name || ''}`,
    `Admission No: ${student.roll || ''}`,
    `Class: ${student.class || ''}-${student.section || ''}`,
    `Total Due: ${fmtINR(summary.totalDue || 0)}`,
    `Due Months: ${monthsText}`
  ].join('\n');
}

function openDueReceiptPreview(roll) {
  const student = (AppState.students || []).find(s => String(s.roll) === String(roll));
  if (!student) {
    alert('Student not found');
    return;
  }

  const summary = calculateTotalUnpaidFees(student);
  const months = (summary.months || []).filter(m => m && m !== '__NO_ADMISSION_DATE__');
  const dueRows = months.map(month => {
    const info = getStudentMonthFinancials(student, month);
    return { month, balance: info.balance };
  }).filter(r => r.balance > 0);

  if ((summary.totalDue || 0) <= 0) {
    alert('No pending due for this student.');
    return;
  }

  const body = qs('#receiptPreviewBody');
  const meta = qs('#receiptPreviewMeta');
  const btnPrint = qs('#receiptPreviewPrint');
  const btnCopy = qs('#receiptPreviewCopy');
  const btnToggleView = qs('#receiptPreviewToggleView');
  const btnPdf = qs('#receiptPreviewPdf');
  const btnThermal = qs('#receiptPreviewThermal');
  const modal = qs('#modalReceiptPreview');

  if (!body || !meta || !btnPrint || !btnCopy || !btnToggleView || !btnPdf || !btnThermal || !modal) return;

  const printedAt = new Date().toLocaleString(AppState.settings.locale || 'en-IN');
  body.innerHTML = createDueReceiptBlock(student, summary, dueRows, printedAt);
  meta.textContent = `Due Receipt · ${student.name} · ${student.roll} · Shortcuts: Ctrl+P Print, Ctrl+C Copy`;

  btnToggleView.textContent = '🧩 Compact View';
  btnToggleView.disabled = true;
  btnPdf.disabled = true;
  btnThermal.disabled = true;

  btnPrint.onclick = () => printDueReceiptForStudent(student.roll);
  btnCopy.onclick = async () => {
    const oldText = btnCopy.textContent;
    try {
      await navigator.clipboard.writeText(buildDueReceiptText(student, summary, dueRows, printedAt));
      btnCopy.textContent = '✅ Copied';
      setTimeout(() => { btnCopy.textContent = oldText; }, 1200);
    } catch {
      alert('Could not copy due receipt. Please try again.');
    }
  };

  const keyHandler = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = String(e.key || '').toLowerCase();
    if (key === 'p') {
      e.preventDefault();
      btnPrint.click();
    } else if (key === 'c') {
      e.preventDefault();
      btnCopy.click();
    }
  };

  modal.addEventListener('close', () => {
    document.removeEventListener('keydown', keyHandler);
  }, { once: true });
  document.addEventListener('keydown', keyHandler);

  openModal('#modalReceiptPreview');
}

function createDueReceiptBlock(student, summary, dueRows, printedAt){
  const sch = AppState.settings.school || {};
  const addressLine = [sch.address, sch.phone, sch.email].filter(Boolean).join(' · ');
  const parts = getDueFeeComponents(student, dueRows);
  return `
    <div class="receipt-paper receipt-paper--due">
      <div class="receipt-school">
        <h2>${RECEIPT_SCHOOL_HEADER}</h2>
        ${sch.tagline ? `<div class="muted">${sch.tagline}</div>` : ''}
        ${addressLine ? `<div class="muted">${addressLine}</div>` : ''}
      </div>
      <hr />
      <div class="due-title-row">
        <h3 class="due-title">Fee Due Receipt</h3>
        <span class="due-badge">Outstanding</span>
      </div>

      <div class="due-meta-grid">
        <div class="receipt-row"><span><strong>Student</strong></span><span>${student.name}</span></div>
        <div class="receipt-row"><span><strong>Admission No.</strong></span><span>${student.roll}</span></div>
        <div class="receipt-row"><span><strong>Class</strong></span><span>${student.class}-${student.section}</span></div>
        <div class="receipt-row"><span><strong>Generated At</strong></span><span>${printedAt}</span></div>
      </div>

      <div class="due-amount-grid">
        <div class="due-amount-card">
          <span class="muted">Due Tuition Fee</span>
          <strong>${fmtINR(parts.dueTuitionFee)}</strong>
        </div>
        <div class="due-amount-card">
          <span class="muted">Late Fee</span>
          <strong>${fmtINR(parts.lateFee)}</strong>
        </div>
      </div>

      <div class="receipt-total"><span>Total Outstanding</span><span>${fmtINR(summary.totalDue || 0)}</span></div>

      <div class="due-table-wrap">
        <strong>Month-wise Due</strong>
        <table class="due-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Due Amount</th>
            </tr>
          </thead>
          <tbody>
            ${dueRows.map(r => `<tr><td>${formatMonthYear(r.month)}</td><td>${fmtINR(r.balance)}</td></tr>`).join('') || '<tr><td colspan="2">No pending dues.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="muted mt-12">Please clear dues by due date to avoid late fee.</div>
    </div>
  `;
}

function getDueFeeComponents(student, dueRows){
  let dueTuitionFee = 0;
  let lateFee = 0;

  (dueRows || []).forEach(row => {
    const info = getStudentMonthFinancials(student, row.month);
    const monthBalance = Number(row.balance || 0);
    if (monthBalance <= 0) return;

    const tuition = Number(info.heads?.Tuition || 0);
    const monthLate = Number(info.lateFee || 0);
    const componentTotal = tuition + monthLate;

    if (componentTotal > 0) {
      const ratio = Math.min(1, monthBalance / componentTotal);
      dueTuitionFee += tuition * ratio;
      lateFee += monthLate * ratio;
    } else {
      dueTuitionFee += monthBalance;
    }
  });

  return {
    dueTuitionFee: Math.max(0, Number(dueTuitionFee.toFixed(2))),
    lateFee: Math.max(0, Number(lateFee.toFixed(2)))
  };
}

function createCompactDueReceiptCard(student, summary, dueRows, options = {}){
  const { ultraCompact = false } = options;
  const parts = getDueFeeComponents(student, dueRows);
  const duePreview = dueRows.slice(0, 3).map(r => `${formatMonthYear(r.month)}: ${fmtINR(r.balance)}`).join(' • ');
  const cardClass = ultraCompact ? 'due-compact-card due-compact-card--ultra' : 'due-compact-card';
  const bodyClass = ultraCompact ? 'due-compact-body due-compact-body--ultra' : 'due-compact-body';
  const monthsClass = ultraCompact ? 'due-compact-months due-compact-months--ultra' : 'due-compact-months';
  return `
    <div class="${cardClass}">
      <div class="due-compact-school">${RECEIPT_SCHOOL_HEADER}</div>
      <div class="due-compact-title">DUE TUITION FEE RECEIPT</div>
      <div class="${bodyClass}">
        <div><strong>Student:</strong> ${student.name}</div>
        <div><strong>Admission No:</strong> ${student.roll}</div>
        <div><strong>Class:</strong> ${student.class}-${student.section}</div>
        <div><strong>Due Tuition Fee:</strong> ${fmtINR(parts.dueTuitionFee)}</div>
        <div><strong>Late Fee:</strong> ${fmtINR(parts.lateFee)}</div>
        <div><strong>Total Due:</strong> ${fmtINR(summary.totalDue || 0)}</div>
      </div>
      <div class="${monthsClass}">
        ${duePreview || 'No month-wise due'}
      </div>
    </div>
  `;
}

function getFilteredDueStudentsFromFeesFilters(){
  const selectedClass = (qs('#feesFilterClass')?.value || '').trim();
  const selectedSection = (qs('#feesFilterSection')?.value || '').trim();
  const searchQuery = (qs('#feesSearch')?.value || '').trim().toLowerCase();

  const filteredStudents = (AppState.students || []).filter(student => {
    if (selectedClass && student.class !== selectedClass) return false;
    if (selectedSection && student.section !== selectedSection) return false;
    if (searchQuery) {
      const haystack = `${student.name || ''} ${student.roll || ''} ${student.phone || ''}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  });

  return filteredStudents.map(student => {
    const summary = calculateTotalUnpaidFees(student);
    const months = (summary.months || []).filter(m => m && m !== '__NO_ADMISSION_DATE__');
    const dueRows = months.map(month => {
      const info = getStudentMonthFinancials(student, month);
      return { month, balance: info.balance };
    }).filter(r => r.balance > 0);
    return { student, summary, dueRows };
  }).filter(item => (item.summary.totalDue || 0) > 0);
}

function createThermalDueReceiptCard(student, summary, dueRows, printedAt){
  const parts = getDueFeeComponents(student, dueRows);
  const monthsText = dueRows.length
    ? dueRows.map(r => `${formatMonthYear(r.month)}: ${fmtINR(r.balance || 0)}`).join(' | ')
    : 'No month-wise due';

  return `
    <div class="thermal-due-ticket">
      <div class="thermal-ticket-school">${escapedText(RECEIPT_SCHOOL_HEADER)}</div>
      <div class="thermal-ticket-title">DUE FEE RECEIPT</div>
      <div class="thermal-ticket-line"></div>
      <div class="thermal-ticket-row"><span>Printed</span><span>${escapedText(printedAt)}</span></div>
      <div class="thermal-ticket-row"><span>Student</span><span>${escapedText(student.name || '')}</span></div>
      <div class="thermal-ticket-row"><span>Adm No</span><span>${escapedText(String(student.roll || ''))}</span></div>
      <div class="thermal-ticket-row"><span>Class</span><span>${escapedText(`${student.class || ''}-${student.section || ''}`)}</span></div>
      <div class="thermal-ticket-row"><span>Due Tuition</span><span>${fmtINR(parts.dueTuitionFee || 0)}</span></div>
      <div class="thermal-ticket-row"><span>Late Fee</span><span>${fmtINR(parts.lateFee || 0)}</span></div>
      <div class="thermal-ticket-row thermal-ticket-total"><span>Total Due</span><span>${fmtINR(summary.totalDue || 0)}</span></div>
      <div class="thermal-ticket-line"></div>
      <div class="thermal-ticket-months">${escapedText(monthsText)}</div>
    </div>
  `;
}

function printAllDueReceiptsThermal2Inch(){
  const dueStudents = getFilteredDueStudentsFromFeesFilters();

  if (dueStudents.length === 0) {
    alert('No due fee found for students in current filters (Class/Section/Search).');
    return;
  }

  const printedAt = new Date().toLocaleString(AppState.settings.locale || 'en-IN');
  const root = qs('#receiptPrintRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="thermal-batch-root">
      ${dueStudents.map(item => createThermalDueReceiptCard(item.student, item.summary, item.dueRows, printedAt)).join('')}
    </div>
  `;

  printFromRoot(root, 1500);
}

function printAllDueReceipts(options = {}){
  const { ultraCompact = false } = options;
  const printedAt = new Date().toLocaleString(AppState.settings.locale || 'en-IN');
  const dueStudents = getFilteredDueStudentsFromFeesFilters();

  if (dueStudents.length === 0) {
    alert('No due fee found for students in current filters (Class/Section/Search).');
    return;
  }

  const root = qs('#receiptPrintRoot');
  if (!root) return;

  const pages = [];
  for (let i = 0; i < dueStudents.length; i += 4) {
    pages.push(dueStudents.slice(i, i + 4));
  }

  root.innerHTML = `
    ${pages.map((page, pageIndex) => `
      <div class="bulk-due-page" style="page-break-after:${pageIndex < pages.length - 1 ? 'always' : 'auto'};">
        <div class="bulk-due-headline">${RECEIPT_SCHOOL_HEADER}</div>
        ${ultraCompact ? '<div class="bulk-due-mode">Ultra-Compact Layout</div>' : ''}
        <div class="bulk-due-generated">Generated: ${printedAt}</div>
        <div class="bulk-due-grid ${ultraCompact ? 'bulk-due-grid--ultra' : ''}">
          ${page.map(item => createCompactDueReceiptCard(item.student, item.summary, item.dueRows, { ultraCompact })).join('')}
          ${Array.from({ length: Math.max(0, 4 - page.length) }).map(() => '<div></div>').join('')}
        </div>
      </div>
    `).join('')}
  `;
  printFromRoot(root, 1200);
}

function exportFeesDuesCSV(){
  const rows = AppState.pagination?.fees?.filtered || [];
  const header = ['Admission No', 'Name', 'Class', 'Phone', 'Month', 'Due', 'Paid', 'Balance', 'Status'];
  const data = rows.map(r => [
    r.student.roll,
    r.student.name,
    `${r.student.class}-${r.student.section}`,
    r.student.phone || '',
    r.month,
    r.due,
    r.paid,
    r.balance,
    r.status
  ]);
  const csv = arrayToCSV([header, ...data]);
  downloadFile(`fees_dues_${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

function loadDemoReceiptData(){
  const existingDemoCount = (AppState.receipts || []).filter(r => r?.__demoReceipt === true || String(r?.no || '').startsWith('DEMO-R-')).length;
  if (existingDemoCount > 0) {
    const replace = confirm(`Demo receipts already loaded (${existingDemoCount}). Replace with fresh demo data?`);
    if (!replace) return;
    clearDemoReceiptData({ silent: true });
  }

  const now = new Date();
  const currentMonth = monthOfToday();
  const baseNo = `DEMO-R-${Date.now()}`;

  const samples = [
    { roll: 'DEMO-001', name: 'Aarav Kumar', method: 'Cash', amount: 3200, discount: 100, late_fee: 0, ref: 'DEMO-CASH-01' },
    { roll: 'DEMO-002', name: 'Anaya Singh', method: 'UPI', amount: 2850, discount: 0, late_fee: 50, ref: 'DEMO-UPI-02' },
    { roll: 'DEMO-003', name: 'Rohan Verma', method: 'Card', amount: 4100, discount: 200, late_fee: 0, ref: 'DEMO-CARD-03' },
    { roll: 'DEMO-004', name: 'Priya Sharma', method: 'Bank Transfer', amount: 3500, discount: 0, late_fee: 75, ref: 'DEMO-BANK-04' },
    { roll: 'DEMO-005', name: 'Kabir Ali', method: 'Cash', amount: 2600, discount: 50, late_fee: 0, ref: 'DEMO-CASH-05' }
  ];

  const demoReceipts = samples.map((sample, index) => {
    const d = new Date(now);
    d.setDate(Math.max(1, now.getDate() - index));
    const date = d.toISOString().slice(0, 10);
    return {
      no: `${baseNo}-${index + 1}`,
      date,
      roll: sample.roll,
      name: sample.name,
      method: sample.method,
      amount: Number(sample.amount || 0),
      discount: Number(sample.discount || 0),
      late_fee: Number(sample.late_fee || 0),
      ref: sample.ref,
      months: [currentMonth],
      status: 'completed',
      synced: false,
      __demoReceipt: true
    };
  });

  AppState.receipts = [...(AppState.receipts || []), ...demoReceipts];
  saveState();

  const feesKpiCollected = qs('#feesKpiCollected');
  const isReceptionPanel = getUserRole() === 'admin' && getAdminPanelRole() === 'reception';
  if (feesKpiCollected) {
    feesKpiCollected.textContent = fmtINR(isReceptionPanel ? sumReceiptsToday() : sumReceiptsThisMonth());
  }
  const feesKpiOutstanding = qs('#feesKpiOutstanding');
  const dueStudentsCount = isReceptionPanel
    ? getDueStudentsListExcludingOverdue(3).length
    : countDueStudentsAll();
  if (feesKpiOutstanding) {
    feesKpiOutstanding.textContent = isReceptionPanel
      ? String(dueStudentsCount)
      : fmtINR(sumOutstandingThisMonth());
  }
  const feesKpiOutstandingCount = qs('#feesKpiOutstandingCount');
  if (feesKpiOutstandingCount) {
    feesKpiOutstandingCount.textContent = isReceptionPanel
      ? `${dueStudentsCount} students`
      : `${dueStudentsCount} dues`;
  }
  const overdueSummary = getOverdueSummary();
  const feesKpiOverdue = qs('#feesKpiOverdue');
  if (feesKpiOverdue) {
    feesKpiOverdue.textContent = isReceptionPanel
      ? `${overdueSummary.studentCount} students`
      : fmtINR(overdueSummary.amount);
  }
  const feesKpiOverdueCount = qs('#feesKpiOverdueCount');
  if (feesKpiOverdueCount) feesKpiOverdueCount.textContent = `${overdueSummary.studentCount} students`;
  const feesKpiReceipts = qs('#feesKpiReceipts');
  if (feesKpiReceipts) feesKpiReceipts.textContent = String(isReceptionPanel ? countReceiptsToday() : countReceiptsThisMonth());

  renderRecentReceipts();
  alert(`Loaded ${demoReceipts.length} demo receipts. You can remove them anytime using "Clear Demo".`);
}

function clearDemoReceiptData(options = {}){
  const { silent = false } = options;
  const beforeReceipts = (AppState.receipts || []).length;

  AppState.receipts = (AppState.receipts || []).filter(r => !(r?.__demoReceipt === true || String(r?.no || '').startsWith('DEMO-R-')));

  const demoRolls = new Set(
    (AppState.students || [])
      .filter(s => s?.__demo === true || /^DEMO-/.test(String(s?.roll || '')))
      .map(s => String(s.roll))
  );

  if (demoRolls.size > 0) {
    AppState.students = (AppState.students || []).filter(s => !demoRolls.has(String(s.roll)));
    Object.keys(AppState.fees || {}).forEach(key => {
      const roll = String(key).split('|')[0];
      if (demoRolls.has(roll)) delete AppState.fees[key];
    });
  }

  Object.keys(AppState.fees || {}).forEach(key => {
    if (String(key).startsWith('DEMO-')) delete AppState.fees[key];
  });

  const removedReceipts = beforeReceipts - (AppState.receipts || []).length;
  saveState();

  const feesKpiCollected = qs('#feesKpiCollected');
  const isReceptionPanel = getUserRole() === 'admin' && getAdminPanelRole() === 'reception';
  if (feesKpiCollected) {
    feesKpiCollected.textContent = fmtINR(isReceptionPanel ? sumReceiptsToday() : sumReceiptsThisMonth());
  }
  const feesKpiOutstanding = qs('#feesKpiOutstanding');
  const dueStudentsCount = isReceptionPanel
    ? getDueStudentsListExcludingOverdue(3).length
    : countDueStudentsAll();
  if (feesKpiOutstanding) {
    feesKpiOutstanding.textContent = isReceptionPanel
      ? String(dueStudentsCount)
      : fmtINR(sumOutstandingThisMonth());
  }
  const feesKpiOutstandingCount = qs('#feesKpiOutstandingCount');
  if (feesKpiOutstandingCount) {
    feesKpiOutstandingCount.textContent = isReceptionPanel
      ? `${dueStudentsCount} students`
      : `${dueStudentsCount} dues`;
  }
  const overdueSummary = getOverdueSummary();
  const feesKpiOverdue = qs('#feesKpiOverdue');
  if (feesKpiOverdue) {
    feesKpiOverdue.textContent = isReceptionPanel
      ? `${overdueSummary.studentCount} students`
      : fmtINR(overdueSummary.amount);
  }
  const feesKpiOverdueCount = qs('#feesKpiOverdueCount');
  if (feesKpiOverdueCount) feesKpiOverdueCount.textContent = `${overdueSummary.studentCount} students`;
  const feesKpiReceipts = qs('#feesKpiReceipts');
  if (feesKpiReceipts) feesKpiReceipts.textContent = String(isReceptionPanel ? countReceiptsToday() : countReceiptsThisMonth());

  renderFeesDuesTable();
  renderRecentReceipts();

  if (!silent) {
    if (removedReceipts > 0) {
      alert(`Cleared ${removedReceipts} demo receipts.`);
    } else {
      alert('No demo receipts found to clear.');
    }
  }
}

function sumReceiptsThisMonth(){
  const m=monthOfToday();
  return AppState.receipts.filter(r=> {
      if ((r.date||'').slice(0,7)!==m) return false;
      const st = String(r.status||'completed').toLowerCase();
      return st === 'completed';
    })
    .reduce((sum,r)=> sum+Number(r.amount||0),0);
}
function sumReceiptsToday(){
  const todayReceipts = getCompletedReceiptsForDate(todayYYYYMMDD());
  return todayReceipts.reduce((sum,r)=> sum+Number(r.amount||0),0);
}

function getCompletedReceiptsForDate(dateYMD){
  return AppState.receipts.filter(r=> {
      if ((r.date||'').slice(0,10)!==dateYMD) return false;
      const st = String(r.status||'completed').toLowerCase();
      return st === 'completed';
    });
}

function getTodayMethodBreakdown(){
  const buckets = {
    cash: { count: 0, amount: 0 },
    bank: { count: 0, amount: 0 },
    upi: { count: 0, amount: 0 }
  };

  const todayReceipts = getCompletedReceiptsForDate(todayYYYYMMDD());
  todayReceipts.forEach((r) => {
    const amount = Number(r.amount || 0);
    const method = String(r.method || '').toLowerCase();

    let key = 'bank';
    if (method.includes('upi')) key = 'upi';
    else if (method.includes('cash')) key = 'cash';
    else if (
      method.includes('bank') ||
      method.includes('transfer') ||
      method.includes('neft') ||
      method.includes('rtgs') ||
      method.includes('imps') ||
      method.includes('card')
    ) key = 'bank';

    buckets[key].count += 1;
    buckets[key].amount += amount;
  });

  return buckets;
}
function countReceiptsThisMonth(){
  const m=monthOfToday();
  return AppState.receipts.filter(r=> {
      if ((r.date||'').slice(0,7)!==m) return false;
      const st = String(r.status||'completed').toLowerCase();
      return st === 'completed';
    }).length;
}
function countReceiptsToday(){
  return getCompletedReceiptsForDate(todayYYYYMMDD()).length;
}
function sumOutstandingThisMonth(){
  const m=monthOfToday();
  let totalDue=0,totalPaid=0,totalDiscount=0,totalLate=0;
  // iterate all students and compute expected due using admission_date
  AppState.students.forEach(student=>{
    const heads = getFeesForStudentMonth(student, m) || {};
    const due = Object.values(heads).reduce((a,b)=> a+Number(b||0),0);
    totalDue += due;
    const key = `${student.roll}|${m}`;
    const v = AppState.fees[key] || {};
    totalPaid += Number(v.paid||0);
    totalDiscount += Number(v.discount||0);
    totalLate += Number(v.lateFee||0);
  });
  return Math.max(0, totalDue+totalLate-totalDiscount-totalPaid);
}

function getOverdueStudentsList(minOverdueMonths = 3){
  const m = monthOfToday();
  return (AppState.students || []).map(student => {
    let overdueMonths = 0;
    let overdueAmount = 0;

    const start = student.admission_date ? String(student.admission_date).slice(0, 7) : null;
    if (!start) {
      return { student, overdueMonths: 0, overdueAmount: 0 };
    }

    const months = genMonthsBetween(start, m);
    months.forEach(month => {
      if (month >= m) return;
      const heads = getFeesForStudentMonth(student, month) || {};
      const due = Object.values(heads).reduce((a, b) => a + Number(b || 0), 0);
      const key = `${student.roll}|${month}`;
      const v = AppState.fees[key] || {};
      const paid = Number(v.paid || 0);
      const discount = Number(v.discount || 0);
      const lateFee = Number(v.lateFee || 0);
      const bal = Math.max(0, due + lateFee - discount - paid);
      if (bal > 0) {
        overdueMonths += 1;
        overdueAmount += bal;
      }
    });

    return { student, overdueMonths, overdueAmount };
  })
    .filter(item => item.overdueMonths >= minOverdueMonths)
    .sort((a, b) => (b.overdueMonths - a.overdueMonths) || (b.overdueAmount - a.overdueAmount));
}

function getOverdueSummary(){
  const m=monthOfToday();
  let total=0;
  const overdueStudents = getOverdueStudentsList(3);
  const studentCount = overdueStudents.length;
  AppState.students.forEach(student=>{
    // determine starting month
    let start = student.admission_date ? student.admission_date.slice(0,7) : null;
    if(!start) return; // no admission info
    const months = genMonthsBetween(start, m);
    months.forEach(month=>{
      if(month>=m) return;
      const heads = getFeesForStudentMonth(student, month) || {};
      const due = Object.values(heads).reduce((a,b)=> a+Number(b||0),0);
      const key = `${student.roll}|${month}`;
      const v = AppState.fees[key] || {};
      const paid = Number(v.paid||0);
      const discount = Number(v.discount||0);
      const lateFee = Number(v.lateFee||0);
      const bal = Math.max(0, due + lateFee - discount - paid);
      total += bal;
    });
  });
  return { amount: total, studentCount };
}

function sumOverdue(){
  return getOverdueSummary().amount;
}

function countOverdueStudents(){
  return getOverdueSummary().studentCount;
}

function countDueStudentsAll(){
  return (AppState.students || []).reduce((count, student) => {
    const summary = calculateTotalUnpaidFees(student);
    return count + (Number(summary?.totalDue || 0) > 0 ? 1 : 0);
  }, 0);
}

function getDueStudentsListExcludingOverdue(minOverdueMonths = 3){
  const m = monthOfToday();
  return (AppState.students || []).map(student => {
    const summary = calculateTotalUnpaidFees(student);
    const totalDue = Number(summary?.totalDue || 0);
    let overdueMonths = 0;

    const start = student.admission_date ? String(student.admission_date).slice(0, 7) : null;
    if (start) {
      const months = genMonthsBetween(start, m);
      months.forEach(month => {
        if (month >= m) return;
        const heads = getFeesForStudentMonth(student, month) || {};
        const due = Object.values(heads).reduce((a, b) => a + Number(b || 0), 0);
        const key = `${student.roll}|${month}`;
        const v = AppState.fees[key] || {};
        const paid = Number(v.paid || 0);
        const discount = Number(v.discount || 0);
        const lateFee = Number(v.lateFee || 0);
        const bal = Math.max(0, due + lateFee - discount - paid);
        if (bal > 0) overdueMonths += 1;
      });
    }

    return {
      student,
      totalDue,
      dueMonths: Number(summary?.unpaidMonths || 0),
      overdueMonths
    };
  })
    .filter(item => item.totalDue > 0 && item.overdueMonths < minOverdueMonths)
    .sort((a, b) => b.totalDue - a.totalDue);
}

function openReceptionDueStudentsModal(){
  const body = qs('#dueStudentsBody');
  const meta = qs('#dueStudentsMeta');
  if (!body || !meta) return;

  const rows = getDueStudentsListExcludingOverdue(3);
  meta.textContent = rows.length
    ? `${rows.length} due students found (excluding overdue list).`
    : 'No due students found after excluding overdue list.';

  body.innerHTML = rows.length
    ? rows.map(item => `
      <tr>
        <td>${item.student.roll || '-'}</td>
        <td>${item.student.name || '-'}</td>
        <td>${item.student.class || '-'}-${item.student.section || '-'}</td>
        <td>${item.dueMonths}</td>
        <td>${fmtINR(item.totalDue || 0)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted">No due students for this rule.</td></tr>';

  openModal('#modalDueStudents');
}

function openReceptionOverdueStudentsModal(){
  const body = qs('#overdueStudentsBody');
  const meta = qs('#overdueStudentsMeta');
  if (!body || !meta) return;

  const rows = getOverdueStudentsList(3);
  meta.textContent = rows.length
    ? `${rows.length} students found with fee due in more than 2 months.`
    : 'No students found with fee due in more than 2 months.';

  body.innerHTML = rows.length
    ? rows.map(item => `
      <tr>
        <td>${item.student.roll || '-'}</td>
        <td>${item.student.name || '-'}</td>
        <td>${item.student.class || '-'}-${item.student.section || '-'}</td>
        <td>${item.overdueMonths}</td>
        <td>${fmtINR(item.overdueAmount || 0)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted">No overdue student records for this rule.</td></tr>';

  openModal('#modalOverdueStudents');
}

async function renderRecentReceipts(){
  restoreReceiptsFromBackupIfNeeded();

  const hasReceiptsBeforeRender = Array.isArray(AppState.receipts) && AppState.receipts.length > 0;
  if (!hasReceiptsBeforeRender) {
    await hydrateReceiptsFromBackend();
    restoreReceiptsFromBackupIfNeeded();
  }

  const tbody=qs('#feesReceiptsBody');
  if (!tbody) return;
  const query = (topbarReceiptSearchQuery || '').trim();
  const safeReceipts = Array.isArray(AppState.receipts) ? AppState.receipts : [];
  const allRows = [...safeReceipts].sort((a,b)=> String(b?.date || '').localeCompare(String(a?.date || '')));
  const matchedRows = query
    ? allRows
      .filter(r => `${getReceiptKey(r)} ${r.date || ''} ${r.roll || ''} ${r.name || ''} ${r.method || ''} ${r.ref || ''}`.toLowerCase().includes(query))
    : allRows;
  const rows = (query && matchedRows.length === 0) ? allRows : matchedRows;
  tbody.innerHTML=rows.map(r=> `
    <tr>
      <td>${getReceiptKey(r)}</td>
      <td>${r.date}</td>
      <td>${r.roll}</td>
      <td>${r.name}</td>
      <td>${r.method}</td>
      <td>${fmtINR(r.amount)}</td>
      <td>${fmtINR(r.discount||0)}</td>
      <td>${fmtINR(r.late_fee||0)}</td>
      <td style="text-align:right;">
        <button class="btn btn-ghost small" data-act="view" data-no="${getReceiptKey(r)}">👁️ View</button>
        <button class="btn btn-ghost small" data-act="print" data-no="${getReceiptKey(r)}">🖨️ Print</button>
        <button class="btn btn-ghost small" data-act="pdf" data-no="${getReceiptKey(r)}" title="Download as PDF">📄 PDF</button>
      </td>
    </tr>
  `).join('');

  if (!query && rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="muted">No receipts available yet.</td></tr>';
  } else if (query && matchedRows.length === 0 && allRows.length > 0) {
    tbody.innerHTML += `<tr><td colspan="9" class="muted">No exact match for "${query}". Showing all receipts.</td></tr>`;
  } else if (query && rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="muted">No receipts found for "${query}"</td></tr>`;
  }

  qsa('button[data-act="view"]').forEach(b=>{
    b.onclick=()=> openReceiptPreview(b.getAttribute('data-no'));
  });
  qsa('button[data-act="print"]').forEach(b=>{
    b.onclick=()=> printReceipt(b.getAttribute('data-no'));
  });
  qsa('button[data-act="pdf"]').forEach(b=>{
    b.onclick=()=> generateReceiptPDF(b.getAttribute('data-no'));
  });
  const feesBtnReceiptsExport = qs('#feesBtnReceiptsExport');
  if (feesBtnReceiptsExport) feesBtnReceiptsExport.onclick = exportReceiptsCSV;
}

function getReceiptKey(receipt) {
  if (receipt == null) return '';
  if (receipt.no !== undefined && receipt.no !== null && String(receipt.no).trim() !== '') {
    return String(receipt.no);
  }
  if (receipt.id !== undefined && receipt.id !== null && String(receipt.id).trim() !== '') {
    return String(receipt.id);
  }
  if (receipt.receipt_no !== undefined && receipt.receipt_no !== null && String(receipt.receipt_no).trim() !== '') {
    return String(receipt.receipt_no);
  }
  if (receipt.payment_id !== undefined && receipt.payment_id !== null && String(receipt.payment_id).trim() !== '') {
    return String(receipt.payment_id);
  }
  if (receipt.ref !== undefined && receipt.ref !== null && String(receipt.ref).trim() !== '') {
    return String(receipt.ref);
  }
  if (receipt.transaction_id !== undefined && receipt.transaction_id !== null && String(receipt.transaction_id).trim() !== '') {
    return String(receipt.transaction_id);
  }
  const composite = [receipt.date || '', receipt.roll || '', receipt.amount || 0, receipt.method || ''].join('|').trim();
  return composite || '';
}

function getLatestReceiptKeyForStudent(roll) {
  const normalizedRoll = String(roll ?? '').trim();
  if (!normalizedRoll) return '';

  const candidate = [...(AppState.receipts || [])]
    .filter(r => String(r?.roll ?? '').trim() === normalizedRoll)
    .sort((a, b) => (String(b?.date || '')).localeCompare(String(a?.date || '')))[0];

  return candidate ? getReceiptKey(candidate) : '';
}

function findAndOpenReceiptFlow(rawQuery = null) {
  const input = qs('#feesReceiptLookup');
  const query = String(rawQuery ?? input?.value ?? '').trim();
  if (!query) {
    if (input) input.focus();
    alert('Enter Receipt No or Admission No.');
    return;
  }

  const byReceipt = findReceiptByKey(query);
  if (byReceipt) {
    openReceiptPreview(getReceiptKey(byReceipt));
    if (input) input.value = '';
    return;
  }

  const latestForStudent = getLatestReceiptKeyForStudent(query);
  if (latestForStudent) {
    openReceiptPreview(latestForStudent);
    if (input) input.value = '';
    return;
  }

  alert('No receipt found. Try exact Receipt No or Admission No.');
}

function findReceiptByKey(key) {
  const normalized = String(key ?? '').trim();
  if (!normalized) return null;
  const safeReceipts = Array.isArray(AppState.receipts) ? AppState.receipts : [];
  return safeReceipts.find(r => {
    const directKey = getReceiptKey(r);
    if (normalized === String(directKey || '').trim()) return true;

    const noKey = r?.no !== undefined && r?.no !== null ? String(r.no).trim() : '';
    const idKey = r?.id !== undefined && r?.id !== null ? String(r.id).trim() : '';
    const receiptNoKey = r?.receipt_no !== undefined && r?.receipt_no !== null ? String(r.receipt_no).trim() : '';
    const paymentIdKey = r?.payment_id !== undefined && r?.payment_id !== null ? String(r.payment_id).trim() : '';
    const refKey = r?.ref !== undefined && r?.ref !== null ? String(r.ref).trim() : '';
    const txnKey = r?.transaction_id !== undefined && r?.transaction_id !== null ? String(r.transaction_id).trim() : '';

    return normalized === noKey
      || normalized === idKey
      || normalized === receiptNoKey
      || normalized === paymentIdKey
      || normalized === refKey
      || normalized === txnKey;
  }) || null;
}

function getDueMonthsByRoll(roll) {
  const student = (AppState.students || []).find(s => String(s.roll) === String(roll));
  if (!student) return [];

  const summary = calculateTotalUnpaidFees(student);
  const months = (summary.months || []).filter(m => m && m !== '__NO_ADMISSION_DATE__');

  return months.filter(month => {
    const info = getStudentMonthFinancials(student, month);
    return Number(info.balance || 0) > 0;
  });
}

function buildReceiptHTML(r, opts = {}) {
  const compact = !!opts.compact;
  const receiptNo = getReceiptKey(r);
  const sch = AppState.settings.school || {};
  const tagline = sch.tagline || '';
  const addressLine = [sch.address, sch.phone, sch.email].filter(Boolean).join(' · ');
  const dueMonths = getDueMonthsByRoll(r.roll);
  const dueMonthsText = dueMonths.map(formatMonthYear).join(', ');

  return `
    <div class="receipt-paper ${compact ? 'receipt-paper--compact' : ''}">
      <div class="receipt-school">
        <h2>${RECEIPT_SCHOOL_HEADER}</h2>
        ${tagline ? `<div class="muted">${tagline}</div>` : ''}
        ${addressLine ? `<div class="muted">${addressLine}</div>` : ''}
      </div>
      <hr />
      <div class="receipt-row"><span><strong>Receipt No.</strong></span><span>${receiptNo}</span></div>
      <div class="receipt-row"><span><strong>Date</strong></span><span>${r.date}</span></div>
      <div class="receipt-row"><span><strong>Student</strong></span><span>${r.name}</span></div>
      <div class="receipt-row"><span><strong>Admission No.</strong></span><span>${r.roll}</span></div>
      <div class="receipt-row"><span><strong>Payment Method</strong></span><span>${r.method} ${r.ref ? `(${r.ref})` : ''}</span></div>
      ${r.months?.length ? `<div class="receipt-row receipt-row--optional"><span><strong>Months</strong></span><span>${r.months.map(formatMonthYear).join(', ')}</span></div>` : ''}
      <div class="receipt-row receipt-row--optional"><span><strong>Discount</strong></span><span>${fmtINR(r.discount || 0)}</span></div>
      <div class="receipt-row receipt-row--optional"><span><strong>Late Fee</strong></span><span>${fmtINR(r.late_fee || 0)}</span></div>
      ${r.previousUnpaid ? `<div class="receipt-row receipt-row--optional"><span><strong>Previous Unpaid</strong></span><span>${fmtINR(r.previousUnpaid)}</span></div>` : ''}
      <div class="receipt-total"><span>Total Paid</span><span>${fmtINR(r.amount || 0)}</span></div>
      ${dueMonths.length ? `<div class="receipt-row receipt-row--optional"><span><strong>Due Months</strong></span><span>${dueMonthsText}</span></div>` : '<div class="receipt-row receipt-row--optional"><span><strong>Due Months</strong></span><span>None</span></div>'}
      <div class="muted mt-12 receipt-note">This is a system-generated receipt.</div>
    </div>
  `;
}

function buildReceiptText(r) {
  const receiptNo = getReceiptKey(r);
  const dueMonths = getDueMonthsByRoll(r.roll);
  const dueMonthsText = dueMonths.length ? dueMonths.map(formatMonthYear).join(', ') : 'None';
  return [
    RECEIPT_SCHOOL_HEADER,
    `Receipt No: ${receiptNo}`,
    `Date: ${r.date}`,
    `Student: ${r.name}`,
    `Admission No: ${r.roll}`,
    `Payment Method: ${r.method}${r.ref ? ` (${r.ref})` : ''}`,
    `Total Paid: ${fmtINR(r.amount || 0)}`,
    `Due Months: ${dueMonthsText}`
  ].join('\n');
}

function openReceiptPreview(no) {
  const receipt = findReceiptByKey(no);
  if (!receipt) {
    alert('Receipt not found');
    return;
  }

  const body = qs('#receiptPreviewBody');
  const meta = qs('#receiptPreviewMeta');
  const btnPrint = qs('#receiptPreviewPrint');
  const btnCopy = qs('#receiptPreviewCopy');
  const btnToggleView = qs('#receiptPreviewToggleView');
  const btnPdf = qs('#receiptPreviewPdf');
  const btnThermal = qs('#receiptPreviewThermal');
  const modal = qs('#modalReceiptPreview');

  if (!body || !meta || !btnPrint || !btnCopy || !btnToggleView || !btnPdf || !btnThermal || !modal) return;

  const state = { compact: false };
  const receiptKey = getReceiptKey(receipt);

  btnToggleView.disabled = false;
  btnPdf.disabled = false;
  btnThermal.disabled = false;

  const renderPreview = () => {
    body.innerHTML = buildReceiptHTML(receipt, { compact: state.compact });
    btnToggleView.textContent = state.compact ? '🧾 Detailed View' : '🧩 Compact View';
    meta.textContent = `Receipt ${receiptKey} · ${receipt.name} · ${state.compact ? 'Compact' : 'Detailed'} · Shortcuts: Ctrl+P Print, Ctrl+S PDF, Ctrl+C Copy`;
  };

  renderPreview();

  btnPrint.onclick = () => printReceipt(receiptKey, { regularOnly: true });
  btnCopy.onclick = async () => {
    const oldText = btnCopy.textContent;
    try {
      await navigator.clipboard.writeText(buildReceiptText(receipt));
      btnCopy.textContent = '✅ Copied';
      setTimeout(() => { btnCopy.textContent = oldText; }, 1200);
    } catch {
      alert('Could not copy receipt. Please try again.');
    }
  };
  btnToggleView.onclick = () => {
    state.compact = !state.compact;
    renderPreview();
  };
  btnPdf.onclick = () => generateReceiptPDF(receiptKey);
  btnThermal.onclick = () => printThermalReceipt(receiptKey, receipt.name, receipt.roll, receipt.amount, receipt.method, 'School Fee');

  const keyHandler = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = String(e.key || '').toLowerCase();
    if (key === 'p') {
      e.preventDefault();
      btnPrint.click();
    } else if (key === 's') {
      e.preventDefault();
      btnPdf.click();
    } else if (key === 'c') {
      e.preventDefault();
      btnCopy.click();
    }
  };

  modal.addEventListener('close', () => {
    document.removeEventListener('keydown', keyHandler);
  }, { once: true });
  document.addEventListener('keydown', keyHandler);

  openModal('#modalReceiptPreview');
}

// ---------- CSV Export (Core) ----------
function exportStudentsCSV(){
  if (AppState.students.length === 0) {
    alert('No students to export!');
    return;
  }
  
  const header = [
    'Roll No', 'Admission Date', 'Name', 'Date of Birth', 'Aadhar Number',
    'Father Name', 'Mother Name', 'Class', 'Section', 'Phone', 'Status',
    'Email', 'Address'
  ];
  
  const rows = AppState.students.map(s => [
    s.roll || '',
    s.admission_date || '',
    s.name || '',
    s.dob || '',
    s.aadhar || '',
    s.father_name || '',
    s.mother_name || '',
    s.class || '',
    s.section || '',
    s.phone || '',
    s.status || '',
    s.email || '',
    s.address || ''
  ]);
  
  const csv = arrayToCSV([header, ...rows]);
  const filename = `students_export_${new Date().toISOString().slice(0,10)}.csv`;
  downloadFile(filename, csv);
  
  console.log(`✅ Exported ${rows.length} students to ${filename}`);
  alert(`Successfully exported ${rows.length} students!`);
}
function exportReceiptsCSV(){
  const header=['no','date','roll','name','method','amount','discount','late_fee','ref','previous_unpaid'];
  const rows=AppState.receipts.map(r=> [
    r.no,r.date,r.roll,r.name,r.method,r.amount,r.discount||0,r.late_fee||0,r.ref||'',
    r.previousUnpaid || ''
  ]);
  const csv=arrayToCSV([header,...rows]);
  downloadFile('receipts.csv',csv);
}

// ---------- Modals (Core) ----------
function openModal(sel){
  const dlg=qs(sel);
  if (!dlg) { console.error('Modal not found:', sel); return false; }
  if (typeof dlg.showModal!=='function'){ alert('Your browser does not support <dialog>.'); return false;}
  dlg.showModal();

  // Add click handlers to all cancel and close buttons to close the dialog
  const cancelButtons = dlg.querySelectorAll('button[value="cancel"], button[type="button"][value="cancel"], .icon-btn[value="cancel"]');
  cancelButtons.forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      dlg.close();
    };
  });

  if(sel==='#modalAddStudent')     { initAddStudentModal(); loadTransportRoutesIntoForm(); }
  if(sel==='#modalImportCSV')      initImportCSVModal();
  if(sel==='#modalRecordPayment')  initRecordPaymentModal();
  if(sel==='#modalFeeHeads')       initFeeHeadsModal();
  if(sel==='#modalLateRules')      initLateRulesModal();
  if(sel==='#modalConcession')     initConcessionModal();
  if(sel==='#modalAddTeacher')     initAddTeacherModal();
  if(sel==='#modalCreateClass')    initCreateClassModal();

  return true;
}

async function loadTransportRoutesIntoForm() {
  const select = qs('#addStudentTransportRoute');
  if (!select) return;
  
  try {
    if (isServerConnected) {
      const response = await fetch(`${API_URL}/transport/routes`);
      if (response.ok) {
        const routes = await response.json();
        const activeRoutes = routes.filter(r => r.status === 'Active');
        
        // Clear existing options except "No Transport"
        select.innerHTML = '<option value="">No Transport</option>';
        
        // Add route options
        activeRoutes.forEach(route => {
          const option = document.createElement('option');
          option.value = route.id;
          option.textContent = `${route.route_name} - ₹${route.fee_amount}/month`;
          select.appendChild(option);
        });
      }
    }
  } catch (err) {
    console.warn('Could not load transport routes:', err);
  }
}

function initAddStudentModal(){
  const form = qs('#formAddStudent');
  if(!form) return;

  // If the modal is closed (cancel or after saving) we want to clear
  // the editRoll flag so that re-opening the dialog in the future
  // always starts clean.  The <dialog>'s `close` event is fired for
  // both programmatic and user-initiated closes.
  form.closest('dialog')?.addEventListener('close', () => {
    delete form.dataset.editRoll;
    form.reset();
  });

  const isEditMode = !!form.dataset.editRoll;
  
  form.onsubmit=async (e)=>{
    e.preventDefault();
    if (!isServerConnected) {
      alert('Cannot save student because backend server appears to be offline. Please check your network and try again.');
      return;
    }

    const data=Object.fromEntries(new FormData(form).entries());
    const student={
      roll:data.roll.trim(),
      admission_date: normalizeDate(data.admission_date?.trim() || ''),
      name:data.name.trim(),
      dob:data.dob.trim() || null,
      aadhar:data.aadhar.trim() || null,
      father_name:data.father_name.trim() || null,
      mother_name:data.mother_name.trim() || null,
      class:data.class,
      section:data.section,
      phone:data.phone.trim(),
      status:data.status
    };

    // small helper (mirrors backend logic) to normalise dates typed
    // as DD-MM-YYYY into the ISO form accepted by `<input type=date>`.
    function normalizeDate(val) {
      if (!val) return null;
      val = String(val).trim();
      const parts = val.split('-');
      if (parts.length === 3) {
        const [a,b,c] = parts;
        if (a.length===2 && c.length===4) {
          // assume DD-MM-YYYY
          return `${c.padStart(4,'0')}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
        }
      }
      // assume already ISO
      return val;
    }

    // helper to convert to API payload
    const toApi = s => ({
      roll_no: s.roll,
      admission_date: s.admission_date,
      aadhar_number: s.aadhar,
      name: s.name,
      date_of_birth: s.dob,
      father_name: s.father_name,
      mother_name: s.mother_name,
      class_name: s.class,
      section: s.section,
      phone: s.phone,
      status: s.status
    });

    try {
      let saved;
      if(isEditMode){
        const idx=AppState.students.findIndex(s=> s.roll===form.dataset.editRoll);
        if(idx===-1){ throw new Error('Student not found'); }
        if(student.roll!==form.dataset.editRoll && AppState.students.some(s=> s.roll===student.roll)){
          throw new Error('New admission no. already exists');
        }
        const existing = AppState.students[idx];
        if (!isServerConnected) {
          throw new Error('Cannot update student while offline');
        }
        const resp = await fetch(`${API_URL}/students/${existing.id}`, {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(toApi(student))
        });
        if(!resp.ok) throw new Error(await resp.text());
        saved = await resp.json();
        AppState.students[idx] = {
          id: saved.id,
          roll: saved.roll_no,
          admission_date: saved.admission_date,
          aadhar: saved.aadhar_number,
          name: saved.name,
          dob: saved.date_of_birth,
          father_name: saved.father_name,
          mother_name: saved.mother_name,
          class: saved.class_name,
          section: saved.section,
          phone: saved.phone,
          status: saved.status || 'Active'
        };
      } else {
        if(AppState.students.some(s=> s.roll===student.roll)){
          throw new Error('Admission no. already exists');
        }
        if (!isServerConnected) {
          throw new Error('Cannot create student while offline');
        }
        const resp = await fetch(`${API_URL}/students`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(toApi(student))
        });
        if(!resp.ok) throw new Error(await resp.text());
        saved = await resp.json();
        AppState.students.push({
          id: saved.id,
          roll: saved.roll_no,
          admission_date: saved.admission_date,
          aadhar: saved.aadhar_number,
          name: saved.name,
          dob: saved.date_of_birth,
          father_name: saved.father_name,
          mother_name: saved.mother_name,
          class: saved.class_name,
          section: saved.section,
          phone: saved.phone,
          status: saved.status || 'Active'
        });
      }

      AppState.kpi.totalStudents=AppState.students.length;
      saveState();

      // Handle transport assignment if a route was selected
      const transportRouteId = data.transport_route;
      if (saved.id && transportRouteId && transportRouteId !== '') {
        try {
          const transportResp = await fetch(`${API_URL}/students/${saved.id}/transport`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
              transport_assigned: 1,
              transport_route_id: parseInt(transportRouteId)
            })
          });
          if (!transportResp.ok) {
            console.warn('Failed to assign transport:', await transportResp.text());
          }
        } catch (err) {
          console.warn('Error assigning transport:', err);
        }
      }

      // Reset modal to add mode
      delete form.dataset.editRoll;
      qs('#modalAddStudent .modal__header h3').textContent='Add Student';
      qs('#modalAddStudent .modal__footer button[value="submit"]').textContent='Save';
      form.parentElement.close();
      if(AppState.view==='students') renderStudents();
    } catch(err) {
      alert('Unable to save student: '+err.message);
    }
  };
}

function initImportCSVModal(){
  const form=qs('#formImportCSV');
  const fileInput=form.querySelector('input[type="file"]');
  form.onsubmit=async (e)=>{
    e.preventDefault();
    const file=fileInput.files?.[0];
    if(!file){ alert('Please select a CSV file.'); return; }
    const text=await file.text();
    const rows=text.trim().split(/\r?\n/).map(line=>
      line.split(',').map(cell=> cell.replace(/^"|"$/g,'').replace(/""/g,'"'))
    );
    const [header,...dataRows]=rows;
    const idx=Object.fromEntries(header.map((h,i)=> [h.trim().toLowerCase(), i]));
    const required=['roll','name','class','section','phone','status'];
    if(!required.every(r=> idx[r]!==undefined)){
      alert('Invalid CSV header. Expected: '+required.join(', ')); return;
    }
    const newStudents=dataRows.map(r=> ({
      roll:r[idx['roll']].trim(),
      admission_date:r[idx['admission_date']]?.trim() || null,
      name:r[idx['name']].trim(),
      dob:r[idx['dob']]?.trim() || null,
      aadhar:r[idx['aadhar']]?.trim() || null,
      father_name:r[idx['father_name']]?.trim() || null,
      mother_name:r[idx['mother_name']]?.trim() || null,
      class:r[idx['class']].trim(),
      section:r[idx['section']].trim(),
      phone:r[idx['phone']].trim(),
      status:r[idx['status']].trim()
    }));
    const rolls=new Set(AppState.students.map(s=> s.roll));
    newStudents.forEach(s=>{ if(!rolls.has(s.roll)) AppState.students.push(s); });
    AppState.kpi.totalStudents=AppState.students.length;
    saveState(); form.parentElement.close();
    if(AppState.view==='students') renderStudents();
  };
}

// === Record Payment with Auto Late Fee ===
function initRecordPaymentModal(){
  const form=qs('#formRecordPayment');
  const search=qs('#rpStudentSearch');
  const list=qs('#rpStudentList');
  const rpRoll=qs('#rpRoll');
  const rpName=qs('#rpName');
  const rpClass=qs('#rpClass');
  const rpMethod=qs('#rpMethod');
  const rpRef=qs('#rpRef');
  const rpHeadsWrap=qs('#rpHeads');
  const rpDiscount=qs('#rpDiscount');
  const rpLateFee=qs('#rpLateFee');
  const rpSubtotal=qs('#rpSubtotal');
  const rpTotalDue=qs('#rpTotalDue');
  const rpPayNow=qs('#rpPayNow');
  const rpError=qs('#rpError');
  const rpStatus=qs('#rpStatus');
  const rpUnpaidMonthsList = qs('#rpUnpaidMonthsList');
  const rpMonthsError = qs('#rpMonthsError');
  const rpBtnSelectAll = qs('#rpBtnSelectAll');
  const rpBtnClearMonths = qs('#rpBtnClearMonths');

  let selectedMonths = [];
  let currentStudent = null;
  const dueClasses = ['student-due-high', 'student-due-mid-high', 'student-due-mid', 'student-due-low'];

  function getReceptionStudentDue(student){
    const month = monthOfToday();
    const financials = getStudentMonthFinancials(student, month);
    return Number(financials.balance || 0);
  }

  function getReceptionDueClass(dueAmount){
    if (dueAmount > 2000) return 'student-due-high';
    if (dueAmount > 1000 && dueAmount <= 2000) return 'student-due-mid-high';
    if (dueAmount >= 500 && dueAmount <= 1000) return 'student-due-mid';
    return 'student-due-low';
  }

  function clearSelectedStudentDueStyle(){
    [rpName, rpClass].forEach((el) => {
      if (!el) return;
      el.classList.remove('student-due-field', ...dueClasses);
    });
  }

  function applySelectedStudentDueStyle(student){
    if (!student) {
      clearSelectedStudentDueStyle();
      return;
    }
    const dueAmount = getReceptionStudentDue(student);
    const dueClass = getReceptionDueClass(dueAmount);
    [rpName, rpClass].forEach((el) => {
      if (!el) return;
      el.classList.remove(...dueClasses);
      el.classList.add('student-due-field', dueClass);
    });
  }

  // add recalc button once
  if(!qs('#rpLateFeeRecalc')){
    const recalcBtn=document.createElement('button');
    recalcBtn.id='rpLateFeeRecalc';
    recalcBtn.type='button';
    recalcBtn.className='btn btn-ghost small';
    recalcBtn.style.marginLeft='6px';
    recalcBtn.textContent='↻ Recalculate';
    rpLateFee.parentElement.appendChild(recalcBtn);
    recalcBtn.onclick=()=> autoCalcLateFee();
  }

  // Wire discounts/late fee/pay-now inputs to update totals immediately
  if (rpDiscount) rpDiscount.oninput = () => updateTotals();
  if (rpLateFee) rpLateFee.oninput = () => updateTotals();
  if (rpPayNow) rpPayNow.oninput = () => { validatePayNow(); updateTotals(); };

  // Search dropdown (safe: handle missing fields) and keyboard shortcuts
  search.oninput = () => {
    const q = (search.value || '').trim().toLowerCase();
    if (!q) { list.style.display = 'none'; return; }
    const matches = AppState.students.filter(s =>
      ((s.roll || '') + '').toLowerCase().includes(q) ||
      ((s.name || '') + '').toLowerCase().includes(q) ||
      ((s.phone || '') + '').toLowerCase().includes(q)
    ).slice(0, 8);
    list.innerHTML = matches.map(s => {
      const dueAmount = getReceptionStudentDue(s);
      const dueClass = getReceptionDueClass(dueAmount);
      return `
        <button type="button" class="dropdown__item dropdown__item--due ${dueClass}" data-roll="${s.roll}">
          <div class="dropdown__item-main">${s.roll || ''} · ${s.name || ''} · ${s.class || ''}-${s.section || ''}</div>
          <div class="dropdown__item-meta">Due: ${fmtINR(dueAmount)}</div>
        </button>
      `;
    }).join('');
    list.style.display = matches.length ? 'block' : 'none';
    qsa('#rpStudentList .dropdown__item').forEach(btn => {
      btn.onclick = () => { rpRoll.value = btn.getAttribute('data-roll'); fillStudentInfo(); list.style.display = 'none'; };
    });
  };

  // Open list with ArrowDown and select with Enter (when focused on search)
  search.onkeydown = (e) => {
    if (e.key === 'ArrowDown') {
      const first = list.querySelector('.dropdown__item');
      if (first) { first.focus(); }
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const first = list.querySelector('.dropdown__item');
      if (first) { rpRoll.value = first.getAttribute('data-roll'); fillStudentInfo(); list.style.display = 'none'; }
      e.preventDefault();
    }
  };

  rpRoll.onchange=()=>{ fillStudentInfo(); };

  function fillStudentInfo(){
    const s=AppState.students.find(x=> x.roll===rpRoll.value.trim());
    if(!s){ rpName.value=''; rpClass.value=''; rpUnpaidMonthsList.innerHTML=''; clearSelectedStudentDueStyle(); return; }
    rpName.value=s.name; 
    rpClass.value=s.class;
    applySelectedStudentDueStyle(s);
    currentStudent = s;
    loadUnpaidMonths();
  }

  function loadUnpaidMonths(){
    if (!currentStudent) return;
    let months = genMonthsSinceAdmission(currentStudent);
    const usingFallback = months[0] === '__NO_ADMISSION_DATE__';
    if (usingFallback) {
      // remove flag
      months = months.slice(1);
    }
    selectedMonths = [];
    
    let html = '';
    if (usingFallback) {
      html += `<div class="text-warning" style="padding:8px;">Admission date not set – displaying past 12 months. Please update student record for accurate list.</div>`;
    }
    html += months.map(month => {
      const key = `${currentStudent.roll}|${month}`;
      const fee = AppState.fees[key] || {};
      const heads = fee.heads || getFeesForStudentMonth(currentStudent, month) || {};
      const paid = Number(fee.paid || 0);
      const discount = Number(fee.discount || 0);
      const lateFee = Number(fee.lateFee || 0);
      
      const headTotal = Object.values(heads).reduce((a, b) => a + b, 0);
      const due = Math.max(0, headTotal + lateFee - discount - paid);
      
      const isUnpaid = due > 0;
      
      return `
        <label class="flex align-center gap-8 p-8 br-6 border" style="background: ${isUnpaid ? 'var(--bg-error-light)' : 'var(--bg-success-light)'}; cursor: pointer;">
          <input type="checkbox" data-month="${month}" ${isUnpaid ? 'checked' : 'disabled'} />
          <span>
            <strong>${formatMonthYear(month)}</strong>
            <br/>
            <small>${isUnpaid ? `Due: ${fmtINR(due)}` : 'Paid'}</small>
          </span>
        </label>
      `;
    }).join('');
    
    rpUnpaidMonthsList.innerHTML = html;
    
    // Wire up checkboxes
    qsa('#rpUnpaidMonthsList input[type="checkbox"]').forEach(cb => {
      cb.onchange = () => {
        selectedMonths = qsa('#rpUnpaidMonthsList input[type="checkbox"]:checked')
          .map(c => c.getAttribute('data-month'));
        loadHeads();
        updateTotals();
      };
    });
    
    // Set select all / clear handlers
    rpBtnSelectAll.onclick = () => {
      qsa('#rpUnpaidMonthsList input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = true);
      selectedMonths = qsa('#rpUnpaidMonthsList input[type="checkbox"]:checked')
        .map(c => c.getAttribute('data-month'));
      loadHeads();
      updateTotals();
    };
    
    rpBtnClearMonths.onclick = () => {
      qsa('#rpUnpaidMonthsList input[type="checkbox"]').forEach(cb => cb.checked = false);
      selectedMonths = [];
      rpHeadsWrap.innerHTML = '';
      updateTotals();
    };

    const rpBtnMarkPrev = qs('#rpBtnMarkPrev');
    if (rpBtnMarkPrev) {
      rpBtnMarkPrev.onclick = () => {
        if (selectedMonths.length === 0) {
          alert('Please select at least one month to mark as previously collected.');
          return;
        }
        
        // Warning dialog for marking previous fees
        const monthsList = selectedMonths.map(m => formatMonthYear(m)).join(', ');
        const confirmed = confirm(
          `⚠️ WARNING:\n\n` +
          `You are about to mark the following months as previously collected:\n\n${monthsList}\n\n` +
          `These months will be marked as PAID and will not appear in unpaid fees again.\n\n` +
          `Are you SURE you want to continue?`
        );
        
        if (!confirmed) {
          return; // User cancelled
        }
        
        selectedMonths.forEach(month => {
          const key = `${currentStudent.roll}|${month}`;
          const heads = (AppState.fees[key] && AppState.fees[key].heads) || getFeesForStudentMonth(currentStudent, month) || {};
          const total = Object.values(heads).reduce((a,b)=> a+Number(b||0),0);
          AppState.fees[key] = { heads, paid: total, discount:0, lateFee:0, lastReceipt:'PREVIOUS' };
        });
        saveState();
        rpStatus.textContent = `✅ Marked ${selectedMonths.length} month(s) as collected previously.`;
        loadUnpaidMonths();
      };
    }
  }

  async function loadHeads(){
    if (!currentStudent || selectedMonths.length === 0) {
      rpHeadsWrap.innerHTML = '';
      return;
    }
    
    // Fetch transport assignment from backend if student has ID
    let transportFee = 0;
    let hasTransport = false;
    if (currentStudent.id && isServerConnected) {
      try {
        const response = await fetch(`${API_URL}/students/${currentStudent.id}/transport-fee`);
        if (response.ok) {
          const data = await response.json();
          if (data.transport_assigned === 1 && data.transport_fee > 0) {
            transportFee = data.transport_fee;
            hasTransport = true;
          }
        }
      } catch (err) {
        console.warn('Could not fetch transport fee:', err);
      }
    }
    
    // Aggregate heads for all selected months
    const aggregatedHeads = {};
    let existingPaidTotal = 0;
    selectedMonths.forEach(month => {
      const key = `${currentStudent.roll}|${month}`;
      let fee = AppState.fees[key];

      if(!fee){
        let defHeads = {...(getFeesForStudentMonth(currentStudent, month) || { Tuition:800 })};
        // Add transport fee only if student is assigned to transport
        if (hasTransport && transportFee > 0) {
          defHeads = { ...defHeads, Transport: transportFee };
        }
        fee = AppState.fees[key] = { heads: defHeads, paid:0, discount:0, lateFee:0 };
      }
      
      // accumulate any already-paid amount for this month
      existingPaidTotal += Number(fee.paid || 0);

      // Add to aggregated heads
      Object.entries(fee.heads).forEach(([head, amt]) => {
        aggregatedHeads[head] = (aggregatedHeads[head] || 0) + Number(amt || 0);
      });
    });
    
    // If some of the selected months already have payments, subtract
    // that amount from the displayed head totals proportionally so the
    // user sees only the remaining due.
    if(existingPaidTotal > 0){
      const totalHeads = Object.values(aggregatedHeads).reduce((a,b)=> a+ b,0);
      if(totalHeads > 0){
        Object.keys(aggregatedHeads).forEach(head => {
          const proportion = aggregatedHeads[head] / totalHeads;
          aggregatedHeads[head] = Math.max(0, aggregatedHeads[head] - proportion * existingPaidTotal);
        });
      }
      // show a small note that some amount was already collected
      const note = document.createElement('div');
      note.className = 'note muted mt-4';
      note.textContent = `Note: ₹${existingPaidTotal} already paid against selected month(s); remaining dues shown above.`;
      rpHeadsWrap.parentElement.insertBefore(note, rpHeadsWrap);
    }

    rpHeadsWrap.innerHTML=Object.entries(aggregatedHeads).map(([head,amt])=>`
      <div class="grid-2">
        <label><span>${head} (₹)</span><input type="number" min="0" step="1" data-head="${head}" value="${amt}"/></label>
        <label><span>Include</span><input type="checkbox" data-include="${head}" checked/></label>
      </div>`).join('');

    qsa('#rpHeads input[type="number"]').forEach(inp=> inp.oninput=()=>{ updateTotals(); autoCalcLateFee(); });
    qsa('#rpHeads input[type="checkbox"]').forEach(inp=> inp.onchange=()=>{ updateTotals(); autoCalcLateFee(); });

    rpDiscount.value='0';
    rpLateFee.value='0';
    updateTotals();

    const suggestedPayNow = Number((rpTotalDue.textContent || '').replace(/[^0-9.-]+/g, '')) || 0;
    if (suggestedPayNow > 0 && Number(rpPayNow.value || 0) <= 0) {
      rpPayNow.value = String(suggestedPayNow);
      validatePayNow();
      updateTotals();
    }
  }

  function updateTotals(){
    if (selectedMonths.length === 0) {
      rpSubtotal.textContent = fmtINR(0);
      rpTotalDue.textContent = fmtINR(0);
      rpPayNow.value = '0';
      return;
    }
    
    const amounts=qsa('#rpHeads input[type="number"]').map(inp=>{
      const head=inp.getAttribute('data-head');
      const include=qs(`#rpHeads input[type="checkbox"][data-include="${head}"]`).checked;
      return include? Number(inp.value||0):0;
    });
    const subtotal=amounts.reduce((a,b)=> a+b,0);
    const discount=Number(rpDiscount.value||0);
    const lateFee=Number(rpLateFee.value||0);
    const totalDue=Math.max(0, subtotal+lateFee-discount);
    const payNow = Number(rpPayNow.value||0);
    const remaining = Math.max(0, totalDue - payNow);

    rpSubtotal.textContent=fmtINR(subtotal);
    rpTotalDue.textContent=fmtINR(remaining);

    qs('#rpBtnExact').onclick=()=>{ rpPayNow.value=String(totalDue); validatePayNow(); updateTotals(); };
    qs('#rpBtnHalf').onclick =()=>{ rpPayNow.value=String(Math.round(totalDue/2)); validatePayNow(); updateTotals(); };
    qs('#rpBtnClear').onclick=()=>{ rpPayNow.value='0'; validatePayNow(); updateTotals(); };

    validatePayNow();
  }
  
  function validatePayNow(){
    rpMonthsError.style.display='none';
    const pay=Number(rpPayNow.value||0);
    if(pay<0){ rpMonthsError.textContent='Amount cannot be negative.'; rpMonthsError.style.display='block'; return false; }
    // if net total due is visible calculate remaining
    const subtotal = parseFloat(rpSubtotal.textContent.replace(/[^0-9.-]+/g,'')) || 0;
    const late = Number(rpLateFee.value||0);
    const disc = Number(rpDiscount.value||0);
    const total = Math.max(0, subtotal + late - disc);
    if(pay > total){
      rpMonthsError.textContent='Pay Now cannot exceed total due.'; rpMonthsError.style.display='block';
      return false;
    }
    return true;
  }

  function autoCalcLateFee(){
    if (selectedMonths.length === 0) return;
    
    // Use earliest selected month for late fee calculation
    const firstMonth = selectedMonths[0];
    const autoFee=computeLateFee(currentStudent.roll, firstMonth, new Date());
    const current=Number(rpLateFee.value||0);
    if(current!==autoFee){ rpLateFee.value=String(autoFee); updateTotals(); }
  }

  qs('#rpSaveNoPrint').onclick=async (e)=>{
    e.preventDefault();
    if(!(await savePayment(false))) return;
    form.parentElement.close();
    switchView('fees');
    await renderFees();
    renderRecentReceipts();
  };
  qs('#rpSaveAndPrint').onclick=async (e)=>{
    e.preventDefault();
    if(!(await savePayment(true)))  return;
    form.parentElement.close();
    switchView('fees');
    await renderFees();
    renderRecentReceipts();
  };

  async function syncPendingReceipts(){
  if (!isServerConnected) return;
  // try to push any receipts that have not been synced yet
  for(const r of AppState.receipts){
    if(r.synced) continue;
    // find student id by roll
    const student = AppState.students.find(s=>s.roll===r.roll);
    if(!student || !student.id) continue; // cannot sync yet
    const paymentData = {
      student_id: student.id,
      amount: r.amount,
      payment_date: r.date,
      payment_method: r.method,
      transaction_id: r.ref,
      discount: r.discount || 0,
      late_fee: r.late_fee || 0,
      purpose: r.months ? `Fees ${r.months.join(', ')}` : 'Fee',
      status: r.status || 'Completed',
      remarks: r.previousUnpaid ? `Carry ₹${r.previousUnpaid}` : ''
    };
    try {
      const resp = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(paymentData)
      });
      if(resp.ok){
        const saved = await resp.json();
        r.synced = true;
        r.id = saved.id || r.no;
        saveState();
      }
    } catch(e){
      console.warn('Failed to sync receipt', r, e);
      // if network error, break out; will retry later
      break;
    }
  }
}

async function savePayment(printAfter){
    if (!currentStudent) { rpMonthsError.textContent='Invalid student.'; rpMonthsError.style.display='block'; return false; }
    if (selectedMonths.length === 0) { rpMonthsError.textContent='Please select at least one month.'; rpMonthsError.style.display='block'; return false; }

    const heads={};
    qsa('#rpHeads input[type="number"]').forEach(inp=>{
      const head=inp.getAttribute('data-head');
      const include=qs(`#rpHeads input[type="checkbox"][data-include="${head}"]`).checked;
      heads[head]=include? Number(inp.value||0):0;
    });

    const discount=Number(rpDiscount.value||0);
    const autoFee=computeLateFee(currentStudent.roll, selectedMonths[0], new Date());
    rpLateFee.value=String(autoFee);
    const lateFee=autoFee;
    const payNow=Number(rpPayNow.value||0);
    if(payNow<0){ rpMonthsError.textContent='Pay Now cannot be negative.'; rpMonthsError.style.display='block'; return false; }
    if(payNow<=0){ rpMonthsError.textContent='Please enter Pay Now amount greater than 0 to generate receipt.'; rpMonthsError.style.display='block'; return false; }

    const subtotal=Object.values(heads).reduce((a,b)=> a+b,0);
    const netDue=Math.max(0, subtotal+lateFee-discount);

    // compute total due across selected months
    const totalDue = selectedMonths.reduce((sum, month) => {
      const key = `${currentStudent.roll}|${month}`;
      const fee = AppState.fees[key] || { heads: {}, paid: 0, discount: 0, lateFee: 0 };
      const mHeads = fee.heads || getFeesForStudentMonth(currentStudent, month) || {};
      const mPaid = Number(fee.paid || 0);
      const mDiscount = Number(fee.discount || 0);
      const mLateFee = lateFee / selectedMonths.length;
      const mHeadTotal = Object.values(mHeads).reduce((a, b) => a + b, 0);
      const mDue = Math.max(0, mHeadTotal + mLateFee - mDiscount - mPaid);
      return sum + mDue;
    }, 0);

    // Distribute payment across selected months proportionally
    let remainingPayment = payNow;
    const monthPayments = {};
    
    selectedMonths.forEach(month => {
      const key = `${currentStudent.roll}|${month}`;
      const fee = AppState.fees[key] || { heads: {}, paid: 0, discount: 0, lateFee: 0 };
      const mHeads = fee.heads || getFeesForStudentMonth(currentStudent, month) || {};
      const mPaid = Number(fee.paid || 0);
      const mDiscount = Number(fee.discount || 0);
      const mLateFee = lateFee / selectedMonths.length; // distribute late fee
      
      const mHeadTotal = Object.values(mHeads).reduce((a, b) => a + b, 0);
      const mDue = Math.max(0, mHeadTotal + mLateFee - mDiscount - mPaid);
      
      monthPayments[month] = Math.min(remainingPayment, mDue);
      remainingPayment -= monthPayments[month];
    });
    
    // Save payment directly to database first, then reflect it in local state
    let receiptNo = null;
    if (payNow > 0) {
      let studentId = currentStudent.id;
      if (!studentId) {
        try {
          studentId = await syncLocalStudentToBackend(currentStudent);
          currentStudent.id = studentId;
        } catch (syncErr) {
          rpMonthsError.textContent = 'Unable to save payment because student is not synced with database.';
          rpMonthsError.style.display = 'block';
          return false;
        }
      }

      const carry = payNow < totalDue ? (totalDue - payNow) : 0;
      const paymentPayload = {
        student_id: studentId,
        amount: payNow,
        payment_date: todayYYYYMMDD(),
        payment_method: rpMethod.value,
        transaction_id: (rpRef.value || '').trim(),
        discount: discount,
        late_fee: lateFee,
        purpose: selectedMonths.length ? `Fees ${selectedMonths.join(', ')}` : 'Fee',
        status: 'Completed',
        remarks: carry > 0 ? `Carry ₹${carry}` : ''
      };

      let savedPayment = null;
      try {
        const paymentResp = await fetch(`${API_URL}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentPayload)
        });

        if (!paymentResp.ok) {
          throw new Error(`Payment save failed (${paymentResp.status})`);
        }

        savedPayment = await paymentResp.json();
      } catch (err) {
        rpMonthsError.textContent = 'Payment was not saved to database. Please try again.';
        rpMonthsError.style.display = 'block';
        console.warn('Direct payment save failed:', err);
        return false;
      }

      receiptNo = String(savedPayment?.id || ('R-' + String(AppState.receipts.length + 1).padStart(4,'0')));
      const receipt = {
        id: savedPayment?.id,
        no: receiptNo,
        date: savedPayment?.payment_date || todayYYYYMMDD(),
        roll: currentStudent.roll,
        name: currentStudent.name,
        method: savedPayment?.payment_method || rpMethod.value,
        amount: Number(savedPayment?.amount ?? payNow),
        discount: discount,
        late_fee: lateFee,
        ref: savedPayment?.transaction_id || (rpRef.value || '').trim(),
        months: selectedMonths,
        status: String(savedPayment?.status || 'Completed'),
        synced: true
      };

      if (carry > 0) {
        receipt.previousUnpaid = carry;
        const next = nextMonth(monthOfToday());
        if (next) {
          const nextKey = `${currentStudent.roll}|${next}`;
          AppState.fees[nextKey] = AppState.fees[nextKey] || { heads:{}, paid:0, discount:0, lateFee:0 };
          AppState.fees[nextKey].heads = AppState.fees[nextKey].heads || {};
          AppState.fees[nextKey].heads['Previous Unpaid'] = (AppState.fees[nextKey].heads['Previous Unpaid']||0) + carry;
        }
      }

      AppState.receipts.push(receipt);
    }
    
    selectedMonths.forEach(month => {
      const key = `${currentStudent.roll}|${month}`;
      AppState.fees[key] = AppState.fees[key] || { heads: {}, paid: 0, discount: 0, lateFee: 0 };
      AppState.fees[key].heads = AppState.fees[key].heads || getFeesForStudentMonth(currentStudent, month);
      AppState.fees[key].discount = discount / selectedMonths.length;
      AppState.fees[key].lateFee = lateFee / selectedMonths.length;
      AppState.fees[key].paid = (AppState.fees[key].paid || 0) + monthPayments[month];
      if(receiptNo) AppState.fees[key].lastReceipt = receiptNo;
    });

    // Update KPI collected month if same month
    if (monthOfToday() && selectedMonths.includes(monthOfToday())) {
      AppState.kpi.feesCollectedMonth = sumReceiptsThisMonth();
    }

    saveState();
    renderRecentReceipts();
    let statusMsg = `Saved ₹${payNow} across ${selectedMonths.length} month(s). Remaining: ₹${Math.max(0, netDue - payNow)}`;
    if(payNow < totalDue){
      const carry = totalDue - payNow;
      const nxt = nextMonth(monthOfToday());
      statusMsg += `; unpaid ₹${carry} has been added to ${formatMonthYear(nxt)}.`;
    }
    rpStatus.textContent = statusMsg;
    if(receiptNo && printAfter) printReceipt(receiptNo);
    return true;
  }

  if(rpRoll.value) fillStudentInfo(); else rpHeadsWrap.innerHTML='';
}

function initFeeHeadsModal(){
  const form=qs('#formFeeHeads');
  const wrap=qs('#fhEditor');
  wrap.innerHTML=Object.entries(AppState.feeHeadsByClass).map(([klass,heads])=>`
    <div class="card" style="margin:8px 0;">
      <div class="card__header"><h4>${klass}</h4></div>
      <div style="padding:8px;">
        ${Object.entries(heads).map(([h,amt])=>`
          <div class="grid-2">
            <label><span>${h} (₹)</span><input type="number" min="0" step="1" data-k="${klass}" data-h="${h}" value="${amt}"/></label>
            <button class="btn btn-ghost small" type="button" data-k="${klass}" data-del="${h}">Delete Head</button>
          </div>
        `).join('')}
        <button class="btn btn-ghost small" type="button" data-add="${klass}">+ Add Head</button>
      </div>
    </div>
  `).join('');

  qsa('#fhEditor input[type="number"]').forEach(inp=>{
    inp.oninput=()=>{ const k=inp.getAttribute('data-k'); const h=inp.getAttribute('data-h'); AppState.feeHeadsByClass[k][h]=Number(inp.value||0); };
  });
  qsa('#fhEditor button[data-del]').forEach(btn=>{
    btn.onclick=()=>{ const k=btn.getAttribute('data-k'); const h=btn.getAttribute('data-del'); delete AppState.feeHeadsByClass[k][h]; initFeeHeadsModal(); };
  });
  qsa('#fhEditor button[data-add]').forEach(btn=>{
    btn.onclick=()=>{ const k=btn.getAttribute('data-add'); const h=prompt('Head name? (e.g., Tuition)'); const amt=Number(prompt('Monthly amount (₹)?')||0); if(!h) return; AppState.feeHeadsByClass[k][h]=amt; initFeeHeadsModal(); };
  });

  form.onsubmit=(e)=>{ e.preventDefault(); saveState(); form.parentElement.close(); };
  qs('#feesBtnLateRules').onclick=(e)=>{ e.preventDefault(); openModal('#modalLateRules'); };
}

function initLateRulesModal(){
  qs('#lfCutoffDay').value=AppState.lateFeeRules.cutoffDay;
  qs('#lfGraceDays').value=AppState.lateFeeRules.graceDays;
  qs('#lfCap').value=AppState.lateFeeRules.cap;
  qs('#lfStartAfter').value=AppState.lateFeeRules.startAfter;
  qs('#lfSkipSat').checked=AppState.lateFeeRules.skipSat;
  qs('#lfSkipSun').checked=AppState.lateFeeRules.skipSun;
  qs('#lfHolidays').value=(AppState.lateFeeRules.holidays||[]).join(',');
  qs('#lfShiftRule').value=AppState.lateFeeRules.shiftRule;

  const wrap=qs('#lfSlabsWrap');
  wrap.innerHTML=(AppState.lateFeeRules.slabs||[]).map((s,idx)=>`
    <div class="grid-2">
      <div><strong>${s.from}–${s.to||'∞'} days</strong></div>
      <div>₹ ${s.perDay}/day <button class="btn btn-ghost small" data-del="${idx}">Remove</button></div>
    </div>
  `).join('');
  qsa('#lfSlabsWrap button[data-del]').forEach(b=>{
    b.onclick=()=>{ const i=Number(b.getAttribute('data-del')); AppState.lateFeeRules.slabs.splice(i,1); initLateRulesModal(); };
  });

  qs('#lfAddSlab').onclick=()=>{
    const from=Number(prompt('From day (>=1)?')||1);
    const to=prompt('To day (leave blank for open-ended)');
    const perDay=Number(prompt('Per day amount (₹)?')||0);
    AppState.lateFeeRules.slabs.push({from, to: to? Number(to): null, perDay});
    initLateRulesModal();
  };

  qs('#lfApplyTuition').checked=!!AppState.lateFeeRules.applyToHeads.Tuition;
  qs('#lfApplyTransport').checked=!!AppState.lateFeeRules.applyToHeads.Transport;
  qs('#lfApplyLab').checked=!!AppState.lateFeeRules.applyToHeads.Lab;
  qs('#lfApplyActivity').checked=!!AppState.lateFeeRules.applyToHeads.Activity;
  qs('#lfApplyMiscellaneous').checked=!!AppState.lateFeeRules.applyToHeads.Miscellaneous;

  const form=qs('#formLateRules');
  form.onsubmit=(e)=>{
    e.preventDefault();
    AppState.lateFeeRules.cutoffDay=Number(qs('#lfCutoffDay').value||1);
    AppState.lateFeeRules.graceDays=Number(qs('#lfGraceDays').value||0);
    AppState.lateFeeRules.cap=Number(qs('#lfCap').value||0);
    AppState.lateFeeRules.startAfter=Number(qs('#lfStartAfter').value||0);
    AppState.lateFeeRules.skipSat=qs('#lfSkipSat').checked;
    AppState.lateFeeRules.skipSun=qs('#lfSkipSun').checked;
    AppState.lateFeeRules.holidays=(qs('#lfHolidays').value||'').split(',').map(x=> x.trim()).filter(Boolean);
    AppState.lateFeeRules.shiftRule=qs('#lfShiftRule').value;
    AppState.lateFeeRules.applyToHeads={
      Tuition: qs('#lfApplyTuition').checked,
      Transport: qs('#lfApplyTransport').checked,
      Lab: qs('#lfApplyLab').checked,
      Activity: qs('#lfApplyActivity').checked,
      Miscellaneous: qs('#lfApplyMiscellaneous').checked
    };
    try{
      const overrides=JSON.parse(qs('#lfClassOverrides').value||'{}');
      AppState.lateFeeRules.classOverrides=overrides;
    } catch{
      alert('Invalid JSON in per-class overrides.'); return;
    }
    saveState(); form.parentElement.close();
  };
}

function initConcessionModal(){
  const form=qs('#formConcession');
  form.onsubmit=(e)=>{
    e.preventDefault();
    const roll=qs('#ccRoll').value.trim();
    const type=qs('#ccType').value;
    const value=Number(qs('#ccValue').value||0);
    const note=qs('#ccNote').value.trim();
    const s=AppState.students.find(x=> x.roll===roll);
    if(!s){ alert('Invalid roll'); return; }
    s.concession={type,value,note};
    saveState();
    form.parentElement.close();
    alert('Concession saved for '+s.name);
  };
}

// ---------- Print Receipt ----------
function printReceipt(no, options = {}){
  const r = findReceiptByKey(no);
  if(!r){ alert('Receipt not found'); return; }
  const receiptNo = getReceiptKey(r);

  const regularOnly = !!options.regularOnly;

  // Offer choice for thermal or regular printer unless forced to regular print
  const choice = regularOnly ? false : confirm(
    '🖨️ Print Options:\n\n' +
    'OK → Thermal Printer (ESC/POS Format)\n' +
    'Cancel → Regular Printer (Browser Print)\n\n' +
    'Choose Thermal for petrol pump style thermal printers.'
  );
  
  if (choice) {
    // Thermal printer
    printThermalReceipt(
      receiptNo,
      r.name,
      r.roll,
      r.amount,
      r.method,
      'School Fee'
    );
  } else {
    // Regular browser print
    const root=qs('#receiptPrintRoot');
    root.innerHTML = buildReceiptHTML(r);
    printFromRoot(root, 900);
  }
}

// Generate Receipt PDF with Logo
function generateReceiptPDF(receiptNo) {
  const receipt = findReceiptByKey(receiptNo);
  if (!receipt) {
    alert('Receipt not found');
    return;
  }
  const normalizedReceiptNo = getReceiptKey(receipt);

  const sch = AppState.settings.school || {};
  const headerName = RECEIPT_SCHOOL_HEADER;
  const tagline = sch.tagline || 'Deoley Sheikhpura';
  const address = sch.address || '';
  const phone = sch.phone || '';
  const email = sch.email || '';
  const logoUrl = sch.logo || 'assets/logo.png';
  const amount = (receipt.amount || 0).toLocaleString(AppState.settings.locale || 'en-IN');
  const now = new Date().toLocaleString(AppState.settings.locale || 'en-IN');

  // Build HTML string for PDF
  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
  html += 'body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#333}';
  html += '.receipt-container{max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;padding:30px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.1)}';
  html += '.receipt-header{text-align:center;margin-bottom:30px;border-bottom:2px solid #2563eb;padding-bottom:20px}';
  html += '.logo-section{display:flex;align-items:center;justify-content:center;margin-bottom:12px}';
  html += '.logo-section img{max-width:60px;max-height:60px;margin-right:12px}';
  html += '.school-info{text-align:center}';
  html += '.school-name{font-size:20px;font-weight:bold;color:#2563eb;margin:0}';
  html += '.school-tagline{font-size:13px;color:#666;margin:4px 0 0 0}';
  html += '.school-address{font-size:11px;color:#999;margin-top:4px;line-height:1.4}';
  html += '.receipt-title{text-align:center;font-size:18px;font-weight:bold;color:#2563eb;margin:20px 0}';
  html += '.receipt-body{margin:20px 0}';
  html += '.receipt-row{display:flex;justify-content:space-between;margin:12px 0;font-size:14px;border-bottom:1px dotted #ddd;padding-bottom:8px}';
  html += '.receipt-row-label{font-weight:600;color:#333;flex:0 0 40%}';
  html += '.receipt-row-value{text-align:right;color:#555;flex:1}';
  html += '.amount-section{background:#f9fafb;border-radius:6px;padding:15px;margin:20px 0;border:1px solid #e5e7eb}';
  html += '.amount-row{display:flex;justify-content:space-between;font-size:15px;margin:10px 0}';
  html += '.amount-row-label{font-weight:600;color:#333}';
  html += '.amount-row-value{text-align:right;font-weight:600;color:#2563eb}';
  html += '.total-row{display:flex;justify-content:space-between;font-size:18px;font-weight:bold;margin-top:15px;padding-top:15px;border-top:2px solid #2563eb;color:#2563eb}';
  html += '.collection-note{background:#e0f2fe;border:2px solid #0284c7;border-radius:6px;padding:12px;margin:20px 0;text-align:center;font-weight:600;color:#0284c7;font-size:12px}';
  html += '.receipt-footer{text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:11px;color:#999;line-height:1.6}';
  html += '.timestamp{margin-top:20px;font-size:10px;color:#ccc;text-align:center}';
  html += '</style></head><body>';
  html += '<div class="receipt-container">';
  html += '<div class="receipt-header"><div class="logo-section">';
  html += '<img src="' + logoUrl + '" alt="School Logo" onerror="this.style.display=\'none\'">';
  html += '<div class="school-info">';
  html += '<p class="school-name">' + headerName + '</p>';
  html += '<p class="school-tagline">' + tagline + '</p>';
  html += '<div class="school-address">';
  if (address) html += address + '<br>';
  if (phone) html += '📞 ' + phone + '<br>';
  if (email) html += '✉️ ' + email;
  html += '</div></div></div></div>';
  html += '<div class="receipt-title">FEE RECEIPT</div>';
  html += '<div class="receipt-body">';
  html += '<div class="receipt-row"><span class="receipt-row-label">Receipt No:</span><span class="receipt-row-value"><strong>' + normalizedReceiptNo + '</strong></span></div>';
  html += '<div class="receipt-row"><span class="receipt-row-label">Date:</span><span class="receipt-row-value">' + receipt.date + '</span></div>';
  html += '<div class="receipt-row"><span class="receipt-row-label">Student Name:</span><span class="receipt-row-value"><strong>' + receipt.name + '</strong></span></div>';
  html += '<div class="receipt-row"><span class="receipt-row-label">Admission No:</span><span class="receipt-row-value">' + receipt.roll + '</span></div>';
  html += '<div class="receipt-row"><span class="receipt-row-label">Payment Method:</span><span class="receipt-row-value">' + receipt.method + '</span></div>';
  if (receipt.ref) html += '<div class="receipt-row"><span class="receipt-row-label">Reference:</span><span class="receipt-row-value">' + receipt.ref + '</span></div>';
  html += '</div>';
  if(receipt.previousUnpaid){
    html += '<div class="receipt-row"><span class="receipt-row-label">Previous Unpaid</span><span class="receipt-row-value">₹ ' + (receipt.previousUnpaid||0).toLocaleString(AppState.settings.locale||'en-IN') + '</span></div>';
  }
  html += '<div class="amount-section">';
  html += '<div class="amount-row"><span class="amount-row-label">Amount Paid</span><span class="amount-row-value">₹ ' + amount + '</span></div>';
  html += '<div class="total-row"><span>Total</span><span>₹ ' + amount + '</span></div>';
  html += '</div>';
  html += '<div class="collection-note">💳 Payment Collected at Cash Counter</div>';
  html += '<div class="receipt-footer">';
  html += '<p>✓ Payment received and recorded in system</p>';
  html += '<p>This is a system-generated receipt. No signature required.</p>';
  html += '<p style="margin:8px 0 0 0;">For queries, contact the school office</p>';
  html += '<div class="timestamp">Generated on ' + now + '</div>';
  html += '</div></div></body></html>';

  const options = {
    margin: [10, 10, 10, 10],
    filename: 'receipt_' + normalizedReceiptNo + '_' + receipt.date + '.pdf',
    image: { type: 'png', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  };

  html2pdf().set(options).from(html, 'string').save();
}

// ---------- Exams View ----------
function renderExams(){
  const classFilter = qs('#examFilterClass')?.value || '';
  const subjectFilter = qs('#examFilterSubject')?.value || '';
  const searchQuery = qs('#examSearch')?.value?.toLowerCase() || '';

  // Filter exams
  let filtered = AppState.exams.filter(e => {
    const matchClass = !classFilter || e.class === classFilter;
    const matchSubject = !subjectFilter || e.subject === subjectFilter;
    const matchSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery);
    return matchClass && matchSubject && matchSearch;
  });

  // Update KPIs
  const kpiTotal = qs('#examKpiTotal');
  if (kpiTotal) kpiTotal.textContent = String(AppState.exams.length);

  const avgScores = [];
  filtered.forEach(exam => {
    const examMarks = Object.entries(AppState.marks)
      .filter(([key]) => key.startsWith(exam.id + '|'))
      .map(([, val]) => val.obtainedMarks);
    if (examMarks.length > 0) {
      const avg = examMarks.reduce((a, b) => a + b, 0) / examMarks.length;
      avgScores.push((avg / exam.totalMarks) * 100);
    }
  });
  const kpiAvgScore = qs('#examKpiAvgScore');
  if (kpiAvgScore) kpiAvgScore.textContent = avgScores.length > 0 ? String(Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length)) + '%' : '0%';

  // Update filters
  const classes = [...new Set(AppState.exams.map(e => e.class))].sort();
  const classSel = qs('#examFilterClass');
  if (classSel) {
    const current = classSel.value;
    classSel.innerHTML = '<option value="">All Classes</option>';
    classes.forEach(c => classSel.innerHTML += `<option value="${c}">${c}</option>`);
    classSel.value = current;
  }

  const subjects = [...new Set(AppState.exams.map(e => e.subject))].sort();
  const subjectSel = qs('#examFilterSubject');
  if (subjectSel) {
    const current = subjectSel.value;
    subjectSel.innerHTML = '<option value="">All Subjects</option>';
    subjects.forEach(s => subjectSel.innerHTML += `<option value="${s}">${s}</option>`);
    subjectSel.value = current;
  }

  // Render table
  const tbody = qs('#examsTableBody');
  if (tbody) {
    tbody.innerHTML = filtered.map(exam => {
      const examMarks = Object.entries(AppState.marks)
        .filter(([key]) => key.startsWith(exam.id + '|'))
        .map(([, val]) => val.obtainedMarks);
      const marksEntered = examMarks.length;
      const avgScore = marksEntered > 0 ? ((examMarks.reduce((a, b) => a + b, 0) / marksEntered) / exam.totalMarks * 100).toFixed(1) + '%' : '-';
      
      return `
        <tr>
          <td>${exam.name}</td>
          <td>${exam.class}</td>
          <td>${exam.subject}</td>
          <td>${exam.date}</td>
          <td>${exam.totalMarks}</td>
          <td>${marksEntered}/${AppState.students.filter(s => s.class === exam.class).length}</td>
          <td>${avgScore}</td>
          <td style="text-align:right;">
            <button class="btn btn-ghost small" data-act="enterMarks" data-id="${exam.id}">Enter Marks</button>
            <button class="btn btn-ghost small" data-act="delExam" data-id="${exam.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    qsa('button[data-act="enterMarks"]').forEach(btn => {
      btn.onclick = () => {
        if (openModal('#modalEnterMarks')) initEnterMarksModal(btn.getAttribute('data-id'));
      };
    });

    qsa('button[data-act="delExam"]').forEach(btn => {
      btn.onclick = () => {
        const examId = btn.getAttribute('data-id');
        const exam = AppState.exams.find(e => e.id === examId);
        if (!exam) return;
        if (!confirm(`Delete exam "${exam.name}"? This will also delete all marks for this exam.`)) return;
        AppState.exams = AppState.exams.filter(e => e.id !== examId);
        Object.keys(AppState.marks).forEach(key => {
          if (key.startsWith(examId + '|')) delete AppState.marks[key];
        });
        saveState();
        renderExams();
      };
    });
  }

  // Bind filter and search
  const bindFilterChange = () => renderExams();
  qs('#examFilterClass')?.addEventListener('change', bindFilterChange);
  qs('#examFilterSubject')?.addEventListener('change', bindFilterChange);
  qs('#examSearch')?.addEventListener('input', bindFilterChange);

  // Bind buttons
  if (qs('#examBtnCreate')) qs('#examBtnCreate').onclick = () => {
    if (openModal('#modalCreateExam')) initCreateExamModal();
  };

  if (qs('#examBtnExport')) qs('#examBtnExport').onclick = exportExamsCSV;
}

function initCreateExamModal(){
  const form = qs('#formCreateExam');
  form.onsubmit = (e) => {
    e.preventDefault();
    const examId = 'exam_' + Date.now();
    const exam = {
      id: examId,
      name: qs('#examName').value.trim(),
      date: qs('#examDate').value,
      class: qs('#examClass').value,
      subject: qs('#examSubject').value.trim(),
      totalMarks: Number(qs('#examTotalMarks').value),
      passingMarks: Number(qs('#examPassingMarks').value)
    };
    AppState.exams.push(exam);
    saveState();
    form.parentElement.close();
    if (AppState.view === 'exams') renderExams();
  };
}

function initEnterMarksModal(examId){
  const exam = AppState.exams.find(e => e.id === examId);
  if (!exam) return;

  const form = qs('#formEnterMarks');
  form.dataset.examId = examId;

  // Show exam info
  const examInfo = qs('#marksExamInfo');
  if (examInfo) examInfo.textContent = `Exam: ${exam.name} | Class: ${exam.class} | Subject: ${exam.subject} | Total: ${exam.totalMarks}`;

  // Get students in this class
  const classStudents = AppState.students.filter(s => s.class === exam.class);

  // Render marks table
  const tbody = qs('#marksTableBody');
  if (tbody) {
    tbody.innerHTML = classStudents.map(student => {
      const key = `${examId}|${student.roll}`;
      const marks = AppState.marks[key] || { obtainedMarks: 0 };
      const grade = getGrade(marks.obtainedMarks, exam.totalMarks, exam.passingMarks);
      return `
        <tr>
          <td>${student.roll}</td>
          <td>${student.name}</td>
          <td><input type="number" min="0" max="${exam.totalMarks}" step="0.5" class="mark-input" data-roll="${student.roll}" value="${marks.obtainedMarks || ''}" style="width:80px;" /></td>
          <td><span class="badge" id="grade-${student.roll}">${grade}</span></td>
        </tr>
      `;
    }).join('');

    qsa('.mark-input').forEach(inp => {
      inp.oninput = () => {
        const grade = getGrade(Number(inp.value) || 0, exam.totalMarks, exam.passingMarks);
        qs(`#grade-${inp.getAttribute('data-roll')}`).textContent = grade;
      };
    });
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    qsa('.mark-input').forEach(inp => {
      const roll = inp.getAttribute('data-roll');
      const marks = Number(inp.value);
      const key = `${examId}|${roll}`;
      if (marks >= 0) {
        const grade = getGrade(marks, exam.totalMarks, exam.passingMarks);
        AppState.marks[key] = { obtainedMarks: marks, grade };
      }
    });
    saveState();
    form.parentElement.close();
    if (AppState.view === 'exams') renderExams();
  };
}

function getGrade(obtainedMarks, totalMarks, passingMarks){
  const percentage = (obtainedMarks / totalMarks) * 100;
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= passingMarks) return 'D';
  return 'F';
}

function exportExamsCSV(){
  const header = ['id', 'name', 'date', 'class', 'subject', 'totalMarks', 'passingMarks'];
  const rows = AppState.exams.map(e => [e.id, e.name, e.date, e.class, e.subject, e.totalMarks, e.passingMarks]);
  const csv = arrayToCSV([header, ...rows]);
  downloadFile('exams.csv', csv);
}

// ---------- Teachers View ----------
function renderTeachers(){
  const isReceptionPanel = getUserRole() === 'admin' && getAdminPanelRole() === 'reception';
  const activeTabId = isReceptionPanel ? 'attendance-tab' : getActiveTeacherTabId();
  applyTeacherModulePermissions(isReceptionPanel);

  fetchTeachersFromBackend().then(() => {
    renderTeachersTable();
    setupTeacherAttendance();
    renderSalaryPayments();
    setupTeacherButtons();
    setActiveTeacherTab(activeTabId);
  });

  renderTeachersTable();
  setupTeacherAttendance();
  renderSalaryPayments();
  setupTeacherButtons();
  setActiveTeacherTab(activeTabId);
}

function getActiveTeacherTabId(){
  const active = qs('#view-teachers .tab-btn.active');
  return active?.getAttribute('data-tab') || 'teachers-tab';
}

function applyTeacherModulePermissions(isReceptionPanel){
  const container = qs('#view-teachers');
  if (!container) return;

  const teachersTabBtn = container.querySelector('.tab-btn[data-tab="teachers-tab"]');
  const attendanceTabBtn = container.querySelector('.tab-btn[data-tab="attendance-tab"]');
  const salaryTabBtn = container.querySelector('.tab-btn[data-tab="salary-tab"]');

  if (isReceptionPanel) {
    if (teachersTabBtn) teachersTabBtn.style.display = 'none';
    if (salaryTabBtn) salaryTabBtn.style.display = 'none';
    if (attendanceTabBtn) attendanceTabBtn.style.display = '';
  } else {
    if (teachersTabBtn) teachersTabBtn.style.display = '';
    if (salaryTabBtn) salaryTabBtn.style.display = '';
    if (attendanceTabBtn) attendanceTabBtn.style.display = '';
  }
}

function setActiveTeacherTab(tabId){
  const container = qs('#view-teachers');
  if (!container) return;

  const buttons = qsa('#view-teachers .tab-btn');
  const tabs = qsa('#view-teachers .tab-content');
  buttons.forEach(b => b.classList.remove('active'));
  tabs.forEach(t => {
    t.classList.add('d-none');
    t.style.display = '';
  });

  const selectedBtn = container.querySelector(`.tab-btn[data-tab="${tabId}"]`) || container.querySelector('.tab-btn[data-tab="teachers-tab"]');
  const selectedTabId = selectedBtn?.getAttribute('data-tab') || 'teachers-tab';
  const selectedTab = qs(`#${selectedTabId}`);

  if (selectedBtn) selectedBtn.classList.add('active');
  if (selectedTab) {
    selectedTab.classList.remove('d-none');
    selectedTab.style.display = 'block';
  }
}

function renderTeachersTable(){
  const tbody = qs('#teachersTableBody');
  if (!tbody) return;
  const isReceptionPanel = getUserRole() === 'admin' && getAdminPanelRole() === 'reception';
  
  tbody.innerHTML = AppState.teachers.map(t => `
    <tr>
      <td>${t.name}</td>
      <td>${t.phone}</td>
      <td>${t.email || '-'}</td>
      <td>${t.subjects}</td>
      <td>${t.joinDate}</td>
      <td>${fmtINR(t.salary)}</td>
      <td><span class="badge">${t.status}</span></td>
      <td style="text-align:right;">
        ${isReceptionPanel
          ? '<span class="muted">—</span>'
          : `<button class="btn btn-ghost small" data-act="editTeacher" data-id="${t.id}">Edit</button>
        <button class="btn btn-ghost small" data-act="delTeacher" data-id="${t.id}">Delete</button>`}
      </td>
    </tr>
  `).join('');

  qsa('button[data-act="editTeacher"]').forEach(btn => {
    btn.onclick = () => openEditTeacher(btn.getAttribute('data-id'));
  });

  qsa('button[data-act="delTeacher"]').forEach(btn => {
    btn.onclick = async () => {
      const teacherId = btn.getAttribute('data-id');
      const teacher = AppState.teachers.find(t => String(t.id) === String(teacherId));
      if (!teacher) return;
      if (!confirm(`Delete teacher ${teacher.name}? This cannot be undone.`)) return;

      try {
        const isNumericId = /^\d+$/.test(String(teacher.id));
        if (!isNumericId) {
          AppState.teachers = AppState.teachers.filter(t => String(t.id) !== String(teacherId));
          saveState();
          renderTeachers();
          return;
        }

        if (!isServerConnected) throw new Error('Backend server appears offline');
        const response = await fetchWithTimeout(`${API_URL}/teachers/${teacher.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        }, 8000);

        if (!response || !response.ok) {
          const body = await (response ? response.text() : Promise.resolve('no response'));
          throw new Error(`${response?.status || ''} ${body}`.trim());
        }

        AppState.teachers = AppState.teachers.filter(t => String(t.id) !== String(teacherId));
        saveState();
        renderTeachers();
      } catch (err) {
        alert('Unable to delete teacher from database: ' + err.message);
      }
    };
  });
}

function setupTeacherAttendance(){
  const datePicker = qs('#attDatePicker');
  const dateDisplay = qs('#attDateDisplay');
  const dateBox = datePicker ? datePicker.closest('.attendance-date-box') : null;
  const monthDisplay = qs('#attMonthDisplay');
  const monthPrevBtn = qs('#attMonthPrev');
  const monthNextBtn = qs('#attMonthNext');
  const monthLoadBtn = qs('#attBtnMonthLoad');
  const monthPrintBtn = qs('#attBtnMonthPrint');
  const isReceptionPanel = getUserRole() === 'admin' && getAdminPanelRole() === 'reception';

  const refreshDateDisplay = () => {
    if (!dateDisplay) return;
    const selectedDate = datePicker?.value || todayYYYYMMDD();
    const parsedDate = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      dateDisplay.textContent = selectedDate;
      return;
    }
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = weekDays[parsedDate.getDay()];
    const dateText = `${String(parsedDate.getDate()).padStart(2, '0')} ${months[parsedDate.getMonth()]} ${parsedDate.getFullYear()}`;
    dateDisplay.textContent = `${dayName} . ${dateText}`;
  };

  const refreshMonthDisplay = () => {
    if (!monthDisplay) return;
    const [yearPart, monthPart] = String(teacherAttendanceMonthView || currentMonth()).split('-');
    const year = Number(yearPart);
    const month = Number(monthPart);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      monthDisplay.textContent = String(teacherAttendanceMonthView || currentMonth());
      return;
    }
    const monthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long' });
    monthDisplay.textContent = `${monthName} ${year}`;
  };

  if (isReceptionPanel) {
    if (datePicker) {
      datePicker.value = todayYYYYMMDD();
      datePicker.disabled = true;
      datePicker.style.display = 'none';
    }
    if (dateBox) dateBox.classList.add('attendance-date-box--compact');
    const attBtnLoad = qs('#attBtnLoad');
    if (attBtnLoad) attBtnLoad.style.display = 'none';
  } else {
    if (datePicker) {
      datePicker.disabled = false;
      datePicker.style.display = '';
    }
    if (dateBox) dateBox.classList.remove('attendance-date-box--compact');
    const attBtnLoad = qs('#attBtnLoad');
    if (attBtnLoad) attBtnLoad.style.display = '';
  }

  if (datePicker && !datePicker.value) datePicker.value = todayYYYYMMDD();
  teacherAttendanceMonthView = String(datePicker?.value || '').slice(0, 7) || teacherAttendanceMonthView || currentMonth();

  if (datePicker) {
    datePicker.onchange = () => {
      refreshDateDisplay();
      teacherAttendanceMonthView = String(datePicker.value || '').slice(0, 7) || currentMonth();
      refreshMonthDisplay();
      renderMonthlyAttendanceSummary(teacherAttendanceMonthView);
    };
  }

  if (monthPrevBtn) {
    monthPrevBtn.onclick = () => {
      teacherAttendanceMonthView = shiftMonthValue(teacherAttendanceMonthView || currentMonth(), -1);
      refreshMonthDisplay();
      renderMonthlyAttendanceSummary(teacherAttendanceMonthView);
    };
  }

  if (monthNextBtn) {
    monthNextBtn.onclick = () => {
      teacherAttendanceMonthView = shiftMonthValue(teacherAttendanceMonthView || currentMonth(), 1);
      refreshMonthDisplay();
      renderMonthlyAttendanceSummary(teacherAttendanceMonthView);
    };
  }

  if (monthLoadBtn) {
    monthLoadBtn.onclick = () => {
      refreshMonthDisplay();
      renderMonthlyAttendanceSummary(teacherAttendanceMonthView || currentMonth());
    };
  }

  if (monthPrintBtn) {
    monthPrintBtn.onclick = () => printTeacherAttendanceMonthA4(teacherAttendanceMonthView || currentMonth());
  }

  refreshDateDisplay();
  refreshMonthDisplay();

  if (qs('#attBtnLoad')) {
    qs('#attBtnLoad').onclick = () => {
      loadAttendanceForDate(datePicker.value);
      renderMonthlyAttendanceSummary(teacherAttendanceMonthView || currentMonth());
    };
  }
  if (qs('#attBtnMarkAll')) qs('#attBtnMarkAll').onclick = () => {
    qsa('select.att-status').forEach(sel => sel.value = 'present');
  };
  if (qs('#attBtnSave')) qs('#attBtnSave').onclick = () => saveAttendance(datePicker.value);

  loadAttendanceForDate(datePicker.value);
  renderMonthlyAttendanceSummary(teacherAttendanceMonthView || String(datePicker.value || '').slice(0, 7) || currentMonth());
}

function shiftMonthValue(monthValue, step){
  const [yearPart, monthPart] = String(monthValue || currentMonth()).split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return currentMonth();
  }
  const shifted = new Date(year, month - 1 + Number(step || 0), 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

function getTeacherMonthlyAttendanceRows(month){
  const monthKey = String(month || '').trim() || currentMonth();
  return (AppState.teachers || []).map(teacher => {
    let present = 0;
    let absent = 0;
    let leave = 0;

    Object.entries(AppState.teacherAttendance || {}).forEach(([key, value]) => {
      const [teacherId, date] = String(key).split('|');
      if (String(teacherId) !== String(teacher.id)) return;
      if (!date || !date.startsWith(`${monthKey}-`)) return;
      const status = String(value?.status || '').toLowerCase();
      if (status === 'present') present += 1;
      else if (status === 'absent') absent += 1;
      else if (status === 'leave') leave += 1;
    });

    const markedDays = present + absent + leave;
    const presentPct = markedDays > 0 ? `${((present / markedDays) * 100).toFixed(1)}%` : '—';

    return {
      teacherName: teacher.name,
      present,
      absent,
      leave,
      markedDays,
      presentPct
    };
  });
}

function renderMonthlyAttendanceSummary(month){
  const tbody = qs('#attendanceMonthTableBody');
  if (!tbody) return;

  const rows = getTeacherMonthlyAttendanceRows(month);
  const htmlRows = rows.map(row => `
      <tr>
        <td>${row.teacherName}</td>
        <td>${row.present}</td>
        <td>${row.absent}</td>
        <td>${row.leave}</td>
        <td>${row.markedDays}</td>
        <td>${row.presentPct}</td>
      </tr>
    `);

  if (htmlRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">No teachers found.</td></tr>';
    return;
  }

  tbody.innerHTML = htmlRows.join('');
}

function printTeacherAttendanceMonthA4(month){
  const monthKey = String(month || '').trim() || currentMonth();
  const rows = getTeacherMonthlyAttendanceRows(monthKey);
  if (!rows.length) {
    alert('No teacher data available to print.');
    return;
  }

  const school = AppState.settings?.school || {};
  const locale = AppState.settings?.locale || 'en-IN';
  const schoolName = escapedText(school.name || 'KHUSHI PUBLIC SCHOOL');
  const schoolAddress = escapedText(school.address || '');
  const reportMonth = escapedText(formatMonthYear(monthKey) || monthKey);
  const printedAt = escapedText(new Date().toLocaleString(locale));

  const totalPresent = rows.reduce((sum, row) => sum + row.present, 0);
  const totalAbsent = rows.reduce((sum, row) => sum + row.absent, 0);
  const totalLeave = rows.reduce((sum, row) => sum + row.leave, 0);
  const totalMarked = rows.reduce((sum, row) => sum + row.markedDays, 0);

  const rowsHtml = rows.map(row => `
    <tr>
      <td>${escapedText(row.teacherName || '')}</td>
      <td>${row.present}</td>
      <td>${row.absent}</td>
      <td>${row.leave}</td>
      <td>${row.markedDays}</td>
      <td>${row.presentPct}</td>
    </tr>
  `).join('');

  const dayWiseMap = {};
  Object.entries(AppState.teacherAttendance || {}).forEach(([key, value]) => {
    const [, date] = String(key).split('|');
    if (!date || !date.startsWith(`${monthKey}-`)) return;
    const status = String(value?.status || '').toLowerCase();
    if (!dayWiseMap[date]) dayWiseMap[date] = { present: 0, absent: 0, leave: 0 };
    if (status === 'present') dayWiseMap[date].present += 1;
    else if (status === 'absent') dayWiseMap[date].absent += 1;
    else if (status === 'leave') dayWiseMap[date].leave += 1;
  });

  const dayWiseRows = Object.entries(dayWiseMap)
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([date, totals]) => {
      const dateObj = new Date(`${date}T00:00:00`);
      const dayName = Number.isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleString(locale, { weekday: 'long' });
      const marked = Number(totals.present || 0) + Number(totals.absent || 0) + Number(totals.leave || 0);
      return `
        <tr>
          <td>${escapedText(date)}</td>
          <td>${escapedText(dayName)}</td>
          <td>${totals.present || 0}</td>
          <td>${totals.absent || 0}</td>
          <td>${totals.leave || 0}</td>
          <td>${marked}</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Teacher Attendance Report - ${reportMonth}</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: Arial, sans-serif; color: #111; margin: 0; }
      .report { width: 100%; }
      .head { text-align: center; margin-bottom: 10px; }
      .head h1 { margin: 0; font-size: 20px; }
      .head .address { margin-top: 4px; font-size: 12px; color: #444; }
      .meta { display: flex; justify-content: space-between; font-size: 12px; margin: 8px 0 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #777; padding: 7px 8px; text-align: left; }
      th { background: #f1f5f9; }
      td:nth-child(n+2), th:nth-child(n+2) { text-align: center; }
      .summary { margin-top: 12px; font-size: 12px; }
      .summary strong { margin-right: 12px; }
      .daywise-title { margin: 14px 0 8px; font-size: 13px; }
      .footer { margin-top: 24px; font-size: 11px; color: #555; text-align: right; }
    </style>
  </head>
  <body>
    <div class="report">
      <div class="head">
        <h1>${schoolName}</h1>
        ${schoolAddress ? `<div class="address">${schoolAddress}</div>` : ''}
        <div><strong>Teacher Attendance Report</strong></div>
      </div>
      <div class="meta">
        <div><strong>Month:</strong> ${reportMonth}</div>
        <div><strong>Printed:</strong> ${printedAt}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Leave</th>
            <th>Marked Days</th>
            <th>Present %</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="summary">
        <strong>Total Present: ${totalPresent}</strong>
        <strong>Total Absent: ${totalAbsent}</strong>
        <strong>Total Leave: ${totalLeave}</strong>
        <strong>Total Marks: ${totalMarked}</strong>
      </div>
      <div class="daywise-title"><strong>Day-wise Attendance (This Month)</strong></div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Leave</th>
            <th>Marked</th>
          </tr>
        </thead>
        <tbody>${dayWiseRows || '<tr><td colspan="6" style="text-align:center;">No day-wise attendance records found for this month.</td></tr>'}</tbody>
      </table>
      <div class="footer">Generated from School Admin Portal</div>
    </div>
  </body>
  </html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the attendance report.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
}

function loadAttendanceForDate(date){
  const tbody = qs('#attendanceTableBody');
  if (!tbody) return;

  tbody.innerHTML = AppState.teachers.map(t => {
    const key = `${t.id}|${date}`;
    const att = AppState.teacherAttendance[key] || { status: 'absent', remarks: '' };
    return `
      <tr class="att-row" data-status="${att.status}">
        <td>${t.name}</td>
        <td class="att-status-cell">
          <select class="att-status" data-id="${t.id}">
            <option value="present" ${att.status === 'present' ? 'selected' : ''}>Present</option>
            <option value="absent" ${att.status === 'absent' ? 'selected' : ''}>Absent</option>
            <option value="leave" ${att.status === 'leave' ? 'selected' : ''}>Leave</option>
          </select>
        </td>
        <td>
          <input type="text" class="att-remarks att-remarks-input" data-id="${t.id}" value="${att.remarks || ''}" placeholder="Medical, etc." />
        </td>
      </tr>
    `;
  }).join('');

  qsa('select.att-status').forEach(sel => {
    const syncStyle = () => {
      const row = sel.closest('tr.att-row');
      const status = (sel.value || '').toLowerCase();
      if (row) row.setAttribute('data-status', status);
      sel.setAttribute('data-status', status);
    };
    syncStyle();
    sel.onchange = syncStyle;
  });
}

function saveAttendance(date){
  const hasExistingAttendance = (AppState.teachers || []).some(teacher => {
    const key = `${teacher.id}|${date}`;
    return !!AppState.teacherAttendance[key];
  });

  if (hasExistingAttendance) {
    const shouldUpdate = confirm(
      `⚠ Attendance marked before for ${date}.\n\nDo you want to update it?\n\nOK = Update attendance\nCancel = Keep previous attendance`
    );
    if (!shouldUpdate) {
      alert(`Attendance already marked before for ${date}. No changes were saved.`);
      return;
    }
  }

  qsa('select.att-status').forEach(sel => {
    const teacherId = sel.getAttribute('data-id');
    const status = sel.value;
    const remarks = qs(`.att-remarks[data-id="${teacherId}"]`)?.value || '';
    const key = `${teacherId}|${date}`;
    AppState.teacherAttendance[key] = { status, remarks };
  });
  saveState();
  renderMonthlyAttendanceSummary(teacherAttendanceMonthView || String(date || '').slice(0, 7) || currentMonth());
  alert('Attendance saved for ' + date);
}

function renderSalaryPayments(){
  const tbody = qs('#salaryTableBody');
  if (!tbody) return;

  const payments = AppState.salaryPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
  tbody.innerHTML = payments.slice(0, 50).map(p => {
    const teacher = AppState.teachers.find(t => String(t.id) === String(p.teacherId));
    return `
      <tr>
        <td>${teacher?.name || 'Unknown'}</td>
        <td>${p.month}</td>
        <td>${fmtINR(p.amount)}</td>
        <td>${p.date}</td>
        <td><span class="badge">${p.status}</span></td>
      </tr>
    `;
  }).join('');

  const monthInput = qs('#salaryMonth');
  if (monthInput && !monthInput.value) monthInput.value = currentMonth();

  const teacherSelect = qs('#salaryTeacherSelect');
  if (teacherSelect) {
    const prevValue = teacherSelect.value;
    teacherSelect.innerHTML = '<option value="">Select Teacher</option>';
    AppState.teachers
      .filter(t => t.status === 'active')
      .forEach(t => {
        const salary = Number(t.salary || 0);
        teacherSelect.innerHTML += `<option value="${t.id}">${t.name} (${fmtINR(salary)})</option>`;
      });
    teacherSelect.value = prevValue;
  }

  if (qs('#salaryBtnProcess')) qs('#salaryBtnProcess').onclick = () => processMonthlySalary(monthInput.value);
  if (qs('#salaryBtnPaySingle')) qs('#salaryBtnPaySingle').onclick = () => {
    const teacherId = qs('#salaryTeacherSelect')?.value;
    const customAmount = Number(qs('#salaryCustomAmount')?.value || 0);
    processSingleTeacherSalary(monthInput.value, teacherId, customAmount);
  };
}

function getMonthBounds(month){
  const [yearStr, monthStr] = String(month || '').split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return null;
  }

  const daysInMonth = new Date(year, monthNum, 0).getDate();
  return {
    monthStart: `${year}-${String(monthNum).padStart(2, '0')}-01`,
    monthEnd: `${year}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`,
    daysInMonth
  };
}

function daysBetweenInclusive(startYMD, endYMD){
  const start = new Date(`${startYMD}T00:00:00`);
  const end = new Date(`${endYMD}T00:00:00`);
  const diff = Math.floor((end - start) / 86400000);
  return diff >= 0 ? diff + 1 : 0;
}

function countTeacherAbsences(teacherId, startYMD, endYMD){
  const teacherKey = String(teacherId);
  let absentDays = 0;

  Object.entries(AppState.teacherAttendance || {}).forEach(([key, value]) => {
    const [attTeacherId, attDate] = key.split('|');
    if (String(attTeacherId) !== teacherKey) return;
    if (!attDate || attDate < startYMD || attDate > endYMD) return;
    if ((value?.status || '').toLowerCase() === 'absent') absentDays += 1;
  });

  return absentDays;
}

function calculateTeacherSalaryForMonth(teacher, month, customBaseSalary = null){
  const bounds = getMonthBounds(month);
  if (!bounds) {
    return { amount: 0, daysInMonth: 0, eligibleDays: 0, absentDays: 0, payableDays: 0 };
  }

  const baseSalary = Number(customBaseSalary > 0 ? customBaseSalary : (teacher?.salary || 0));
  if (!Number.isFinite(baseSalary) || baseSalary <= 0) {
    return { amount: 0, baseSalary: 0, daysInMonth: bounds.daysInMonth, eligibleDays: 0, absentDays: 0, payableDays: 0 };
  }

  const joinDate = (teacher?.joinDate || '').trim();
  const effectiveStart = joinDate && joinDate > bounds.monthStart ? joinDate : bounds.monthStart;

  if (effectiveStart > bounds.monthEnd) {
    return { amount: 0, baseSalary, daysInMonth: bounds.daysInMonth, eligibleDays: 0, absentDays: 0, payableDays: 0 };
  }

  const eligibleDays = daysBetweenInclusive(effectiveStart, bounds.monthEnd);
  const absentDays = Math.min(eligibleDays, countTeacherAbsences(teacher.id, effectiveStart, bounds.monthEnd));
  const payableDays = Math.max(0, eligibleDays - absentDays);
  const perDay = baseSalary / bounds.daysInMonth;
  const amount = Number((perDay * payableDays).toFixed(2));

  return {
    amount,
    baseSalary,
    daysInMonth: bounds.daysInMonth,
    eligibleDays,
    absentDays,
    payableDays
  };
}

function processMonthlySalary(month){
  if (!month) { alert('Please select a month'); return; }
  let count = 0;
  AppState.teachers.forEach(t => {
    if (t.status === 'active') {
      const exists = AppState.salaryPayments.some(p => String(p.teacherId) === String(t.id) && p.month === month);
      if (!exists) {
        const salaryCalc = calculateTeacherSalaryForMonth(t, month);
        const amount = Number(salaryCalc.amount || 0);
        if (amount <= 0) return;
        AppState.salaryPayments.push({
          id: 'sal_' + Date.now() + '_' + count++,
          teacherId: t.id,
          month: month,
          amount,
          date: todayYYYYMMDD(),
          status: 'paid',
          baseSalary: salaryCalc.baseSalary,
          daysInMonth: salaryCalc.daysInMonth,
          eligibleDays: salaryCalc.eligibleDays,
          absentDays: salaryCalc.absentDays,
          payableDays: salaryCalc.payableDays
        });
      }
    }
  });
  saveState();
  renderSalaryPayments();
  alert(`Salary processed for ${count} teachers in ${month}`);
}

function processSingleTeacherSalary(month, teacherId, customAmount){
  if (!month) { alert('Please select a month'); return; }
  if (!teacherId) { alert('Please select a teacher'); return; }

  const teacher = AppState.teachers.find(t => String(t.id) === String(teacherId));
  if (!teacher) { alert('Teacher not found'); return; }
  if (teacher.status !== 'active') { alert('Salary can only be processed for active teachers'); return; }

  const exists = AppState.salaryPayments.some(p => String(p.teacherId) === String(teacher.id) && p.month === month);
  if (exists) {
    alert(`Salary already processed for ${teacher.name} in ${month}`);
    return;
  }

  const salaryCalc = calculateTeacherSalaryForMonth(teacher, month, customAmount);
  const amount = Number(salaryCalc.amount || 0);
  if (amount <= 0) {
    alert('No payable salary for this month (check join date, base salary, or attendance).');
    return;
  }

  AppState.salaryPayments.push({
    id: 'sal_' + Date.now() + '_single',
    teacherId: teacher.id,
    month,
    amount,
    date: todayYYYYMMDD(),
    status: 'paid',
    baseSalary: salaryCalc.baseSalary,
    daysInMonth: salaryCalc.daysInMonth,
    eligibleDays: salaryCalc.eligibleDays,
    absentDays: salaryCalc.absentDays,
    payableDays: salaryCalc.payableDays
  });

  saveState();
  renderSalaryPayments();
  const customInput = qs('#salaryCustomAmount');
  if (customInput) customInput.value = '';
  alert(`Salary processed for ${teacher.name} (${month})`);
}

function openEditTeacher(teacherId){
  const teacher = AppState.teachers.find(t => String(t.id) === String(teacherId));
  if (!teacher) return;

  const form = qs('#formAddTeacher');
  form.dataset.editId = teacherId;

  qs('#teacherName').value = teacher.name;
  qs('#teacherPhone').value = teacher.phone;
  qs('#teacherEmail').value = teacher.email || '';
  qs('#teacherSubjects').value = teacher.subjects;
  qs('#teacherJoinDate').value = teacher.joinDate;
  qs('#teacherSalary').value = teacher.salary;
  qs('#teacherStatus').value = teacher.status;

  const header = qs('#modalAddTeacher .modal__header h3');
  header.textContent = 'Edit Teacher';
  const submitBtn = qs('#modalAddTeacher .modal__footer button[value="submit"]');
  submitBtn.textContent = 'Update';

  openModal('#modalAddTeacher');
}

function setupTeacherButtons(){
  // Tab switching
  qsa('#view-teachers .tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tabId = btn.getAttribute('data-tab');
      setActiveTeacherTab(tabId);
    };
  });

  if (qs('#teacherBtnAdd')) qs('#teacherBtnAdd').onclick = () => {
    delete qs('#formAddTeacher').dataset.editId;
    qs('#modalAddTeacher .modal__header h3').textContent = 'Add Teacher';
    qs('#modalAddTeacher .modal__footer button[value="submit"]').textContent = 'Save';
    qs('#formAddTeacher').reset();
    openModal('#modalAddTeacher');
  };

  if (qs('#teacherBtnExport')) qs('#teacherBtnExport').onclick = exportTeachersCSV;
}

function initAddTeacherModal(){
  const form = qs('#formAddTeacher');
  const isEditMode = !!form.dataset.editId;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const teacher = {
      name: qs('#teacherName').value.trim(),
      phone: qs('#teacherPhone').value.trim(),
      email: qs('#teacherEmail').value.trim(),
      subjects: qs('#teacherSubjects').value.trim(),
      joinDate: qs('#teacherJoinDate').value,
      salary: Number(qs('#teacherSalary').value),
      status: qs('#teacherStatus').value
    };

    const payload = {
      emp_id: 'EMP-' + Date.now(),
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      subject: teacher.subjects,
      qualification: '',
      date_of_joining: teacher.joinDate,
      address: '',
      salary: teacher.salary,
      status: teacher.status
    };

    try {
      if (!isServerConnected) throw new Error('Backend server appears offline');

      if (isEditMode) {
        const idx = AppState.teachers.findIndex(t => String(t.id) === String(form.dataset.editId));
        if (idx === -1) { alert('Teacher not found'); return; }
        const existing = AppState.teachers[idx];
        const isNumericId = /^\d+$/.test(String(existing.id));

        if (isNumericId) {
          const response = await fetchWithTimeout(`${API_URL}/teachers/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, emp_id: existing.emp_id || payload.emp_id })
          }, 10000);

          if (!response || !response.ok) {
            const body = await (response ? response.text() : Promise.resolve('no response'));
            throw new Error(`${response?.status || ''} ${body}`.trim());
          }

          AppState.teachers[idx] = { ...existing, ...teacher };
        } else {
          const response = await fetchWithTimeout(`${API_URL}/teachers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, emp_id: existing.emp_id || payload.emp_id })
          }, 10000);

          if (!response || !response.ok) {
            const body = await (response ? response.text() : Promise.resolve('no response'));
            throw new Error(`${response?.status || ''} ${body}`.trim());
          }

          const saved = await response.json();
          AppState.teachers[idx] = {
            id: saved.id,
            emp_id: saved.emp_id || payload.emp_id,
            ...teacher
          };
        }
      } else {
        const response = await fetchWithTimeout(`${API_URL}/teachers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 10000);

        if (!response || !response.ok) {
          const body = await (response ? response.text() : Promise.resolve('no response'));
          throw new Error(`${response?.status || ''} ${body}`.trim());
        }

        const saved = await response.json();
        AppState.teachers.push({
          id: saved.id,
          emp_id: saved.emp_id || payload.emp_id,
          ...teacher
        });
      }

      await fetchTeachersFromBackend();
      saveState();
      delete form.dataset.editId;
      form.parentElement.close();
      if (AppState.view === 'teachers') renderTeachers();
    } catch (err) {
      alert('Unable to save teacher to database: ' + err.message);
    }
  };
}

function exportTeachersCSV(){
  const header = ['id', 'name', 'phone', 'email', 'subjects', 'joinDate', 'salary', 'status'];
  const rows = AppState.teachers.map(t => [t.id, t.name, t.phone, t.email || '', t.subjects, t.joinDate, t.salary, t.status]);
  const csv = arrayToCSV([header, ...rows]);
  downloadFile('teachers.csv', csv);
}

function currentMonth(){
  return new Date().toISOString().slice(0, 7);
}

// ---------- Classes View ----------
function renderClasses(){
  renderClassesTable();
  setupClassButtons();
}

function renderClassesTable(){
  const classFilter = qs('#classFilterGrade')?.value || '';
  const teacherFilter = qs('#classFilterTeacher')?.value || '';
  const searchQuery = qs('#classSearch')?.value?.toLowerCase() || '';

  // Filter classes
  let filtered = AppState.classes.filter(c => {
    const matchClass = !classFilter || c.class === classFilter;
    const matchTeacher = !teacherFilter || c.classTeacherId === teacherFilter;
    const matchSearch = !searchQuery || `${c.class}-${c.section}`.toLowerCase().includes(searchQuery);
    return matchClass && matchTeacher && matchSearch;
  });

  // Update filters
  const grades = [...new Set(AppState.classes.map(c => c.class))].sort();
  const gradeSel = qs('#classFilterGrade');
  if (gradeSel) {
    const current = gradeSel.value;
    gradeSel.innerHTML = '<option value="">All Grades</option>';
    grades.forEach(g => gradeSel.innerHTML += `<option value="${g}">${g}</option>`);
    gradeSel.value = current;
  }

  const teachers = [...new Set(AppState.classes.map(c => c.classTeacherId))].filter(Boolean);
  const teacherSel = qs('#classFilterTeacher');
  if (teacherSel) {
    const current = teacherSel.value;
    teacherSel.innerHTML = '<option value="">All Teachers</option>';
    teachers.forEach(tId => {
      const teacher = AppState.teachers.find(t => t.id === tId);
      if (teacher) teacherSel.innerHTML += `<option value="${tId}">${teacher.name}</option>`;
    });
    teacherSel.value = current;
  }

  // Render table
  const tbody = qs('#classesTableBody');
  if (tbody) {
    tbody.innerHTML = filtered.map(cls => {
      const classTeacher = AppState.teachers.find(t => t.id === cls.classTeacherId);
      const classStudents = AppState.students.filter(s => s.class === cls.class && s.section === cls.section).length;
      const subjectCount = Object.keys(cls.subjects || {}).length;
      
      return `
        <tr>
          <td>${cls.class}</td>
          <td>${cls.section}</td>
          <td>${classTeacher?.name || '-'}</td>
          <td>${classStudents}</td>
          <td>${subjectCount} subjects</td>
          <td>${cls.capacity}</td>
          <td><span class="badge">${cls.status}</span></td>
          <td style="text-align:right;">
            <button class="btn btn-ghost small" data-act="editClass" data-id="${cls.id}">Edit</button>
            <button class="btn btn-ghost small" data-act="delClass" data-id="${cls.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    qsa('button[data-act="editClass"]').forEach(btn => {
      btn.onclick = () => openEditClass(btn.getAttribute('data-id'));
    });

    qsa('button[data-act="delClass"]').forEach(btn => {
      btn.onclick = () => {
        const classId = btn.getAttribute('data-id');
        const cls = AppState.classes.find(c => c.id === classId);
        if (!cls) return;
        if (!confirm(`Delete ${cls.class}-${cls.section}? This cannot be undone.`)) return;
        AppState.classes = AppState.classes.filter(c => c.id !== classId);
        saveState();
        renderClasses();
      };
    });
  }

  // Bind filter and search
  const bindFilterChange = () => renderClasses();
  qs('#classFilterGrade')?.addEventListener('change', bindFilterChange);
  qs('#classFilterTeacher')?.addEventListener('change', bindFilterChange);
  qs('#classSearch')?.addEventListener('input', bindFilterChange);
}

function setupClassButtons(){
  if (qs('#classBtnCreate')) qs('#classBtnCreate').onclick = () => {
    delete qs('#formCreateClass').dataset.editId;
    qs('#modalCreateClass .modal__header h3').textContent = 'Create Class';
    qs('#modalCreateClass .modal__footer button[value="submit"]').textContent = 'Create';
    qs('#formCreateClass').reset();
    initClassSubjectsForm();
    openModal('#modalCreateClass');
  };

  if (qs('#classBtnExport')) qs('#classBtnExport').onclick = exportClassesCSV;
}

function initClassSubjectsForm(){
  const wrap = qs('#classSubjectsWrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="grid-2" style="gap:8px;">
      <input type="text" class="subject-name" placeholder="Subject name" />
      <select class="subject-teacher">
        <option value="">Select Teacher</option>
      </select>
    </div>
  `;
  populateSubjectTeacherSelects();

  if (qs('#classBtnAddSubject')) {
    qs('#classBtnAddSubject').onclick = (e) => {
      e.preventDefault();
      const newRow = document.createElement('div');
      newRow.className = 'grid-2';
      newRow.style.gap = '8px';
      newRow.innerHTML = `
        <input type="text" class="subject-name" placeholder="Subject name" />
        <select class="subject-teacher">
          <option value="">Select Teacher</option>
        </select>
      `;
      wrap.appendChild(newRow);
      populateSubjectTeacherSelects();
    };
  }
}

function populateSubjectTeacherSelects(){
  qsa('.subject-teacher').forEach(sel => {
    const currentValue = sel.value;
    sel.innerHTML = '<option value="">Select Teacher</option>';
    AppState.teachers.forEach(t => {
      sel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
    sel.value = currentValue;
  });
}

function openEditClass(classId){
  const cls = AppState.classes.find(c => c.id === classId);
  if (!cls) return;

  const form = qs('#formCreateClass');
  form.dataset.editId = classId;

  qs('#className').value = cls.class;
  qs('#classSection').value = cls.section;
  qs('#classTeacher').value = cls.classTeacherId || '';
  qs('#classCapacity').value = cls.capacity;
  qs('#classStatus').value = cls.status;

  // Populate class teacher select
  const teacherSel = qs('#classTeacher');
  teacherSel.innerHTML = '';
  AppState.teachers.forEach(t => {
    teacherSel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
  });
  teacherSel.value = cls.classTeacherId || '';

  // Populate subjects
  const wrap = qs('#classSubjectsWrap');
  wrap.innerHTML = Object.entries(cls.subjects || {}).map(([subject, teacherId]) => `
    <div class="grid-2" style="gap:8px;">
      <input type="text" class="subject-name" value="${subject}" placeholder="Subject name" />
      <select class="subject-teacher" value="${teacherId}">
        <option value="">Select Teacher</option>
      </select>
    </div>
  `).join('');
  populateSubjectTeacherSelects();

  const header = qs('#modalCreateClass .modal__header h3');
  header.textContent = 'Edit Class';
  const submitBtn = qs('#modalCreateClass .modal__footer button[value="submit"]');
  submitBtn.textContent = 'Update';

  openModal('#modalCreateClass');
}

function initCreateClassModal(){
  const form = qs('#formCreateClass');
  const isEditMode = form.dataset.editId;

  // Populate class teacher select
  const teacherSel = qs('#classTeacher');
  if (!teacherSel.querySelector('option:not(:first-child)')) {
    AppState.teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      teacherSel.appendChild(opt);
    });
  }

  // Setup add subject button and init form
  if (!form.dataset.subjectsInitialized) {
    initClassSubjectsForm();
    form.dataset.subjectsInitialized = 'true';
  }

  form.onsubmit = (e) => {
    e.preventDefault();

    // Collect subjects
    const subjects = {};
    qsa('#classSubjectsWrap .grid-2').forEach(row => {
      const subject = row.querySelector('.subject-name').value.trim();
      const teacherId = row.querySelector('.subject-teacher').value;
      if (subject && teacherId) {
        subjects[subject] = teacherId;
      }
    });

    const cls = {
      class: qs('#className').value,
      section: qs('#classSection').value,
      classTeacherId: qs('#classTeacher').value,
      capacity: Number(qs('#classCapacity').value),
      subjects: subjects,
      status: qs('#classStatus').value
    };

    if (isEditMode) {
      const idx = AppState.classes.findIndex(c => c.id === form.dataset.editId);
      if (idx === -1) { alert('Class not found'); return; }
      AppState.classes[idx] = { ...AppState.classes[idx], ...cls };
    } else {
      cls.id = 'class_' + Date.now();
      AppState.classes.push(cls);
    }

    saveState();
    delete form.dataset.editId;
    form.parentElement.close();
    if (AppState.view === 'classes') renderClasses();
  };
}

function exportClassesCSV(){
  const header = ['class', 'section', 'classTeacher', 'capacity', 'subjects', 'status'];
  const rows = AppState.classes.map(c => {
    const teacher = AppState.teachers.find(t => t.id === c.classTeacherId);
    const subjectsStr = Object.keys(c.subjects || {}).join('; ');
    return [c.class, c.section, teacher?.name || '', c.capacity, subjectsStr, c.status];
  });
  const csv = arrayToCSV([header, ...rows]);
  downloadFile('classes.csv', csv);
}

// ---------- Transport View ----------
async function renderTransport() {
  // Load routes from backend if connected
  if (isServerConnected) {
    try {
      const response = await fetch(`${API_URL}/transport/routes`);
      if (response.ok) {
        const routes = await response.json();
        // Update AppState with backend data
        AppState.transport.routes = routes.map(r => ({
          id: r.id,
          name: r.route_name,
          route_name: r.route_name,
          fee_amount: r.fee_amount,
          destination: r.destination,
          route_description: r.route_description,
          status: r.status
        }));
      }
    } catch (err) {
      console.warn('Could not load transport routes:', err);
    }
  }

  // KPIs
  const trKpiRoutes = qs('#trKpiRoutes');
  if (trKpiRoutes) trKpiRoutes.textContent = String(AppState.transport.routes.length);
  const trKpiVehicles = qs('#trKpiVehicles');
  if (trKpiVehicles) trKpiVehicles.textContent = String(AppState.transport.vehicles.length);
  const trKpiAssigned = qs('#trKpiAssigned');
  if (trKpiAssigned) trKpiAssigned.textContent = String(AppState.transport.assignments.length);
  const feesEl = qs('#trKpiFeesMonth');
  if (feesEl) feesEl.textContent = fmtINR(AppState.transport.assignments.reduce((sum,a)=> sum + Number(a.fee||0), 0));

  // Filters
  const routeSel = qs('#trFilterRoute');
  if (routeSel) {
    routeSel.innerHTML = `<option value="">All Routes</option>` +
      AppState.transport.routes.map(r => `<option value="${r.id}">${r.name || r.route_name}</option>`).join('');
  }

  // Buttons
  const bind = (id, fn) => { const el = qs(id); if (el) el.onclick = fn; };
  bind('#trBtnAssign',      () => { if (openModal('#modalTrAssign'))  initTrAssignModal(); });
  bind('#trBtnAddRoute',    () => { if (openModal('#modalTrRoute'))   initTrRouteModal(); });
  bind('#trBtnAddVehicle',  () => { if (openModal('#modalTrVehicle')) initTrVehicleModal(); });
  bind('#trBtnImport',      () => { if (openModal('#modalTrImport'))  initTrImportModal(); });
  bind('#trBtnExport',      () => { if (openModal('#modalTrExport'))  initTrExportModal(); });
  bind('#trBtnRoutesCSV',   exportRoutesCSV);
  bind('#trBtnVehiclesCSV', exportVehiclesCSV);
  bind('#trBtnAssignmentsCSV', exportAssignmentsCSV);

  // Filters/search triggers
  const rerenderAll = () => { renderTrRoutesTable(); renderTrVehiclesTable(); renderTrAssignTable(); };
  const trSearch = qs('#trSearch');
  const trFilterRoute = qs('#trFilterRoute');
  const trFilterStatus = qs('#trFilterStatus');
  if (trSearch) trSearch.oninput = renderTrAssignTable;
  if (trFilterRoute) trFilterRoute.onchange = rerenderAll;
  if (trFilterStatus) trFilterStatus.onchange = rerenderAll;

  // Tables
  renderTrRoutesTable();
  renderTrVehiclesTable();
  renderTrAssignTable();
  initTransportMap();
}

function buildTransportMapEmbedUrl(query = '') {
  const normalized = String(query || '').trim() || 'Deoley Shekhpura';
  return `https://www.google.com/maps?q=${encodeURIComponent(normalized)}&output=embed`;
}

function initTransportMap() {
  const mapInput = qs('#trMapQuery');
  const mapFrame = qs('#trMapPreview');
  const btnUpdate = qs('#trBtnUpdateMap');
  const btnOpen = qs('#trBtnOpenMap');
  const routeFilter = qs('#trFilterRoute');
  if (!mapInput || !mapFrame || !btnUpdate || !btnOpen) return;

  const storageKey = 'kps_transport_map_query';
  const selectedRouteId = routeFilter?.value || '';
  const selectedRoute = AppState.transport.routes.find(r => String(r.id) === String(selectedRouteId));
  const fallbackFromRoute = selectedRoute
    ? `${selectedRoute.name || selectedRoute.route_name || ''} ${selectedRoute.destination || ''}`.trim()
    : '';

  const currentQuery = String(mapInput.value || '').trim();
  const savedQuery = localStorage.getItem(storageKey) || fallbackFromRoute || 'Deoley Shekhpura';
  const activeQuery = currentQuery || savedQuery;

  mapInput.value = activeQuery;
  mapFrame.src = buildTransportMapEmbedUrl(activeQuery);

  const applyMap = () => {
    const query = String(mapInput.value || '').trim() || fallbackFromRoute || 'Deoley Shekhpura';
    mapInput.value = query;
    mapFrame.src = buildTransportMapEmbedUrl(query);
    localStorage.setItem(storageKey, query);
  };

  btnUpdate.onclick = applyMap;
  btnOpen.onclick = () => {
    const query = String(mapInput.value || '').trim() || fallbackFromRoute || 'Deoley Shekhpura';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener');
  };

  mapInput.onkeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyMap();
    }
  };
}

function renderTrRoutesTable() {
  const body = qs('#trRoutesBody'); if (!body) return;
  const status = qs('#trFilterStatus')?.value || '';
  const rows = AppState.transport.routes.filter(r => !status || r.status?.toLowerCase() === status.toLowerCase());

  body.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${r.name || r.route_name}</strong></td>
      <td>${r.destination || '-'}</td>
      <td>₹${r.fee_amount || 0}/month</td>
      <td>${r.route_description || '-'}</td>
      <td><span class="badge ${r.status?.toLowerCase() === 'active' ? 'success' : 'warning'}">${r.status || 'Active'}</span></td>
      <td style="text-align:right;">
        <button class="btn btn-ghost small" data-act="editRoute" data-id="${r.id}">Edit</button>
        <button class="btn btn-ghost small" data-act="delRoute" data-id="${r.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  qsa('button[data-act="editRoute"]').forEach(b => {
    b.onclick = () => { if (openModal('#modalTrRoute')) initTrRouteModal(b.getAttribute('data-id')); };
  });
  qsa('button[data-act="delRoute"]').forEach(b => {
    b.onclick = async () => {
      const id = b.getAttribute('data-id');
      if (!confirm('Delete this transport route? Students assigned to it will be unassigned.')) return;
      
      if (isServerConnected) {
        try {
          const response = await fetch(`${API_URL}/transport/routes/${id}`, {
            method: 'DELETE'
          });
          if (!response.ok) {
            throw new Error('Failed to delete route');
          }
        } catch (err) {
          alert('Failed to delete route: ' + err.message);
          return;
        }
      }
      
      AppState.transport.routes = AppState.transport.routes.filter(x => x.id != id);
      saveState();
      renderTransport();
    };
  });
}

function renderTrVehiclesTable() {
  const body = qs('#trVehiclesBody'); if (!body) return;
  const status = qs('#trFilterStatus')?.value || '';
  const routeId = qs('#trFilterRoute')?.value || '';
  const nameById = id => (AppState.transport.routes.find(r => r.id === id)?.name || '');

  const rows = AppState.transport.vehicles.filter(v =>
    (!status || v.status === status) && (!routeId || v.routeId === routeId));

  body.innerHTML = rows.map(v => `
    <tr>
      <td>${v.label}</td>
      <td>${v.reg}</td>
      <td>${v.capacity}</td>
      <td>${v.driverName}</td>
      <td>${v.driverPhone}</td>
      <td>${nameById(v.routeId)}</td>
      <td><span class="badge">${v.status}</span></td>
      <td style="text-align:right;">
        <button class="btn btn-ghost small" data-act="editVehicle" data-id="${v.id}">Edit</button>
        <button class="btn btn-ghost small" data-act="delVehicle" data-id="${v.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  qsa('button[data-act="editVehicle"]').forEach(b => {
    b.onclick = () => { if (openModal('#modalTrVehicle')) initTrVehicleModal(b.getAttribute('data-id')); };
  });
  qsa('button[data-act="delVehicle"]').forEach(b => {
    b.onclick = () => {
      const id = b.getAttribute('data-id');
      if (!confirm('Delete vehicle?')) return;
      AppState.transport.vehicles = AppState.transport.vehicles.filter(x => x.id !== id);
      saveState();
      renderTransport();
    };
  });
}

function renderTrAssignTable() {
  const body = qs('#trAssignBody'); if (!body) return;
  const q = (qs('#trSearch')?.value || '').toLowerCase();
  const routeId = qs('#trFilterRoute')?.value || '';
  const status = qs('#trFilterStatus')?.value || '';
  const routeName = id => (AppState.transport.routes.find(r => r.id === id)?.name || '');
  const student = roll => AppState.students.find(s => s.roll === roll) || {};

  let rows = [...AppState.transport.assignments];
  rows = rows.filter(a => (!routeId || a.routeId === routeId) && (!status || a.status === status));
  if (q) {
    rows = rows.filter(a => {
      const s = student(a.roll);
      return (s.name||'').toLowerCase().includes(q) ||
             (s.roll||'').toLowerCase().includes(q) ||
             (a.stop||'').toLowerCase().includes(q) ||
             (routeName(a.routeId).toLowerCase().includes(q));
    });
  }

  body.innerHTML = rows.map(a => {
    const s = student(a.roll);
    return `
      <tr>
        <td>${s.roll || a.roll}</td>
        <td>${s.name || '-'}</td>
        <td>${s.class || '-'}</td>
        <td>${s.phone || '-'}</td>
        <td>${routeName(a.routeId)}</td>
        <td>${a.stop}</td>
        <td>${fmtINR(a.fee)}</td>
        <td><span class="badge">${a.status}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-ghost small" data-act="editAssign" data-roll="${a.roll}">Edit</button>
          <button class="btn btn-ghost small" data-act="delAssign" data-roll="${a.roll}">Remove</button>
        </td>
      </tr>
    `;
  }).join('');

  qsa('button[data-act="editAssign"]').forEach(b => {
    b.onclick = () => {
      const roll = b.getAttribute('data-roll');
      if (openModal('#modalTrAssign')) initTrAssignModal(roll);
    };
  });
  qsa('button[data-act="delAssign"]').forEach(b => {
    b.onclick = () => {
      const roll = b.getAttribute('data-roll');
      if (!confirm('Remove assignment?')) return;
      AppState.transport.assignments = AppState.transport.assignments.filter(x => x.roll !== roll);
      saveState();
      renderTransport();
    };
  });
}

// --- Transport Modals ---
function initTrAssignModal(editRoll) {
  const form    = qs('#formTrAssign');
  const rollEl  = qs('#trAssignRoll');
  const routeEl = qs('#trAssignRoute');
  const stopEl  = qs('#trAssignStop');
  const feeEl   = qs('#trAssignFee');
  const statusEl= qs('#trAssignStatus');

  // Routes
  routeEl.innerHTML = AppState.transport.routes
    .map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  if (!routeEl.value && AppState.transport.routes.length) {
    routeEl.value = AppState.transport.routes[0].id;
  }

  function syncStops() {
    const r = AppState.transport.routes.find(x => x.id === routeEl.value);
    const stops = (r?.stops || []);
    stopEl.innerHTML = stops.map(s => `<option value="${s}">${s}</option>`).join('');
    if (!stopEl.value && stops.length) stopEl.value = stops[0];
  }
  routeEl.onchange = syncStops;
  syncStops();

  // Edit vs new
  if (editRoll) {
    const a = AppState.transport.assignments.find(x => x.roll === editRoll);
    rollEl.value = editRoll; rollEl.disabled = true;
    if (a?.routeId) { routeEl.value = a.routeId; syncStops(); }
    if (a?.stop) stopEl.value = a.stop;
    feeEl.value = a?.fee ?? 0;
    statusEl.value = a?.status ?? 'active';
  } else {
    rollEl.disabled = false; rollEl.value = '';
    feeEl.value = 0; statusEl.value = 'active';
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const roll = rollEl.value.trim();
    if (!roll) { alert('Roll required'); return; }
    if (!AppState.students.some(s => s.roll === roll)) { alert('Invalid roll'); return; }

    const data = {
      roll,
      routeId: routeEl.value,
      stop: stopEl.value,
      fee: Number(feeEl.value || 0),
      status: statusEl.value || 'active'
    };

    const idx = AppState.transport.assignments.findIndex(x => x.roll === roll);
    if (idx >= 0) AppState.transport.assignments[idx] = data;
    else AppState.transport.assignments.push(data);

    saveState();
    form.parentElement.close();
    renderTransport();
  };
}

async function initTrRouteModal(editId) {
  const form = qs('#formTrRoute');
  const idEl = qs('#trRouteId');
  const nameEl = qs('#trRouteName');
  const feeEl = qs('#trRouteFee');
  const destEl = qs('#trRouteDestination');
  const descEl = qs('#trRouteDescription');
  const statusEl = qs('#trRouteStatus');
  const headerEl = qs('#modalTrRoute .modal__header h3');

  if (editId) {
    headerEl.textContent = 'Edit Transport Route';
    // Load route data from backend
    try {
      const response = await fetch(`${API_URL}/transport/routes`);
      if (response.ok) {
        const routes = await response.json();
        const r = routes.find(x => x.id === editId);
        if (r) {
          idEl.value = r.id;
          nameEl.value = r.route_name;
          feeEl.value = r.fee_amount;
          destEl.value = r.destination || '';
          descEl.value = r.route_description || '';
          statusEl.value = r.status || 'Active';
        }
      }
    } catch (err) {
      console.warn('Could not load route data:', err);
    }
  } else {
    headerEl.textContent = 'Add Transport Route';
    idEl.value = '';
    nameEl.value = '';
    feeEl.value = '';
    destEl.value = '';
    descEl.value = '';
    statusEl.value = 'Active';
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!isServerConnected) {
      alert('Cannot save route because backend server is offline.');
      return;
    }

    const data = {
      route_name: nameEl.value.trim(),
      fee_amount: parseFloat(feeEl.value),
      destination: destEl.value.trim() || null,
      route_description: descEl.value.trim() || null,
      vehicle_id: null,
      status: statusEl.value
    };

    if (!data.route_name || !data.fee_amount) {
      alert('Route name and fee amount are required');
      return;
    }

    try {
      let response;
      if (editId) {
        response = await fetch(`${API_URL}/transport/routes/${editId}`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(data)
        });
      } else {
        response = await fetch(`${API_URL}/transport/routes`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(data)
        });
      }

      if (!response.ok) {
        throw new Error(await response.text());
      }

      form.parentElement.close();
      renderTransport();
      // Reload routes in Add Student form if it's open
      loadTransportRoutesIntoForm();
    } catch (err) {
      alert('Failed to save route: ' + err.message);
    }
  };
}

function initTrVehicleModal(editId) {
  const form = qs('#formTrVehicle');
  const idEl = qs('#trVehicleId');
  const labelEl = qs('#trVehicleLabel');
  const regEl = qs('#trVehicleReg');
  const capEl = qs('#trVehicleCap');
  const dNameEl = qs('#trDriverName');
  const dPhoneEl = qs('#trDriverPhone');
  const routeEl = qs('#trVehicleRoute');
  const statusEl = qs('#trVehicleStatus');

  routeEl.innerHTML = `<option value="">(none)</option>` +
    AppState.transport.routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  if (editId) {
    const v = AppState.transport.vehicles.find(x => x.id === editId);
    if (v) {
      idEl.value = v.id; idEl.disabled = true;
      labelEl.value = v.label; regEl.value = v.reg; capEl.value = v.capacity;
      dNameEl.value = v.driverName; dPhoneEl.value = v.driverPhone;
      routeEl.value = v.routeId || ''; statusEl.value = v.status || 'active';
    }
  } else {
    idEl.disabled = false; idEl.value = '';
    labelEl.value = ''; regEl.value = ''; capEl.value = 40;
    dNameEl.value = ''; dPhoneEl.value = ''; routeEl.value = '';
    statusEl.value = 'active';
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const data = {
      id: idEl.value.trim(),
      label: labelEl.value.trim(),
      reg: regEl.value.trim(),
      capacity: Number(capEl.value || 0),
      driverName: dNameEl.value.trim(),
      driverPhone: dPhoneEl.value.trim(),
      routeId: routeEl.value || '',
      status: statusEl.value
    };
    if (!data.id || !data.label || !data.reg) { alert('Vehicle ID, label, reg no. required'); return; }
    const idx = AppState.transport.vehicles.findIndex(x => x.id === data.id);
    if (idx >= 0) AppState.transport.vehicles[idx] = data;
    else AppState.transport.vehicles.push(data);
    saveState();
    form.parentElement.close();
    renderTransport();
  };
}

// Transport Import / Export
function initTrImportModal() {
  const form = qs('#formTrImport');
  const fileInput = qs('#trImportFile');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const file = fileInput.files?.[0];
    if (!file) { alert('Select a CSV file'); return; }
    const text = await file.text();
    const rows = text.trim().split(/\r?\n/).map(line =>
      line.split(',').map(cell => cell.replace(/^"|"$/g,'').replace(/""/g,'"'))
    );
    const [header, ...dataRows] = rows;
    const hmap = Object.fromEntries(header.map((h,i)=> [h.trim().toLowerCase(), i]));

    if (hmap['routeid'] && hmap['name']) {
      // Routes
      dataRows.forEach(r => {
        const id = r[hmap['routeid']].trim();
        const name = r[hmap['name']].trim();
        const pickup = r[hmap['pickup']] || '';
        const drop = r[hmap['drop']] || '';
        const stops = (r[hmap['stops']] || '').split('|').map(x=>x.trim()).filter(Boolean);
        const status = (r[hmap['status']] || 'active').trim();
        const idx = AppState.transport.routes.findIndex(x => x.id === id);
        const obj = { id, name, pickup, drop, stops, status };
        if (idx >= 0) AppState.transport.routes[idx] = obj; else AppState.transport.routes.push(obj);
      });
    } else if (hmap['vehicleid'] && hmap['reg']) {
      // Vehicles
      dataRows.forEach(r => {
        const id = r[hmap['vehicleid']].trim();
        const label = r[hmap['label']]?.trim() || id;
        const reg = r[hmap['reg']].trim();
        const capacity = Number(r[hmap['capacity']] || 0);
        const driverName = r[hmap['drivername']] || '';
        const driverPhone = r[hmap['driverphone']] || '';
        const routeId = r[hmap['routeid']] || '';
        const status = (r[hmap['status']] || 'active').trim();
        const idx = AppState.transport.vehicles.findIndex(x => x.id === id);
        const obj = { id, label, reg, capacity, driverName, driverPhone, routeId, status };
        if (idx >= 0) AppState.transport.vehicles[idx] = obj; else AppState.transport.vehicles.push(obj);
      });
    } else if (hmap['roll'] && hmap['routeid'] && hmap['stop']) {
      // Assignments
      dataRows.forEach(r => {
        const roll = r[hmap['roll']].trim();
        const routeId = r[hmap['routeid']].trim();
        const stop = r[hmap['stop']].trim();
        const fee = Number(r[hmap['fee']] || 0);
        const status = (r[hmap['status']] || 'active').trim();
        const idx = AppState.transport.assignments.findIndex(x => x.roll === roll);
        const obj = { roll, routeId, stop, fee, status };
        if (idx >= 0) AppState.transport.assignments[idx] = obj; else AppState.transport.assignments.push(obj);
      });
    } else {
      alert('Unknown CSV template. Expected routes/vehicles/assignments headers.');
      return;
    }
    saveState();
    form.parentElement.close();
    renderTransport();
  };
}

function initTrExportModal() {
  const form = qs('#formTrExport');
  const chkRoutes = qs('#exportRoutes');
  const chkVehicles = qs('#exportVehicles');
  const chkAssignments = qs('#exportAssignments');
  form.onsubmit = (e)=>{
    e.preventDefault();
    if (chkRoutes?.checked)      exportRoutesCSV();
    if (chkVehicles?.checked)    exportVehiclesCSV();
    if (chkAssignments?.checked) exportAssignmentsCSV();
    form.parentElement.close();
  };
}

function exportRoutesCSV() {
  const header = ['routeId','name','pickup','drop','stops','status'];
  const rows = AppState.transport.routes.map(r =>
    [r.id, r.name, r.pickup||'', r.drop||'', (r.stops||[]).join('|'), r.status||'active']
  );
  const csv = arrayToCSV([header, ...rows]);
  downloadFile('transport_routes.csv', csv);
}
function exportVehiclesCSV() {
  const header = ['vehicleId','label','reg','capacity','driverName','driverPhone','routeId','status'];
  const rows = AppState.transport.vehicles.map(v =>
    [v.id, v.label, v.reg, v.capacity, v.driverName, v.driverPhone, v.routeId||'', v.status||'active']
  );
  const csv = arrayToCSV([header, ...rows]);
  downloadFile('transport_vehicles.csv', csv);
}
function exportAssignmentsCSV() {
  const header = ['roll','routeId','stop','fee','status'];
  const rows = AppState.transport.assignments.map(a =>
    [a.roll, a.routeId, a.stop, a.fee, a.status||'active']
  );
  const csv = arrayToCSV([header, ...rows]);
  downloadFile('transport_assignments.csv', csv);
}

// ---------- Settings ----------
function renderSettings() {
  // Grabs
  const setTheme = qs('#setTheme');
  const setCurrency = qs('#setCurrency');
  const setLocale = qs('#setLocale');
  const setStudentsPageSize = qs('#setStudentsPageSize');
  const setDefaultFeesMonth = qs('#setDefaultFeesMonth');
  const setApiBaseUrl = qs('#setApiBaseUrl');
  const setChartAnimation = qs('#setChartAnimation');

  const saveBtn = qs('#settingsSaveBtn');
  const exportBtn = qs('#settingsExportBackupBtn');
  const importInput = qs('#settingsImportBackupInput');
  const resetBtn = qs('#settingsResetBtn');

  // School profile fields
  const setSchoolName    = qs('#setSchoolName');
  const setSchoolTagline = qs('#setSchoolTagline');
  const setSchoolAddress = qs('#setSchoolAddress');
  const setSchoolPhone   = qs('#setSchoolPhone');
  const setSchoolEmail   = qs('#setSchoolEmail');
  const setSchoolLogo    = qs('#setSchoolLogo');
  const credentialCard = qs('#settingsCredentialCard');
  const saveCredentialsBtn = qs('#settingsSaveCredentialsBtn');
  const setMainAdminUsername = qs('#setMainAdminUsername');
  const setMainAdminPassword = qs('#setMainAdminPassword');
  const setReceptionUsername = qs('#setReceptionUsername');
  const setReceptionPassword = qs('#setReceptionPassword');

  if (!setTheme || !setCurrency || !setLocale || !setStudentsPageSize || !setChartAnimation) {
    console.error('Missing required settings elements');
    return;
  }

  // Load current values into controls
  setTheme.value = AppState.settings.theme || 'system';
  setCurrency.value = AppState.settings.currency || '₹';
  setLocale.value = AppState.settings.locale || 'en-IN';
  setStudentsPageSize.value = AppState.settings.studentsPageSize || 10;
  setChartAnimation.checked = !!AppState.settings.chartAnimation;

  if (setDefaultFeesMonth && AppState.settings.defaultFeesMonth) {
    setDefaultFeesMonth.value = AppState.settings.defaultFeesMonth;
  } else {
    setDefaultFeesMonth.value = '';
  }

  if (setApiBaseUrl) {
    setApiBaseUrl.value = localStorage.getItem('API_URL_OVERRIDE') || '';
  }

  const sch = AppState.settings.school || {};
  if (setSchoolName) setSchoolName.value    = sch.name    || '';
  if (setSchoolTagline) setSchoolTagline.value = sch.tagline || '';
  if (setSchoolAddress) setSchoolAddress.value = sch.address || '';
  if (setSchoolPhone) setSchoolPhone.value   = sch.phone   || '';
  if (setSchoolEmail) setSchoolEmail.value   = sch.email   || '';
  if (setSchoolLogo) setSchoolLogo.value    = sch.logo    || '';

  const isMainAdmin = getUserRole() === 'admin' && getAdminPanelRole() === 'main_admin';
  if (credentialCard) credentialCard.style.display = isMainAdmin ? '' : 'none';

  const managedCredentials = getManagedCredentials();
  if (setMainAdminUsername) setMainAdminUsername.value = managedCredentials?.main_admin?.username || '';
  if (setMainAdminPassword) setMainAdminPassword.value = managedCredentials?.main_admin?.password || '';
  if (setReceptionUsername) setReceptionUsername.value = managedCredentials?.reception?.username || '';
  if (setReceptionPassword) setReceptionPassword.value = managedCredentials?.reception?.password || '';

  // Save settings handler
  if (saveBtn) saveBtn.onclick = () => {
    const previousApiOverride = (localStorage.getItem('API_URL_OVERRIDE') || '').trim();
    const nextApiOverride = (setApiBaseUrl?.value || '').trim().replace(/\/+$/, '');

    const pageSize = Math.max(5, Number(setStudentsPageSize.value || 10));
    AppState.settings.theme = setTheme.value;
    AppState.settings.currency = (setCurrency.value || '₹').trim();
    AppState.settings.locale = setLocale.value || 'en-IN';
    AppState.settings.studentsPageSize = pageSize;
    AppState.settings.defaultFeesMonth = setDefaultFeesMonth?.value || null;
    AppState.settings.chartAnimation = !!setChartAnimation.checked;

    // School profile
    AppState.settings.school = {
      name:    (setSchoolName?.value || '').trim(),
      tagline: (setSchoolTagline?.value || '').trim(),
      address: (setSchoolAddress?.value || '').trim(),
      phone:   (setSchoolPhone?.value || '').trim(),
      email:   (setSchoolEmail?.value || '').trim(),
      logo:    (setSchoolLogo?.value || '').trim()
    };

    // Apply immediately
    applyThemeFromSettings();
    applySchoolBranding();

    // Apply student page size immediately if view open
    if (AppState.view === 'students') {
      AppState.pagination.students.page = 1;
      AppState.pagination.students.pageSize = pageSize;
      renderStudents();
    }

    // Rebuild dashboard charts if open (for animation toggle)
    if (AppState.view === 'dashboard') renderDashboard();

    if (nextApiOverride) {
      localStorage.setItem('API_URL_OVERRIDE', nextApiOverride);
    } else {
      localStorage.removeItem('API_URL_OVERRIDE');
    }

    saveState();

    if (previousApiOverride !== nextApiOverride) {
      alert('Settings saved. API URL updated. The page will reload now.');
      window.location.reload();
      return;
    }

    alert('Settings saved.');
  };

  if (saveCredentialsBtn) saveCredentialsBtn.onclick = () => {
    const canManageCredentials = getUserRole() === 'admin' && getAdminPanelRole() === 'main_admin';
    if (!canManageCredentials) {
      alert('Only Main Admin can change usernames and passwords.');
      return;
    }

    const mainAdminUsername = (setMainAdminUsername?.value || '').trim();
    const mainAdminPassword = (setMainAdminPassword?.value || '').trim();
    const receptionUsername = (setReceptionUsername?.value || '').trim();
    const receptionPassword = (setReceptionPassword?.value || '').trim();

    if (!mainAdminUsername || !mainAdminPassword || !receptionUsername || !receptionPassword) {
      alert('Please fill all credential fields.');
      return;
    }

    if (mainAdminPassword.length < 4 || receptionPassword.length < 4) {
      alert('Passwords must be at least 4 characters.');
      return;
    }

    const payload = {
      main_admin: { username: mainAdminUsername, password: mainAdminPassword },
      reception: { username: receptionUsername, password: receptionPassword },
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(MANAGED_CREDENTIALS_KEY, JSON.stringify(payload));
    alert('Login credentials updated successfully.');
  };

  // Export backup (as JSON)
  if (exportBtn) exportBtn.onclick = () => {
    const now = new Date();
    const stamp = now.toISOString().slice(0,19).replace(/[:T]/g,'-');
    const payload = {
      version: '1.0.0',
      exportedAt: now.toISOString(),
      state: AppState
    };
    const json = JSON.stringify(payload, null, 2);
    downloadFile(`khushi_portal_backup_${stamp}.json`, json, 'application/json');
  };

  // Import backup (JSON)
  if (importInput) importInput.onchange = async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload?.state) {
        alert('Invalid backup file.');
        return;
      }
      Object.assign(AppState, payload.state);
      saveState();
      applyThemeFromSettings();
      applySchoolBranding();
      switchView(AppState.view || 'dashboard');
      alert('Backup imported successfully.');
    } catch (e) {
      console.error(e);
      alert('Failed to import backup.');
    } finally {
      importInput.value = '';
    }
  };

  // Reset data (danger)
  if (resetBtn) resetBtn.onclick = () => {
    if (!confirm('This will clear all app data (localStorage). Continue?')) return;
    localStorage.removeItem(STORAGE_KEY);
    // Re-seed & reload
    seedDemoData();
    saveState();
    applyThemeFromSettings();
    applySchoolBranding();
    switchView('dashboard');
    alert('App data has been reset.');
  };
}

// ---------- Notices ----------
function renderNotices() {
  // KPIs
  const noticeKpiTotal = qs('#noticeKpiTotal');
  if (noticeKpiTotal) noticeKpiTotal.textContent = String(AppState.notices.length);
  const noticeKpiActive = qs('#noticeKpiActive');
  if (noticeKpiActive) noticeKpiActive.textContent = String(AppState.notices.filter(n => n.status === 'active').length);
  const noticeKpiHighPriority = qs('#noticeKpiHighPriority');
  if (noticeKpiHighPriority) noticeKpiHighPriority.textContent = String(AppState.notices.filter(n => n.priority === 'high').length);

  // Filters
  const statusSel = qs('#noticeFilterStatus');
  const prioritySel = qs('#noticeFilterPriority');
  const audienceSel = qs('#noticeFilterAudience');
  const searchInput = qs('#noticeSearch');

  // Buttons
  const bind = (id, fn) => { const el = qs(id); if (el) el.onclick = fn; };
  bind('#noticeBtnCreate', () => { if (openModal('#modalCreateNotice')) initNoticeModal(); });
  bind('#noticeBtnExport', exportNoticesCSV);

  // Filters/search triggers
  const renderTable = () => renderNoticesTable();
  if (searchInput) searchInput.oninput = renderTable;
  if (statusSel) statusSel.onchange = renderTable;
  if (prioritySel) prioritySel.onchange = renderTable;
  if (audienceSel) audienceSel.onchange = renderTable;

  // Tables
  renderNoticesTable();
}

function renderNoticesTable() {
  const body = qs('#noticesTableBody');
  if (!body) return;

  const status = qs('#noticeFilterStatus')?.value || '';
  const priority = qs('#noticeFilterPriority')?.value || '';
  const audience = qs('#noticeFilterAudience')?.value || '';
  const searchTerm = (qs('#noticeSearch')?.value || '').toLowerCase();

  let rows = [...AppState.notices];
  rows = rows.filter(n => (!status || n.status === status) && 
                          (!priority || n.priority === priority) && 
                          (!audience || n.audience === audience) &&
                          (!searchTerm || n.title.toLowerCase().includes(searchTerm) || n.description.toLowerCase().includes(searchTerm)));

  body.innerHTML = rows.map(n => `
    <tr>
      <td><strong>${escapedText(n.title)}</strong></td>
      <td>${escapedText(n.description.substring(0, 50))}${n.description.length > 50 ? '...' : ''}</td>
      <td>${escapedText(n.author)}</td>
      <td>${n.date || '-'}</td>
      <td><span class="badge ${n.priority === 'high' ? 'danger' : n.priority === 'low' ? 'info' : ''}">${n.priority}</span></td>
      <td>${n.audience}</td>
      <td><span class="badge">${n.status}</span></td>
      <td style="text-align:right;">
        <button class="btn btn-ghost small" data-act="editNotice" data-id="${n.id}">Edit</button>
        <button class="btn btn-ghost small" data-act="delNotice" data-id="${n.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  qsa('button[data-act="editNotice"]').forEach(b => {
    b.onclick = () => { if (openModal('#modalCreateNotice')) initNoticeModal(b.getAttribute('data-id')); };
  });
  qsa('button[data-act="delNotice"]').forEach(b => {
    b.onclick = () => {
      const id = b.getAttribute('data-id');
      if (!confirm('Delete notice?')) return;
      AppState.notices = AppState.notices.filter(x => x.id !== id);
      saveState();
      renderNotices();
    };
  });
}

function initNoticeModal(noticeId = null) {
  const form = qs('#formCreateNotice');
  const modal = qs('#modalCreateNotice');
  if (!form) return;

  const titleInput = qs('#noticeTitle');
  const descInput = qs('#noticeDescription');
  const authorInput = qs('#noticeAuthor');
  const dateInput = qs('#noticeDate');
  const priorityInput = qs('#noticePriority');
  const audienceInput = qs('#noticeAudience');
  const statusInput = qs('#noticeStatus');
  const header = modal?.querySelector('.modal__header h3');

  if (noticeId) {
    // Edit mode
    const notice = AppState.notices.find(n => n.id === noticeId);
    if (!notice) return;

    if (header) header.textContent = 'Edit Notice';
    if (titleInput) titleInput.value = notice.title;
    if (descInput) descInput.value = notice.description;
    if (authorInput) authorInput.value = notice.author;
    if (dateInput) dateInput.value = notice.date;
    if (priorityInput) priorityInput.value = notice.priority;
    if (audienceInput) audienceInput.value = notice.audience;
    if (statusInput) statusInput.value = notice.status;
    form.dataset.noticeId = noticeId;
  } else {
    // Create mode
    if (header) header.textContent = 'Create Notice';
    if (dateInput) dateInput.value = todayYYYYMMDD();
    form.reset();
    form.dataset.noticeId = '';
  }

  // Handle form submission
  form.onsubmit = (e) => {
    e.preventDefault();
    const title = titleInput?.value.trim();
    const description = descInput?.value.trim();
    const author = authorInput?.value.trim();
    const date = dateInput?.value;
    const priority = priorityInput?.value || 'medium';
    const audience = audienceInput?.value || 'all';
    const status = statusInput?.value || 'active';

    if (!title || !description || !author || !date) {
      alert('Please fill in all required fields');
      return;
    }

    if (form.dataset.noticeId) {
      // Update existing notice
      const notice = AppState.notices.find(n => n.id === form.dataset.noticeId);
      if (notice) {
        notice.title = title;
        notice.description = description;
        notice.author = author;
        notice.date = date;
        notice.priority = priority;
        notice.audience = audience;
        notice.status = status;
      }
    } else {
      // Create new notice
      const newNotice = {
        id: 'notice-' + Date.now(),
        title,
        description,
        author,
        date,
        priority,
        audience,
        status
      };
      AppState.notices.push(newNotice);
    }

    saveState();
    renderNotices();
    modal?.close();
  };
}

function exportNoticesCSV() {
  const rows = [];
  rows.push(['Title', 'Description', 'Author', 'Date', 'Priority', 'Audience', 'Status']);
  AppState.notices.forEach(n => {
    rows.push([n.title, n.description, n.author, n.date, n.priority, n.audience, n.status]);
  });
  const csv = arrayToCSV(rows);
  downloadFile('notices_export.csv', csv);
}

function escapedText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Quick Actions ----------
function initQuickAdd(){
  const btnQuickAdd = qs('#btnQuickAdd');
  if (btnQuickAdd) {
    btnQuickAdd.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModal('#modalAddStudent');
    };
  }
}

function initFeePaymentButton(){
  const btnFeePayment = qs('#btnFeePayment');
  if (!btnFeePayment) return;

  const panelRole = getAdminPanelRole();
  const isAdminLike =
    getUserRole() === 'admin' ||
    sessionStorage.getItem('userType') === 'admin' ||
    panelRole === 'main_admin' ||
    panelRole === 'reception';

  btnFeePayment.style.display = isAdminLike ? '' : 'none';
  if (!isAdminLike) return;

  btnFeePayment.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const opened = openModal('#modalRecordPayment');
    if (opened) return;

    switchView('fees');
    window.setTimeout(() => {
      openModal('#modalRecordPayment');
    }, 180);
  };
}

function initNotifications(){
  const btnNotifications = qs('#btnNotifications');
  if (btnNotifications) {
    btnNotifications.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      alert('No new notifications.');
    };
  }
}

// ---------- Init ----------
function init(){
  console.log('🚀 Initializing School Admin Portal...');
  
  try {
    // Initialize authentication FIRST (this sets up basic button handlers)
    console.log('[init] initializeAuth');
    initializeAuth();
    
    // attach login handlers only if login page is still present
    if (document.getElementById('loginPage')) {
      console.log('[init] initLoginHandlers');
      initLoginHandlers();
    }
    
    // start server connection monitoring right away so views can delete/add etc
    console.log('[init] startServerStatusCheck');
    startServerStatusCheck();
    
    // Load state (including data fetch)
    console.log('[init] loadState');
    loadState();
    
    // Theme setup
    console.log('[init] applyThemeFromSettings');
    applyThemeFromSettings();
    console.log('[init] applySchoolBranding');
    applySchoolBranding();
    console.log('[init] initThemeToggle');
    initThemeToggle();
    console.log('[init] initTopbarGlobalSearch');
    initTopbarGlobalSearch();
    console.log('[init] initTopbarDayPill');
    initTopbarDayPill();
    
    // Role-based initialization
    if (isAuthenticated()) {
      const role = getUserRole();
      console.log('✅ User authenticated as:', role);
      
      if (role === 'admin') {
        console.log('📊 Initializing Admin Portal...');
        try {
          initSidebarNavigation();
          applyAdminPanelPermissions();
        } catch (e) {
          console.error('⚠️ Sidebar init error:', e);
        }
        
        try {
          initQuickAdd();
        } catch (e) {
          console.error('⚠️ Quick add init error:', e);
        }

        try {
          initFeePaymentButton();
        } catch (e) {
          console.error('⚠️ Fee payment button init error:', e);
        }
        
        try {
          initNotifications();
        } catch (e) {
          console.error('⚠️ Notifications init error:', e);
        }
        
        // Initialize modals with error handling
        try {
          initAddStudentModal();
          initImportCSVModal();
          initRecordPaymentModal();
          initFeeHeadsModal();
          initLateRulesModal();
          initConcessionModal();
          console.log('✅ Modals initialized');
        } catch (e) {
          console.warn('⚠️ Modal initialization warning:', e.message);
        }
      }
      
      try {
        switchRole(role);
      } catch (e) {
        console.error('⚠️ switchRole error:', e);
      }
      
      console.log('✅ Portal ready!');
    }
  } catch (e) {
    console.error('❌ Initialization error:', e);
    console.error('Stack:', e.stack);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  try {
    console.log('DOMContentLoaded event fired');
    init();
  } catch (err) {
    console.error('Fatal error during initialization:', err);
    console.error('Error message:', err.message);
    console.error('Stack:', err.stack);
    // Try to make basic buttons clickable as fallback
    document.querySelectorAll('button').forEach(btn => {
      if (!btn.onclick && !btn.addEventListener) {
        btn.onclick = function() { alert('Button clicked'); };
      }
    });
  }
});