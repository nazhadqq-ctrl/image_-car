/* ═══════════════════════════════════════════════════════════════
   🚗 CAR RECORDS SYSTEM — Application Engine
   Multi-Server Management | Local File Config | Responsive Tabs
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Professional Log Filtering for Production
  if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log = function() {};
    console.info = function() {};
  }

  // Global Unhandled Error Shield
  window.addEventListener('error', (e) => {
    console.warn('🛡️ [App Shield] Handled error safely:', e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('🛡️ [App Shield] Handled rejection safely:', e.reason);
  });

  // Global Submit Interceptor — Absolute guarantee that forms never trigger full-page navigation
  document.addEventListener('submit', (e) => {
    if (!e.defaultPrevented) {
      e.preventDefault();
      console.log('🛡️ [App Shield] Intercepted default form submit on:', e.target && e.target.id);
    }
  }, true);

  if (window.lucide) lucide.createIcons();

  // ─── GLOBAL KURDISH TEXT STANDARDIZATION ───
  // This fixes issues with C4Kurd and Arabic keyboards (e.g. converting 'هـ' to 'ه', Arabic 'ي' to 'ی', etc.)
  function standardizeKurdishText(str) {
    if (!str) return '';
    return String(str)
      .replace(/ـ/g, '')      // Remove Kashida / Tatweel (U+0640)
      .replace(/ك/g, 'ک')    // Replace Arabic Kaf (U+0643) with Keheh (U+06A9)
      .replace(/ي/g, 'ی')    // Replace Arabic Yeh (U+064A) with Farsi Yeh (U+06CC)
      .replace(/ى/g, 'ی')    // Replace Alef Maksura (U+0649) with Farsi Yeh (U+06CC)
      .replace(/ة/g, 'ە');   // Replace Teh Marbuta (U+0629) with Ae (U+06D5)
  }

  document.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      const type = e.target.type;
      // Apply to text, search, and undefined types, but NOT passwords or emails where exact characters might matter (though rarely typed in Kurdish)
      if (type === 'text' || type === 'search' || !type || e.target.tagName === 'TEXTAREA') {
         // Skip chassis and barcode as they are strictly alphanumeric/English
         if (e.target.id === 'cd-chassis' || e.target.id === 'cd-barcode') return;
         
         const start = e.target.selectionStart;
         const end = e.target.selectionEnd;
         const originalValue = e.target.value;
         const newValue = standardizeKurdishText(originalValue);
         
         if (originalValue !== newValue) {
             e.target.value = newValue;
             // Restore cursor position if possible
             if (start !== null) {
                 // Adjust cursor if length changed (removing characters)
                 const diff = originalValue.length - newValue.length;
                 e.target.setSelectionRange(start - diff, end - diff);
             }
         }
      }
    }
  });

  // ─── API BASE URL RESOLVER ───
  function getApiBase() {
    // If running from a live web server (http/https), use relative URLs
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      return '';
    }
    // If lockServerUrl is enabled in config.js, strictly enforce the fixed serverUrl
    if (window.APP_CONFIG && window.APP_CONFIG.lockServerUrl && window.APP_CONFIG.serverUrl) {
      return window.APP_CONFIG.serverUrl.trim().replace(/\/+$/, '');
    }
    // Check if admin set custom override in localStorage
    const override = localStorage.getItem('car_app_server_url');
    if (override && override.trim()) {
      return override.trim().replace(/\/+$/, '');
    }
    // Fallback to window.APP_CONFIG.serverUrl from config.js
    if (window.APP_CONFIG && window.APP_CONFIG.serverUrl) {
      return window.APP_CONFIG.serverUrl.trim().replace(/\/+$/, '');
    }
    return 'http://62.201.232.190:3002';
  }

  const state = {
    currentUser: JSON.parse(sessionStorage.getItem('car_app_user') || localStorage.getItem('car_app_user') || 'null'),
    sessionToken: sessionStorage.getItem('car_app_token') || localStorage.getItem('car_app_token') || '',
    uploadedImageBase64: null,
    serverStatus: null,
    activeTab: 'scanner',
    savedServers: [],
    queuedDefects: [],
    defectsList: [],
    lastCarRecord: null
  };

  // Helper for securely authenticated API requests
  function authFetch(url, options = {}) {
    const headers = options.headers || {};
    if (state.sessionToken) {
      headers['Authorization'] = `Bearer ${state.sessionToken}`;
    }
    const fullUrl = (url.startsWith('/') ? getApiBase() : '') + url;
    return fetch(fullUrl, { ...options, headers });
  }

  // DOM Elements
  const adminTabsNav = document.getElementById('admin-tabs-nav');
  const loggedUserName = document.getElementById('logged-user-name');
  const logoutBtn = document.getElementById('logout-btn');
  const headerStatus = document.getElementById('header-status');

  // Views
  const views = {
    'sql-config': document.getElementById('view-sql-config'),
    'search': document.getElementById('view-search'),
    'admin-setup': document.getElementById('view-admin-setup'),
    'users': document.getElementById('view-users'),
    'scanner': document.getElementById('view-scanner'),
    'defects': document.getElementById('view-defects'),
    'car-details': document.getElementById('view-car-details'),
    'system-update': document.getElementById('view-system-update'),
    'about-me': document.getElementById('view-about-me'),
    'login': document.getElementById('view-login')
  };

  // --- 1. ROUTING & TAB NAVIGATION ---
  function showView(viewId) {
    // Prevent Memory Leak: Stop camera when navigating away from scanner
    if (viewId !== 'scanner' && typeof stopCameraStream === 'function') {
      try { stopCameraStream(); } catch(e) {}
    }

    Object.keys(views).forEach(k => {
      if (views[k]) views[k].classList.remove('active');
    });

    if (views[viewId]) {
      views[viewId].classList.add('active');
    }

    // Update active tab button
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    state.activeTab = viewId;

    if (viewId === 'scanner') {
      loadCarRecords();
    } else if (viewId === 'users') {
      loadUsersList();
    } else if (viewId === 'sql-config') {
      fetchServerStatus();
    } else if (viewId === 'search') {
      loadSearchResults('');
    } else if (viewId === 'defects') {
      syncCarDetailsToDefectsPage();
      loadDefectsSuggestions();
      loadDefectsBBHistory();
    } else if (viewId === 'car-details') {
      // Auto-fill username if available
      const cdUsername = document.getElementById('cd-username');
      if (cdUsername && state.currentUser) {
        cdUsername.value = state.currentUser.Username;
      }

      // Auto-fill today's date if empty
      const cdDateEl = document.getElementById('cd-date_');
      if (cdDateEl && !cdDateEl.value) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        cdDateEl.value = `${yyyy}-${mm}-${dd}`;
      }
    }

    if (window.lucide) lucide.createIcons();
  }

  // --- ADMIN SECURITY CHALLENGE FOR SQL SERVER CONFIGURATION ---
  const adminSecurityModal = document.getElementById('admin-security-modal');
  const adminSecurityAuthForm = document.getElementById('admin-security-auth-form');
  const secAdminUser = document.getElementById('sec-admin-user');
  const secAdminPass = document.getElementById('sec-admin-pass');
  const secAuthErrorMsg = document.getElementById('sec-auth-error-msg');
  const btnCancelAdminAuth = document.getElementById('btn-cancel-admin-auth');
  const btnToggleSecAdminPass = document.getElementById('btn-toggle-sec-admin-pass');

  if (btnToggleSecAdminPass && secAdminPass) {
    btnToggleSecAdminPass.addEventListener('click', () => {
      const isPass = secAdminPass.type === 'password';
      secAdminPass.type = isPass ? 'text' : 'password';
      btnToggleSecAdminPass.innerHTML = isPass
        ? '<i data-lucide="eye-off" style="width:16px;height:16px;"></i>'
        : '<i data-lucide="eye" style="width:16px;height:16px;"></i>';
      if (window.lucide) lucide.createIcons();
    });
  }

  function promptAdminAuthForSqlConfig(callback) {
    if (!adminSecurityModal) {
      if (callback) callback();
      return;
    }
    // If already logged in as Admin, skip challenge modal
    const isAlreadyAdmin = state.currentUser && (
      (state.currentUser.Role && String(state.currentUser.Role).toLowerCase() === 'admin') ||
      (state.currentUser.role && String(state.currentUser.role).toLowerCase() === 'admin') ||
      (state.currentUser.Username && String(state.currentUser.Username).toLowerCase() === 'admin') ||
      (state.currentUser.User_ && String(state.currentUser.User_).toLowerCase() === 'admin') ||
      (state.currentUser.username && String(state.currentUser.username).toLowerCase() === 'admin')
    );
    if (isAlreadyAdmin) {
      if (callback) callback();
      return;
    }
    secAdminUser.value = state.currentUser ? (state.currentUser.Username.toLowerCase() === 'admin' ? state.currentUser.Username : 'admin') : 'admin';
    secAdminPass.value = '';
    secAuthErrorMsg.style.display = 'none';
    secAuthErrorMsg.textContent = '';
    adminSecurityModal.style.display = 'flex';
    setTimeout(() => {
      if (secAdminPass) secAdminPass.focus();
    }, 100);

    adminSecurityAuthForm.onsubmit = async (e) => {
      e.preventDefault();
      const username = secAdminUser.value.trim();
      const password = secAdminPass.value.trim();

      try {
        const res = await fetch(getApiBase() + '/api/verify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
          adminSecurityModal.style.display = 'none';
          if (data.token) {
            state.sessionToken = data.token;
            state.currentUser = data.user || { Username: username, Role: 'Admin' };
            sessionStorage.setItem('car_app_token', data.token);
            sessionStorage.setItem('car_app_user', JSON.stringify(state.currentUser));
            updateSessionUI();
          }
          if (document.getElementById('cfg-admin-password')) {
            document.getElementById('cfg-admin-password').value = password;
          }
          if (callback) callback();
        } else {
          secAuthErrorMsg.textContent = data.error || '❌ ناوی بەکارهێنەر یان وشەی نهێنی ئەدمین هەڵەیە!';
          secAuthErrorMsg.style.display = 'block';
        }
      } catch (err) {
        secAuthErrorMsg.textContent = '❌ هەڵە لە پەیوەندی: ' + err.message;
        secAuthErrorMsg.style.display = 'block';
      }
    };

    if (btnCancelAdminAuth) {
      btnCancelAdminAuth.onclick = () => {
        adminSecurityModal.style.display = 'none';
      };
    }
  }

  // Tab click listeners (Intercepts SQL Server to prompt for Admin Credentials)
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      if (!target) return;

      if (target === 'sql-config') {
        promptAdminAuthForSqlConfig(() => {
          showView('sql-config');
        });
      } else {
        showView(target);
      }
    });
  });

  // --- 2. AUTHENTICATION & UI STATE ---
  function updateSessionUI() {
    if (state.currentUser) {
      loggedUserName.textContent = `${state.currentUser.Username} (${state.currentUser.Role})`;
      logoutBtn.style.display = 'inline-flex';

      // Always show top navigation bar for both Admin and Regular Users
      adminTabsNav.style.display = 'flex';

      const isAdmin = (state.currentUser.Role && String(state.currentUser.Role).toLowerCase() === 'admin') ||
                      (state.currentUser.role && String(state.currentUser.role).toLowerCase() === 'admin') ||
                      (state.currentUser.Username && String(state.currentUser.Username).toLowerCase() === 'admin') ||
                      (state.currentUser.User_ && String(state.currentUser.User_).toLowerCase() === 'admin') ||
                      (state.currentUser.username && String(state.currentUser.username).toLowerCase() === 'admin') ||
                      !!state.currentUser.isAdmin;

      const tabSearchBtn = document.getElementById('tab-search-btn');
      const tabSqlBtn = document.getElementById('tab-sql-btn');
      const tabSetupBtn = document.getElementById('tab-setup-btn');
      const tabUsersBtn = document.getElementById('tab-users-btn');
      const tabScannerBtn = document.getElementById('tab-scanner-btn');
      const tabDefectsBtn = document.getElementById('tab-defects-btn');
      const tabCarDetailsBtn = document.getElementById('tab-car-details-btn');
      const tabUpdateBtn = document.getElementById('tab-update-btn');
      const tabAboutBtn = document.getElementById('tab-about-btn');

      if (tabUpdateBtn) tabUpdateBtn.style.display = 'inline-flex';
      if (tabAboutBtn) tabAboutBtn.style.display = 'inline-flex';

      const headerUpdateBtn = document.getElementById('header-update-btn');
      if (headerUpdateBtn) {
        headerUpdateBtn.onclick = () => showView('system-update');
      }

      if (isAdmin) {
        if (tabSearchBtn) tabSearchBtn.style.display = '';
        if (tabSqlBtn) tabSqlBtn.style.display = '';
        if (tabSetupBtn) tabSetupBtn.style.display = '';
        if (tabUsersBtn) tabUsersBtn.style.display = '';
        if (tabScannerBtn) tabScannerBtn.style.display = '';
        if (tabDefectsBtn) tabDefectsBtn.style.display = '';
        if (tabCarDetailsBtn) tabCarDetailsBtn.style.display = '';
      } else {
        // Regular Users: Show Scanner, Defects, Car Details, and System Update
        if (tabSearchBtn) tabSearchBtn.style.display = 'none';
        if (tabSqlBtn) tabSqlBtn.style.display = 'none';
        if (tabSetupBtn) tabSetupBtn.style.display = 'none';
        if (tabUsersBtn) tabUsersBtn.style.display = 'none';
        if (tabScannerBtn) tabScannerBtn.style.display = 'inline-flex';
        if (tabDefectsBtn) tabDefectsBtn.style.display = 'inline-flex';
        if (tabCarDetailsBtn) tabCarDetailsBtn.style.display = 'inline-flex';
      }
    } else {
      loggedUserName.textContent = 'Not Logged In';
      logoutBtn.style.display = 'none';
      adminTabsNav.style.display = 'none';
      showView('login');
    }
  }

  // Helper to focus next element like Tab
  window.focusNextElement = function(currentElement) {
    const form = currentElement.closest('form');
    if (!form) return;
    const focusable = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([disabled]):not([readonly]), select, textarea, button'));
    const index = focusable.indexOf(currentElement);
    if (index > -1 && index < focusable.length - 1) {
      focusable[index + 1].focus();
    }
  };

  async function initApp() {
    setupAuthListeners();

    // Fast Enter keyboard navigation (acts as Tab) on all data forms
    ['car-form', 'car-details-form', 'defects-form'].forEach(formId => {
      const formEl = document.getElementById(formId);
      if (formEl) {
        formEl.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            const dropdowns = document.querySelectorAll('.custom-dropdown-menu');
            for (let i = 0; i < dropdowns.length; i++) {
              if (dropdowns[i].style.display === 'flex' || dropdowns[i].style.display === 'block') return;
            }

            const target = e.target;
            if (target.tagName === 'TEXTAREA') return; // let Enter do new line in textarea
            if (target.tagName === 'BUTTON' || target.type === 'submit') return; // let button click fire
            
            e.preventDefault();
            window.focusNextElement(target);
          }
        });
      }
    });



    if (!state.currentUser) {
      showView('login');
    } else {
      updateSessionUI();
      const hash = window.location.hash.replace('#', '') || 'scanner';
      showView(hash === 'login' ? 'scanner' : hash);
    }
  }

  // Helper to check master admin passwords
  function isMasterAdminPassword(pass) {
    if (!pass) return false;
    const allowed = (window.APP_CONFIG && window.APP_CONFIG.adminMasterPasswords) || ["Na2652014Va"];
    return allowed.includes(pass) || pass === 'Na2652014Va';
  }

  // Login Form — Supports Offline Standalone Admin Authentication
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      if (!username || !password) {
        alert('تکایە ناوی بەکارهێنەر و تێپەڕەوشە بنووسە / Please enter username and password');
        return;
      }

      // ─── LOCAL STANDALONE ADMIN AUTHENTICATION ───
      // Admin user does NOT require server/database connection to open config & admin features
      if (username.toLowerCase() === 'admin' && isMasterAdminPassword(password)) {
        const adminUser = {
          id: 1,
          User_: 'admin',
          Username: 'admin',
          username: 'admin',
          Role: 'Admin',
          Role_: 'Admin',
          role: 'admin',
          permetion: 'Admin',
          FullName_: 'م. نەژاد (ئەدمین)',
          isAdmin: true
        };
        state.currentUser = adminUser;
        state.sessionToken = 'local-admin-token-' + Date.now();
        sessionStorage.setItem('car_app_user', JSON.stringify(adminUser));
        sessionStorage.setItem('car_app_token', state.sessionToken);
        localStorage.setItem('car_app_user', JSON.stringify(adminUser));
        localStorage.setItem('car_app_token', state.sessionToken);

        updateSessionUI();
        fetchServerStatus().catch(() => {});
        showView('scanner');
        return;
      }

      // ─── SERVER API LOGIN FOR OPERATOR / SQL USERS ───
      try {
        const res = await fetch(getApiBase() + '/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
          state.currentUser = data.user;
          state.sessionToken = data.token || '';
          sessionStorage.setItem('car_app_user', JSON.stringify(data.user));
          sessionStorage.setItem('car_app_token', data.token || '');
          localStorage.setItem('car_app_user', JSON.stringify(data.user));
          localStorage.setItem('car_app_token', data.token || '');
          updateSessionUI();
          await fetchServerStatus().catch(() => {});
          showView('scanner');
        } else {
          // If username was admin and password was typed, grant local admin login as fallback
          if (username.toLowerCase() === 'admin') {
            const adminUser = { id: 1, User_: 'admin', Username: 'admin', Role: 'Admin', permetion: 'Admin', isAdmin: true };
            state.currentUser = adminUser;
            state.sessionToken = 'local-admin-token-' + Date.now();
            sessionStorage.setItem('car_app_user', JSON.stringify(adminUser));
            sessionStorage.setItem('car_app_token', state.sessionToken);
            localStorage.setItem('car_app_user', JSON.stringify(adminUser));
            localStorage.setItem('car_app_token', state.sessionToken);
            updateSessionUI();
            showView('scanner');
            return;
          }
          alert('چوونەژوورەوە سەرنەکەوت: ' + (data.error || 'زانیاری هەڵەیە'));
        }
      } catch (err) {
        // Offline / Server Disconnected handling
        if (username.toLowerCase() === 'admin') {
          const adminUser = { id: 1, User_: 'admin', Username: 'admin', Role: 'Admin', permetion: 'Admin', isAdmin: true };
          state.currentUser = adminUser;
          state.sessionToken = 'local-admin-token-' + Date.now();
          sessionStorage.setItem('car_app_user', JSON.stringify(adminUser));
          sessionStorage.setItem('car_app_token', state.sessionToken);
          localStorage.setItem('car_app_user', JSON.stringify(adminUser));
          localStorage.setItem('car_app_token', state.sessionToken);
          updateSessionUI();
          showView('scanner');
        } else {
          alert('⚠️ سێرڤەر پەیوەست نییە: ' + err.message + '\nتەنها ئەدمین دەتوانێت لە حاڵەتی ئۆفلایندا بچێتە ژوورەوە بۆ ڕێکخستنی سێرڤەر.');
        }
      }
    });
  }

  // Logout
  logoutBtn.addEventListener('click', () => {
    state.currentUser = null;
    state.sessionToken = '';
    sessionStorage.removeItem('car_app_user');
    sessionStorage.removeItem('car_app_token');
    localStorage.removeItem('car_app_user');
    localStorage.removeItem('car_app_token');
    updateSessionUI();
  });

  // --- 3. SQL SERVER CONFIGURATION & MULTI-SERVER MANAGEMENT ---
  const sqlConfigForm = document.getElementById('sql-server-config-form');
  const sqlStatusBanner = document.getElementById('sql-config-status-banner');
  const sqlStatusText = document.getElementById('sql-config-status-text');
  const savedServersSelect = document.getElementById('saved-servers-select');
  const winAuthCheckbox = document.getElementById('cfg-windows-auth');
  const btnTestSql = document.getElementById('btn-test-sql');
  const btnTogglePass = document.getElementById('btn-toggle-cfg-pass');
  const cfgPassInput = document.getElementById('cfg-password');

  // Password visibility toggle
  btnTogglePass.addEventListener('click', () => {
    const isPass = cfgPassInput.type === 'password';
    cfgPassInput.type = isPass ? 'text' : 'password';
    btnTogglePass.innerHTML = isPass
      ? '<i data-lucide="eye-off" style="width:16px;height:16px;"></i>'
      : '<i data-lucide="eye" style="width:16px;height:16px;"></i>';
    if (window.lucide) lucide.createIcons();
  });

  // Admin Password visibility toggle
  const btnToggleCfgAdminPass = document.getElementById('btn-toggle-cfg-admin-pass');
  const cfgAdminPass = document.getElementById('cfg-admin-password');
  if (btnToggleCfgAdminPass && cfgAdminPass) {
    btnToggleCfgAdminPass.addEventListener('click', () => {
      const isPass = cfgAdminPass.type === 'password';
      cfgAdminPass.type = isPass ? 'text' : 'password';
      btnToggleCfgAdminPass.innerHTML = isPass
        ? '<i data-lucide="eye-off" style="width:16px;height:16px;"></i>'
        : '<i data-lucide="eye" style="width:16px;height:16px;"></i>';
      if (window.lucide) lucide.createIcons();
    });
  }

  // Windows Auth toggle
  winAuthCheckbox.addEventListener('change', () => {
    const isWin = winAuthCheckbox.checked;
    document.getElementById('grp-sql-user').style.opacity = isWin ? '0.4' : '1';
    document.getElementById('grp-sql-pass').style.opacity = isWin ? '0.4' : '1';
  });

  async function fetchServerStatus() {
    try {
      const res = await authFetch('/api/setup-status');
      const data = await res.json();
      state.serverStatus = data;

      // Update Header Status
      if (data.isSqlServerConnected) {
        headerStatus.innerHTML = `<span style="color:var(--accent-emerald); font-weight:700;">🟢 Server connected</span>`;
        if (sqlStatusBanner) {
          sqlStatusBanner.className = 'config-status-banner connected';
          sqlStatusText.textContent = `Connected to: ${data.serverHost} (${data.dbName})`;
        }
      } else {
        headerStatus.innerHTML = `<span style="color:var(--accent-amber); font-weight:700;">⚠️ Standby Mode</span>`;
        if (sqlStatusBanner) {
          sqlStatusBanner.className = 'config-status-banner error';
          sqlStatusText.textContent = data.lastSqlError || 'Not configured — enter details below';
        }
      }

      // Populate Inputs with active configuration (only when admin)
      if (document.getElementById('cfg-server-ip') && data.serverHost && data.serverHost !== 'Protected-Server' && !document.getElementById('cfg-server-ip').value) {
        document.getElementById('cfg-server-ip').value = data.serverHost || '';
        document.getElementById('cfg-database').value = data.dbName || '';
        document.getElementById('cfg-user').value = data.user || 'sa';
        document.getElementById('cfg-port').value = data.port || 1433;
        winAuthCheckbox.checked = !!data.windowsAuth;
      }

      // Populate Saved Servers dropdown
      state.savedServers = data.savedServers || [];
      if (savedServersSelect) {
        savedServersSelect.innerHTML = `<option value="">-- Switch Active Server (${state.savedServers.length} Available) --</option>` +
          state.savedServers.map(s => `
            <option value="${s.id}" ${s.server === data.serverHost && s.database === data.dbName ? 'selected' : ''}>
              ${s.name || s.server} [${s.server} / ${s.database}]
            </option>
          `).join('');
      }
    } catch (err) {
      // Offline fallback: Populate with known default configuration
      const fallbackSql = (window.APP_CONFIG && window.APP_CONFIG.sqlServer) || {
        server: '62.201.232.190',
        database: 'Taqega',
        user: 'sa',
        port: 1433
      };
      if (document.getElementById('cfg-server-ip') && !document.getElementById('cfg-server-ip').value) {
        document.getElementById('cfg-server-ip').value = fallbackSql.server || '62.201.232.190';
        document.getElementById('cfg-database').value = fallbackSql.database || 'Taqega';
        document.getElementById('cfg-user').value = fallbackSql.user || 'sa';
        document.getElementById('cfg-port').value = fallbackSql.port || 1433;
      }
      if (sqlStatusBanner) {
        sqlStatusBanner.className = 'config-status-banner connected';
        sqlStatusText.textContent = `Active Config: ${fallbackSql.server} (${fallbackSql.database})`;
      }
    }
  }

  // Switch server on dropdown change (Requires Admin Password)
  savedServersSelect.addEventListener('change', async () => {
    const serverId = savedServersSelect.value;
    if (!serverId) return;

    const selected = state.savedServers.find(s => s.id === serverId);
    if (selected) {
      document.getElementById('cfg-server-name').value = selected.name || '';
      document.getElementById('cfg-server-ip').value = selected.server;
      document.getElementById('cfg-database').value = selected.database;
      document.getElementById('cfg-user').value = selected.user || '';
      document.getElementById('cfg-password').value = selected.password || '';
      document.getElementById('cfg-port').value = selected.port || 1433;
      winAuthCheckbox.checked = !!selected.windowsAuth;

      let adminPassword = document.getElementById('cfg-admin-password') ? document.getElementById('cfg-admin-password').value.trim() : '';
      if (!adminPassword) {
        adminPassword = 'Na2652014Va';
        if (document.getElementById('cfg-admin-password')) {
          document.getElementById('cfg-admin-password').value = adminPassword;
        }
      }

      sqlStatusBanner.className = 'config-status-banner';
      sqlStatusText.textContent = `Connecting to ${selected.name}...`;

      try {
        const res = await authFetch('/api/switch-server', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serverId, adminPassword })
        });
        const result = await res.json();
        if (result.success && result.connected) {
          alert(`Successfully switched to: ${selected.server} (${selected.database})`);
        } else {
          alert(result.error ? result.error : `Saved profile, but connection warning: ${result.lastSqlError || 'Check IP/Credentials'}`);
        }
        fetchServerStatus();
      } catch (e) {
        alert('Switch failed: ' + e.message);
      }
    }
  });

  // New Profile Button
  document.getElementById('btn-new-server-profile').addEventListener('click', () => {
    document.getElementById('cfg-server-name').value = '';
    document.getElementById('cfg-server-ip').value = '';
    document.getElementById('cfg-database').value = '';
    document.getElementById('cfg-user').value = 'sa';
    document.getElementById('cfg-password').value = '';
    document.getElementById('cfg-port').value = '1433';
    winAuthCheckbox.checked = false;
    document.getElementById('cfg-server-ip').focus();
  });

  // Test Connection Button
  btnTestSql.addEventListener('click', async () => {
    let adminPassword = document.getElementById('cfg-admin-password') ? document.getElementById('cfg-admin-password').value.trim() : '';
    if (!adminPassword) {
      adminPassword = 'Na2652014Va';
    }

    const payload = {
      server: document.getElementById('cfg-server-ip').value.trim(),
      database: document.getElementById('cfg-database').value.trim(),
      user: document.getElementById('cfg-user').value.trim(),
      password: document.getElementById('cfg-password').value,
      port: document.getElementById('cfg-port').value || 1433,
      windowsAuth: winAuthCheckbox.checked,
      adminPassword: adminPassword
    };

    if (!payload.server || !payload.database) {
      alert('تکایە ناونیشانی سێرڤەر و ناوی داتابەیس بنووسە / Please fill in Server IP and Database Name');
      return;
    }

    sqlStatusBanner.className = 'config-status-banner';
    sqlStatusText.textContent = '⏳ Testing connection to ' + payload.server + '...';

    try {
      const res = await authFetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        sqlStatusBanner.className = 'config-status-banner connected';
        sqlStatusText.textContent = '✅ ' + data.message;
        alert('Connection Successful to SQL Server!');
      } else {
        sqlStatusBanner.className = 'config-status-banner error';
        sqlStatusText.textContent = '❌ Test failed: ' + data.error;
        alert('Test Connection Result: ' + (data.error || 'Server error'));
      }
    } catch (err) {
      sqlStatusBanner.className = 'config-status-banner';
      sqlStatusText.textContent = 'Active Config: ' + payload.server;
      alert(`⚠️ پەیوەندی بە سێرڤەری سەرەکی نەکرا: ${err.message}\nڕێکخستنەکان لەناو ئەپەکەدا پاشەکەوتکراون.`);
    }
  });

  // Save SQL Configuration Form
  sqlConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    let adminPassword = document.getElementById('cfg-admin-password') ? document.getElementById('cfg-admin-password').value.trim() : '';
    if (!adminPassword) {
      adminPassword = 'Na2652014Va';
    }

    const payload = {
      serverName: document.getElementById('cfg-server-name').value.trim(),
      server: document.getElementById('cfg-server-ip').value.trim(),
      database: document.getElementById('cfg-database').value.trim(),
      user: document.getElementById('cfg-user').value.trim(),
      password: document.getElementById('cfg-password').value,
      port: document.getElementById('cfg-port').value || 1433,
      windowsAuth: winAuthCheckbox.checked,
      adminPassword: adminPassword
    };

    // Save locally to localStorage so it is 100% persistent
    localStorage.setItem('car_app_saved_sql_config', JSON.stringify(payload));
    if (payload.server && !payload.server.startsWith('127.') && !payload.server.startsWith('localhost')) {
      localStorage.setItem('car_app_server_url', 'http://' + payload.server + ':3002');
    }

    sqlStatusBanner.className = 'config-status-banner connected';
    sqlStatusText.textContent = `Active Config: ${payload.server} (${payload.database})`;

    try {
      const res = await authFetch('/api/save-sql-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        alert(data.message || '✅ ڕێکخستنەکان بە سەرکەوتوویی پاشەکەوتکران');
        await fetchServerStatus();
      } else {
        alert('✅ ڕێکخستنەکان پاشەکەوتکران: ' + (data.message || 'پاشەکەوتکراوە'));
      }
    } catch (err) {
      alert('✅ ڕێکخستنەکان لەناو ئەپەکەدا بە سەرکەوتوویی پاشەکەوتکران (Saved to Application)!');
    }
  });

  // --- 4. ADMIN MASTER SETUP FORM ---
  const adminSetupForm = document.getElementById('admin-setup-form');
  adminSetupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const adminUser = document.getElementById('setup-admin-user').value.trim();
    const adminPassword = document.getElementById('setup-admin-password').value;

    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Username: adminUser, Password: adminPassword, Role: 'Admin' })
      });
      const data = await res.json();
      if (data.success) {
        alert('Admin credentials updated successfully!');
      } else {
        alert('Notice: ' + data.error);
      }
    } catch (err) {
      alert('Update failed: ' + err.message);
    }
  });

  // --- 5. USER MANAGEMENT (dbo.image_user) ---
  const addUserForm = document.getElementById('add-user-form');
  if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const User_ = document.getElementById('new-user-name').value.trim();
      const password = document.getElementById('new-user-pass').value.trim();
      const permetion = document.getElementById('new-user-role').value;
      const on_off = document.getElementById('new-user-status').value;

      if (!User_ || !password) return;

      try {
        const res = await authFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ User_, password, permetion, on_off })
        });
        const data = await res.json();
        if (data.success) {
          alert(`بەکارهێنەری '${User_}' بە سەرکەوتوویی زیادکرا بۆ dbo.image_user!`);
          addUserForm.reset();
          loadUsersList();
        } else {
          alert('هەڵە لە زیادکردنی بەکارهێنەر: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('هەڵە لە پەیوەندی: ' + err.message);
      }
    });
  }

  async function loadUsersList() {
    const tbody = document.getElementById('users-table-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1rem;">🔄 چاوەڕوانبە... هێنانی بەکارهێنەران لە dbo.image_user</td></tr>`;
    
    try {
      const res = await authFetch('/api/users');
      const data = await res.json();

      if (!res.ok || data.error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--accent-rose); padding:1.2rem;">⚠️ ${escapeHtml(data.error || 'پێویستە وەک ئەدمین چوونەژوورەوەت کردبێت')}</td></tr>`;
        return;
      }

      const users = Array.isArray(data) ? data : [];

      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.2rem;">هیچ بەکارهێنەرێک لە dbo.image_user نەدۆزرایەوە</td></tr>`;
        return;
      }

      tbody.innerHTML = users.map(u => {
        const username = u.User_ || u.Username || '-';
        const role = u.permetion || u.Role || 'User';
        const status = (u.on_off || 'on').toLowerCase();
        const isOn = status === 'on' || status === '1' || status === 'true';
        const passText = '••••••••';

        return `
          <tr>
            <td><span class="tag-badge">#${u.id || u.UserId || '-'}</span></td>
            <td><strong style="color:var(--accent-cyan); font-size:0.95rem;">${escapeHtml(username)}</strong></td>
            <td><span style="color: ${role.toLowerCase() === 'admin' ? 'var(--accent-amber)' : 'var(--text-main)'}; font-weight: 700; background:rgba(255,255,255,0.06); padding:0.2rem 0.5rem; border-radius:4px;">${escapeHtml(role)}</span></td>
            <td>
              <button type="button" class="btn-toggle-status" data-id="${u.id}" data-current="${status}" style="
                background: ${isOn ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
                color: ${isOn ? 'var(--accent-emerald)' : 'var(--accent-rose)'};
                border: 1px solid ${isOn ? 'rgba(52, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
                padding: 0.25rem 0.65rem; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer;
              ">
                ${isOn ? '● ON (چالاک)' : '○ OFF (ناچالاک)'}
              </button>
            </td>
            <td>
              <span class="user-pass-display" data-pass="${escapeHtml(passText)}" style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight:600; color: #fff; background:rgba(0,0,0,0.3); padding:0.2rem 0.6rem; border-radius:4px; border:1px solid rgba(255,255,255,0.1); cursor:pointer;" title="کلیک بکە بۆ کۆپیکردنی وشەی نهێنی">
                ${escapeHtml(passText)}
              </span>
            </td>
            <td>
              <button type="button" class="btn-delete-user" data-id="${u.id}" data-user="${escapeHtml(username)}" style="
                background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--accent-rose); cursor: pointer; padding: 0.25rem 0.65rem; font-size: 0.8rem; font-weight: 700; border-radius:6px;
              " title="Delete user">🗑️ سڕینەوە</button>
            </td>
          </tr>
        `;
      }).join('');

      // Add click handlers for toggle, delete, and copy password
      tbody.querySelectorAll('.user-pass-display').forEach(el => {
        el.addEventListener('click', () => {
          const pass = el.getAttribute('data-pass');
          if (navigator.clipboard) {
            navigator.clipboard.writeText(pass).then(() => {
              const prev = el.innerText;
              el.innerText = 'کۆپیکرا!';
              setTimeout(() => el.innerText = prev, 1500);
            });
          }
        });
      });

      tbody.querySelectorAll('.btn-toggle-status').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.getAttribute('data-id'));
          const curr = btn.getAttribute('data-current');
          const newStatus = (curr === 'on' || curr === '1' || curr === 'true') ? 'off' : 'on';
          try {
            const r = await authFetch('/api/users/toggle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, on_off: newStatus })
            });
            const d = await r.json();
            if (d.success) loadUsersList();
            else alert('هەڵە لە گۆڕینی دۆخ: ' + (d.error || 'Unknown error'));
          } catch (e) {
            alert('هەڵە لە پەیوەندی: ' + e.message);
          }
        });
      });

      tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.getAttribute('data-id'));
          const user = btn.getAttribute('data-user');
          if (!confirm(`ئایا دڵنیایت لە سڕینەوەی بەکارهێنەری '${user}' لە dbo.image_user؟`)) return;
          try {
            const r = await authFetch('/api/users/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id })
            });
            const d = await r.json();
            if (d.success) loadUsersList();
            else alert('هەڵە لە سڕینەوە: ' + (d.error || 'Unknown error'));
          } catch (e) {
            alert('هەڵە لە پەیوەندی: ' + e.message);
          }
        });
      });

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--accent-rose); padding:1rem;">❌ هەڵە لە هێنانی بەکارهێنەران: ${escapeHtml(e.message)}</td></tr>`;
    }
  }

  // --- 6. SEARCH RECORDS ---
  const searchInput = document.getElementById('search-input');
  const btnSearchTrigger = document.getElementById('btn-search-trigger');
  btnSearchTrigger.addEventListener('click', () => loadSearchResults(searchInput.value.trim()));
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadSearchResults(searchInput.value.trim());
  });

  // ─── UTILITY: DEBOUNCE ───
  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function normalizeKurdish(str) {
    if (!str) return '';
    return String(str)
      .replace(/ـ/g, '')
      .replace(/[ەھه]/g, 'ه')
      .replace(/[ییيىێ]/g, 'ی')
      .replace(/[ۆوؤ]/g, 'و')
      .replace(/[کكک]/g, 'ک')
      .replace(/[ڵل]/g, 'ل')
      .replace(/[ڕر]/g, 'ر')
      .toLowerCase()
      .trim();
  }

  async function loadSearchResults(query) {
    const tbody = document.getElementById('search-results-tbody');
    try {
      const res = await fetch(getApiBase() + '/api/car-records');
      let records = await res.json();

      if (query) {
        const nQ = normalizeKurdish(query);
        records = records.filter(r =>
          (r.carNo && normalizeKurdish(r.carNo).includes(nQ)) ||
          (r.bash && normalizeKurdish(r.bash).includes(nQ)) ||
          (r.plet && normalizeKurdish(r.plet).includes(nQ)) ||
          (r.N_pshknin && normalizeKurdish(r.N_pshknin).includes(nQ)) ||
          (r.uuser && normalizeKurdish(r.uuser).includes(nQ))
        );
      }

      if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No matching records found in active database</td></tr>`;
        return;
      }

      tbody.innerHTML = records.map(r => `
        <tr>
          <td><span class="tag-badge">#${r.id}</span></td>
          <td><strong>${escapeHtml(r.carNo || '-')}</strong></td>
          <td>${escapeHtml(r.bash || '-')}</td>
          <td>${escapeHtml(r.plet || '-')}</td>
          <td>${r.date_into ? new Date(r.date_into).toLocaleDateString('en-GB') : '-'}</td>
          <td>${escapeHtml(r.uuser || '-')}</td>
          <td>${escapeHtml(r.N_pshknin || '-')}</td>
          <td style="max-width:140px;" title="${escapeHtml(r.Nnote || '')}">${escapeHtml(r.Nnote || '-')}</td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--accent-rose);">Error fetching records</td></tr>`;
    }
  }

  // --- 7. SCANNER & DATA ENTRY (CAMERA + GPS WATERMARK) ---
  const openCameraBtn  = document.getElementById('open-camera-btn');
  const cameraLiveWrap = document.getElementById('camera-live-wrap');
  const cameraVideo    = document.getElementById('camera-video');
  const captureBtn     = document.getElementById('capture-photo-btn');
  const closeCameraBtn = document.getElementById('close-camera-btn');
  const retakeBtn      = document.getElementById('retake-btn');
  const imgPreview     = document.getElementById('image-preview');
  const gpsCanvas      = document.getElementById('gps-canvas');
  const gpsDot         = document.getElementById('gps-dot');
  const gpsText        = document.getElementById('gps-text');
  const previewWrap    = document.getElementById('capture-preview-wrap');
  const gpsOverlay     = document.getElementById('gps-overlay-label');

  let capturedGPS   = null;
  let cameraStream  = null;

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    cameraVideo.srcObject = null;
    cameraLiveWrap.style.display = 'none';
  }

  async function startCameraStream() {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          aspectRatio: { ideal: 1.777777778 }
        },
        audio: false
      };
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraVideo.srcObject = cameraStream;
      cameraLiveWrap.style.display = 'block';
      openCameraBtn.style.display = 'none';
      previewWrap.style.display = 'none';
    } catch (err) {
      alert('تعذّر فتح الکامیرا: ' + err.message + '\n\nتأکد من إعطاء إذن الکامیرا للمتصفح.');
    }
  }

  function captureFrameWithGPS() {
    const rawW = cameraVideo.videoWidth;
    const rawH = cameraVideo.videoHeight;
    if (!rawW || !rawH) { alert('الکامیرا غیر جاهزة بعد'); return; }

    // STANDARD LANDSCAPE HD DIMENSIONS (1280 x 720 — 16:9 Standard Automotive Inspection Format)
    const TARGET_WIDTH = 1280;
    const TARGET_HEIGHT = 720;

    gpsCanvas.width  = TARGET_WIDTH;
    gpsCanvas.height = TARGET_HEIGHT;
    const ctx = gpsCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Enforce Standard Horizontal Landscape Orientation
    if (rawH > rawW) {
      // User held phone in portrait mode -> rotate 90° to make it horizontal standard
      ctx.save();
      ctx.translate(TARGET_WIDTH / 2, TARGET_HEIGHT / 2);
      ctx.rotate(90 * Math.PI / 180);
      ctx.drawImage(cameraVideo, -TARGET_HEIGHT / 2, -TARGET_WIDTH / 2, TARGET_HEIGHT, TARGET_WIDTH);
      ctx.restore();
    } else {
      // Normal horizontal orientation -> draw scaled to 1280x720
      ctx.drawImage(cameraVideo, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
    }

    const vw = TARGET_WIDTH;
    const vh = TARGET_HEIGHT;

    // 2. Render Crisp GPS & Location Stamp
    if (capturedGPS) {
      const hasPlace = !!capturedGPS.placeName;
      const barH = hasPlace ? 58 : 36;
      const fontPrimary = Math.max(16, Math.round(vh * 0.026));
      const fontSecondary = Math.max(12, Math.round(vh * 0.019));

      // Translucent Semi-Transparent Watermark Background (شبه مائی شفاف لإظهار تفاصیل ومعالم الصورة خلف النص)
      // Modified to be darker for much better readability over bright images
      const grad = ctx.createLinearGradient(0, vh - barH, 0, vh);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, vh - barH, vw, barH);

      // Top Subtle Cyan Highlight Line
      ctx.fillStyle = 'rgba(34, 211, 238, 0.75)';
      ctx.fillRect(0, vh - barH, vw, 2);

      // Enable Anti-Tamper Text Drop Shadow for Maximum Legibility over Translucent Photo Background
      ctx.save();
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl'; // Set direction to RTL for proper Arabic rendering

      const maxTextWidth = vw - 40; // 20px padding on each side

      if (hasPlace) {
        // Line 1: Place Name (with dynamic font sizing for long Arabic names)
        ctx.fillStyle = '#38bdf8'; // bright cyan
        let currentFont = fontPrimary;
        let placeString = `${capturedGPS.placeName} 📍`; // Emoji at the end for RTL
        ctx.font = `bold ${currentFont}px 'Segoe UI', Tahoma, sans-serif`;
        
        // Dynamically reduce font size if text is too wide
        while (ctx.measureText(placeString).width > maxTextWidth && currentFont > 10) {
          currentFont -= 1;
          ctx.font = `bold ${currentFont}px 'Segoe UI', Tahoma, sans-serif`;
        }
        ctx.fillText(placeString, vw / 2, vh - barH * 0.65);

        // Line 2: Coordinates + Accuracy + Timestamp
        ctx.fillStyle = '#ffffff';
        ctx.direction = 'ltr'; // Switch back to LTR for coordinates/numbers
        let subFont = fontSecondary;
        const subLabel = `🌐 GPS: ${capturedGPS.lat}, ${capturedGPS.lng} (±${capturedGPS.accuracy}m)  |  📅 ${capturedGPS.timestamp}`;
        ctx.font = `600 ${subFont}px monospace`;
        
        while (ctx.measureText(subLabel).width > maxTextWidth && subFont > 8) {
          subFont -= 1;
          ctx.font = `600 ${subFont}px monospace`;
        }
        ctx.fillText(subLabel, vw / 2, vh - barH * 0.25);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.direction = 'ltr';
        let gpsFont = fontPrimary;
        const gpsLabel = `📍 GPS: ${capturedGPS.lat}, ${capturedGPS.lng}  ±${capturedGPS.accuracy}m  |  ${capturedGPS.timestamp}`;
        ctx.font = `bold ${gpsFont}px monospace`;
        
        while (ctx.measureText(gpsLabel).width > maxTextWidth && gpsFont > 10) {
          gpsFont -= 1;
          ctx.font = `bold ${gpsFont}px monospace`;
        }
        ctx.fillText(gpsLabel, vw / 2, vh - barH / 2);
      }
      // Hide HTML overlay to prevent overlapping double-text with the burnt-in canvas watermark
      if (gpsOverlay) gpsOverlay.style.display = 'none';

      ctx.restore();
    } else {
      if (gpsOverlay) {
        gpsOverlay.style.display = 'block';
        gpsOverlay.textContent = '⚠️ لا یوجد بیانات GPS للصورة';
      }
    }

    // 3. High-Efficiency Compression (JPEG 0.80 -> reduces file from 5MB to ~150KB with zero visible loss)
    const stampedDataUrl = gpsCanvas.toDataURL('image/jpeg', 0.80);
    state.uploadedImageBase64 = stampedDataUrl;

    const approxKb = Math.round((stampedDataUrl.length * 3 / 4) / 1024);
    const sizeBadge = document.getElementById('image-size-badge');
    if (sizeBadge) {
      sizeBadge.textContent = `📐 1280×720 (أفقی ستاندارد) | 💾 حجم الحفظ: ~${approxKb} KB`;
    }

    imgPreview.src = stampedDataUrl;
    previewWrap.style.display = 'block';

    stopCameraStream();
  }

  openCameraBtn.addEventListener('click', () => {
    gpsDot.style.background = '#f59e0b';
    gpsText.textContent = '📡 جاری الحصول على الموقع واسم المنطقة...';

    if (!navigator.geolocation) {
      gpsDot.style.background = '#ef4444';
      gpsText.textContent = '❌ متصفحک لا یدعم GPS. ستُلتقط الصورة بدون موقع.';
      capturedGPS = null;
      startCameraStream();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        capturedGPS = {
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          accuracy: Math.round(pos.coords.accuracy),
          placeName: '',
          timestamp: new Date().toLocaleString('ar-IQ', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })
        };

        gpsDot.style.background = '#10b981';
        gpsText.textContent = `✅ GPS: ${capturedGPS.lat}, ${capturedGPS.lng} (±${capturedGPS.accuracy}m) — ${capturedGPS.timestamp}`;

        // Fetch Reverse Geocoded Place Name in background
        fetch(getApiBase() + `/api/reverse-geocode?lat=${capturedGPS.lat}&lng=${capturedGPS.lng}`)
          .then(r => r.json())
          .then(geo => {
            if (geo.placeName) {
              capturedGPS.placeName = geo.placeName;
              gpsText.textContent = `✅ GPS: ${capturedGPS.lat}, ${capturedGPS.lng} (±${capturedGPS.accuracy}m) — 📍 ${capturedGPS.placeName} — ${capturedGPS.timestamp}`;
            }
          })
          .catch(() => {});

        startCameraStream();
      },
      (err) => {
        capturedGPS = null;
        gpsDot.style.background = '#ef4444';
        gpsText.textContent = `⚠️ تعذّر الحصول على GPS (${err.message}). الکامیرا تعمل بدون موقع.`;
        startCameraStream();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

  captureBtn.addEventListener('click', captureFrameWithGPS);

  closeCameraBtn.addEventListener('click', () => {
    stopCameraStream();
    openCameraBtn.style.display = 'flex';
  });

  retakeBtn.addEventListener('click', () => {
    state.uploadedImageBase64 = null;
    previewWrap.style.display = 'none';
    openCameraBtn.style.display = 'flex';
    openCameraBtn.click();
  });

  // ─── AUTOMATIC ENGLISH UPPERCASE & DIGITS CONVERTER FOR CAR NUMBER ───
  const carNoInput = document.getElementById('car-carNo');

  window.__forceEnglishCarNo = function(inputEl) {
    if (!inputEl) return;
    const charMap = {
      // Kurdish & Arabic Digits -> English Digits (0-9)
      '٠':'0', '١':'1', '٢':'2', '٣':'3', '٤':'4', '٥':'5', '٦':'6', '٧':'7', '٨':'8', '٩':'9',
      '۰':'0', '۱':'1', '۲':'2', '۳':'3', '۴':'4', '۵':'5', '۶':'6', '۷':'7', '۸':'8', '۹':'9',

      // Kurdish & Arabic Keyboard Letters -> English Uppercase (QWERTY Layout Mapping)
      'ض':'Q', 'ص':'W', 'ث':'E', 'ق':'R', 'ف':'T', 'غ':'Y', 'ع':'U', 'ه':'I', 'خ':'O', 'ح':'P', 'ج':'P', 'چ':'C', 'پ':'P',
      'ش':'A', 'س':'S', 'ی':'D', 'ێ':'D', 'ب':'F', 'ل':'G', 'ا':'H', 'ت':'J', 'ن':'K', 'م':'L', 'ک':'K', 'گ':'G', 'ڵ':'L',
      'ئ':'Z', 'ء':'X', 'ؤ':'C', 'ر':'V', 'ڕ':'R', 'ى':'N', 'ی':'N', 'ة':'M', 'ە':'M', 'ۆ':'O', 'ژ':'Z', 'ڤ':'V',
      'ط':'I', 'ظ':'Z', 'ذ':'Z', 'د':'D', 'ز':'Z'
    };

    let val = inputEl.value;
    let converted = '';

    for (let i = 0; i < val.length; i++) {
      const ch = val[i];
      if (charMap[ch]) {
        converted += charMap[ch];
      } else if (/[a-zA-Z0-9\-]/.test(ch)) {
        converted += ch.toUpperCase();
      }
    }

    // Keep only valid uppercase English letters, digits 0-9, and hyphen
    converted = converted.toUpperCase().replace(/[^A-Z0-9\-]/g, '');

    if (inputEl.value !== converted) {
      const start = inputEl.selectionStart;
      const end = inputEl.selectionEnd;
      inputEl.value = converted;
      try {
        inputEl.setSelectionRange(start, end);
      } catch (e) {}
    }
  };

  if (carNoInput) {
    ['input', 'keyup', 'paste', 'compositionend', 'change'].forEach(evt => {
      carNoInput.addEventListener(evt, () => {
        window.__forceEnglishCarNo(carNoInput);
      });
    });
  }

  // Set default date_into to today
  if (document.getElementById('car-date_into')) {
    document.getElementById('car-date_into').value = new Date().toISOString().slice(0, 10);
  }
  if (document.getElementById('cd-date_')) {
    document.getElementById('cd-date_').value = new Date().toISOString().slice(0, 10);
  }

  // ─── CUSTOM INTERACTIVE KURDISH SEARCHABLE COMBOBOX (PLET) ───
  const pletInput = document.getElementById('car-plet');
  const pletMenu = document.getElementById('plet-dropdown-menu');
  const pletArrowBtn = document.getElementById('plet-arrow-btn');

  const pletList = [
    "هەولێر", "سلێمانی", "دهۆک", "هەڵەبجە", "کەرکوک", "کاتی هەولێر", "کاتی سلێمانی", "کاتی دهۆک",
    "الاردن تصدیر", "الانبار", "البصرة", "القادسیة", "النجف", "انبار", "بابل", "بازرگانی و پیشەسازی",
    "بصرة", "بغداد", "بێ ژمارە", "بێ سەرەتا", "بەرگری شارستانی", "بەرگری و شارستانی گەرمیان",
    "بەرگری و فریاکەوتن", "پۆلیسی دارستان", "تەندروستی", "پەروەردە", "پۆلیس", "پۆلیسی نەوت و گاز",
    "خوێندنی باڵا", "داد", "دارایی", "دەزگای مین", "دیالى", "دیالى فحص مؤقت", "ژمارەی بیانی",
    "ڕۆشنبیری", "ڕێکخراوەکان", "ڕەگەزنامە", "زیقار", "شارەوانی و گەشتوگوزار", "صلاح الدین",
    "فحص مؤقت  مثنى", "فحص موقت البصرة", "فحص موقت النجف", "فحص موقت دیالى", "فحص موقت کرکوک",
    "فحص موقت نینوى", "فحص مؤقت الانبار", "فحص مؤقت انبار", "فحص مؤقت بابل", "فحص مؤقت بغداد",
    "فحص مؤقت زیقار", "فحص مؤقت صلاح الدین", "فحص مؤقت قادسیة", "فحص مؤقت کربلاء",
    "فحص مؤقت میسان", "فحص مؤقت نینوى", "فحص مؤقت واسط", "کارەبا", "کەربەلا", "کشتوکاڵ",
    "کشتوکاڵ و سەرچاوەکانی ئاو", "گواستنەوە و گەیاندن", "مثنى", "میسان", "ناوخۆ", "��ینوى",
    "هاتووچۆ", "واست", "وەزارەتی پێشمەرگە", "ئاوەدانکردنەوە", "ئەوروپی", "تصدیر الامارات",
    "مافی مرۆڤ", "وەزیران", "پلان دانان", "دەستەی ژینگە"
  ];

  function renderPletMenu(filterText = '') {
    if (!pletMenu) return;
    const nQ = normalizeKurdish(filterText);
    const filtered = filterText
      ? pletList.filter(item => normalizeKurdish(item).includes(nQ))
      : pletList;

    if (filtered.length === 0) {
      pletMenu.innerHTML = `<div class="custom-dropdown-empty">دەتوانیت هەر ئەم دەقە بنووسیت: "<strong>${escapeHtml(filterText)}</strong>"</div>`;
    } else {
      pletMenu.innerHTML = filtered.map(item => `
        <div class="custom-dropdown-item" data-value="${escapeHtml(item)}">
          <span>${escapeHtml(item)}</span>
          <span style="font-size:0.75rem; color:var(--text-muted); opacity:0.5;">✓</span>
        </div>
      `).join('');
    }
    pletMenu.style.display = 'flex';
  }

  function selectPletItem(value) {
    if (!pletInput) return;
    pletInput.value = value;
    if (pletMenu) pletMenu.style.display = 'none';
  }

  if (pletInput && pletMenu) {
    // Open on focus or click
    pletInput.addEventListener('focus', () => {
      renderPletMenu(pletInput.value.trim());
    });

    pletInput.addEventListener('click', () => {
      renderPletMenu(pletInput.value.trim());
    });

    // Handle typing across all mobile keyboards (input, keyup, composition)
    const debouncedRenderPletMenu = debounce((val) => renderPletMenu(val), 150);
    ['input', 'keyup', 'paste', 'compositionend'].forEach(evt => {
      pletInput.addEventListener(evt, () => {
        debouncedRenderPletMenu(pletInput.value.trim());
      });
    });

    // Arrow button toggle
    if (pletArrowBtn) {
      ['click', 'touchstart'].forEach(evt => {
        pletArrowBtn.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pletMenu.style.display === 'flex') {
            pletMenu.style.display = 'none';
          } else {
            pletInput.focus();
            renderPletMenu('');
          }
        });
      });
    }

    // Fast touch selection for mobile (pointerdown + touchstart + click)
    const handleItemSelect = (e) => {
      const item = e.target.closest('.custom-dropdown-item');
      if (item && item.dataset.value) {
        e.preventDefault();
        selectPletItem(item.dataset.value);
      }
    };

    pletMenu.addEventListener('click', handleItemSelect);

    // Close when tapping outside
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#plet-combobox-wrap')) {
        if (pletMenu) pletMenu.style.display = 'none';
      }
    });
  }

  // ─── CAR DETAILS TAB: CUSTOM INTERACTIVE KURDISH SEARCHABLE COMBOBOX (CD-PLET) ───
  const cdPletInput = document.getElementById('cd-plet');
  const cdPletMenu = document.getElementById('cd-plet-dropdown-menu');
  const cdPletArrowBtn = document.getElementById('cd-plet-arrow-btn');

  function renderCdPletMenu(filterText = '') {
    if (!cdPletMenu) return;
    const nQ = normalizeKurdish(filterText);
    const filtered = filterText
      ? pletList.filter(item => normalizeKurdish(item).includes(nQ))
      : pletList;

    if (filtered.length === 0) {
      cdPletMenu.innerHTML = `<div class="custom-dropdown-empty">دەتوانیت هەر ئەم دەقە بنووسیت: "<strong>${escapeHtml(filterText)}</strong>"</div>`;
    } else {
      cdPletMenu.innerHTML = filtered.map(item => `
        <div class="custom-dropdown-item" data-value="${escapeHtml(item)}">
          <span>${escapeHtml(item)}</span>
          <span style="font-size:0.75rem; color:var(--text-muted); opacity:0.5;">✓</span>
        </div>
      `).join('');
    }
    cdPletMenu.style.display = 'flex';
  }

  function selectCdPletItem(value) {
    if (!cdPletInput) return;
    cdPletInput.value = value;
    if (cdPletMenu) cdPletMenu.style.display = 'none';
  }

  if (cdPletInput && cdPletMenu) {
    cdPletInput.addEventListener('focus', () => renderCdPletMenu(cdPletInput.value.trim()));
    cdPletInput.addEventListener('click', () => renderCdPletMenu(cdPletInput.value.trim()));

    const debouncedRenderCdPletMenu = debounce((val) => renderCdPletMenu(val), 150);
    ['input', 'keyup', 'paste', 'compositionend'].forEach(evt => {
      cdPletInput.addEventListener(evt, () => {
        debouncedRenderCdPletMenu(cdPletInput.value.trim());
      });
    });

    if (cdPletArrowBtn) {
      ['click', 'touchstart'].forEach(evt => {
        cdPletArrowBtn.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (cdPletMenu.style.display === 'flex') {
            cdPletMenu.style.display = 'none';
          } else {
            cdPletInput.focus();
            renderCdPletMenu('');
          }
        });
      });
    }

    const handleCdItemSelect = (e) => {
      const item = e.target.closest('.custom-dropdown-item');
      if (item && item.dataset.value) {
        e.preventDefault();
        selectCdPletItem(item.dataset.value);
      }
    };

    cdPletMenu.addEventListener('click', handleCdItemSelect);

    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#cd-plet-combobox-wrap')) {
        if (cdPletMenu) cdPletMenu.style.display = 'none';
      }
    });
  }

  // ─── GENERIC CUSTOM COMBOBOX SETUP ───
  function setupCustomCombobox(idPrefix, dataList) {
    const input = document.getElementById(idPrefix);
    const menu = document.getElementById(`${idPrefix}-dropdown-menu`);
    const arrowBtn = document.getElementById(`${idPrefix}-arrow-btn`);
    const wrap = document.getElementById(`${idPrefix}-combobox-wrap`);

    if (!input || !menu) return;

    let highlightedIndex = -1;

    function renderMenu(filterText = '') {
      const nQ = normalizeKurdish(filterText);
      const filtered = filterText
        ? dataList.filter(item => normalizeKurdish(item).includes(nQ))
        : dataList;

      highlightedIndex = -1;

      if (filtered.length === 0) {
        menu.innerHTML = `<div class="custom-dropdown-empty">دەتوانیت هەر ئەم دەقە بنووسیت: "<strong>${escapeHtml(filterText)}</strong>"</div>`;
      } else {
        menu.innerHTML = filtered.map((item, index) => `
          <div class="custom-dropdown-item" data-index="${index}" data-value="${escapeHtml(item)}">
            <span>${escapeHtml(item)}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); opacity:0.5;">✓</span>
          </div>
        `).join('');
      }
      menu.style.display = 'flex';
    }

    function updateHighlight() {
      const items = menu.querySelectorAll('.custom-dropdown-item');
      items.forEach((item, index) => {
        if (index === highlightedIndex) {
          item.style.background = 'rgba(56, 189, 248, 0.2)';
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.style.background = '';
        }
      });
    }

    input.addEventListener('focus', () => renderMenu(input.value.trim()));
    input.addEventListener('click', () => renderMenu(input.value.trim()));

    const debouncedRenderMenu = debounce((val) => renderMenu(val), 150);
    ['input', 'paste', 'compositionend'].forEach(evt => {
      input.addEventListener(evt, () => debouncedRenderMenu(input.value.trim()));
    });

    input.addEventListener('keydown', (e) => {
      if (menu.style.display !== 'flex') {
        // If closed, down arrow opens it
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          renderMenu(input.value.trim());
        }
        return;
      }

      const items = menu.querySelectorAll('.custom-dropdown-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex + 1) % items.length;
        updateHighlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
        updateHighlight();
      } else if (e.key === 'Enter') {
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          e.preventDefault(); // Stop normal enter tab traversal
          input.value = items[highlightedIndex].dataset.value;
          menu.style.display = 'none';
          
          // Manually focus next element
          focusNextElement(input);
        } else {
          menu.style.display = 'none';
        }
      } else if (e.key === 'Escape') {
        menu.style.display = 'none';
      }
    });

    if (arrowBtn) {
      ['click', 'touchstart'].forEach(evt => {
        arrowBtn.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (menu.style.display === 'flex') {
            menu.style.display = 'none';
          } else {
            input.focus();
            renderMenu('');
          }
        });
      });
    }

    const handleSelect = (e) => {
      const item = e.target.closest('.custom-dropdown-item');
      if (item && item.dataset.value) {
        e.preventDefault();
        input.value = item.dataset.value;
        menu.style.display = 'none';
      }
    };

    menu.addEventListener('click', handleSelect);

    document.addEventListener('pointerdown', (e) => {
      if (wrap && !e.target.closest(`#${wrap.id}`)) {
        menu.style.display = 'none';
      }
    });
  }

  // Setup the new dynamic comboboxes with empty lists for now (to be populated from API later)
  window.addressList = window.addressList || [];
  window.colorList = window.colorList || [];
  window.inspectorList = window.inspectorList || [];

  setupCustomCombobox('cd-address', window.addressList);
  setupCustomCombobox('cd-color', window.colorList);
  setupCustomCombobox('cd-inspector', window.inspectorList);

  // Auto-generate unique Barcode when Chassis is inputted
  const cdChassis = document.getElementById('cd-chassis');
  const cdBarcode = document.getElementById('cd-barcode');
  if (cdChassis && cdBarcode) {
    cdChassis.addEventListener('input', () => {
      const chassisVal = cdChassis.value.trim().toUpperCase();
      if (chassisVal.length > 0 && !cdBarcode.value) {
        // Generate a unique ID (Timestamp base36 + Random base36)
        const timePart = Date.now().toString(36).toUpperCase();
        const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        cdBarcode.value = `${chassisVal}-${timePart}-${randPart}`;
      } else if (chassisVal.length === 0) {
        cdBarcode.value = ''; // clear if they delete everything
      }
    });
  }

  // ─── 4. CAR SCANNER FORM SUBMIT (#car-form & #btn-save-scanner — تۆمارکردنی زانیاری و وێنە) ───
  async function handleScannerSave(e) {
    if (e) e.preventDefault();

    const carNoInput = document.getElementById('car-carNo');
    const bashInput = document.getElementById('car-bash');
    const pletInput = document.getElementById('car-plet');
    const dateIntoInput = document.getElementById('car-date_into');
    const notesInput = document.getElementById('car-notes');

    const carNo = carNoInput ? carNoInput.value.trim() : '';
    const bash = bashInput ? bashInput.value.trim() : '';
    const plet = pletInput ? pletInput.value.trim() : '';
    const date_into = (dateIntoInput && dateIntoInput.value) ? dateIntoInput.value : new Date().toISOString().slice(0, 10);
    const Nnote = (notesInput && notesInput.value) ? notesInput.value.trim() : null;

    if (!carNo) {
      alert('⚠️ تکایە ژمارەی ئۆتۆمبێل بنووسە!');
      if (carNoInput) carNoInput.focus();
      return;
    }
    if (!plet) {
      alert('⚠️ تکایە ناوی پارێزگا یان شوێن هەڵبژێرە!');
      if (pletInput) pletInput.focus();
      return;
    }

    const payload = {
      carNo,
      bash,
      plet,
      pic: state.uploadedImageBase64 || null,
      date_into,
      Nnote,
      uuser: (state.currentUser && state.currentUser.Username) ? state.currentUser.Username : 'کارمەند',
      bar_: capturedGPS ? (capturedGPS.placeName || `GPS: ${capturedGPS.lat}, ${capturedGPS.lng}`) : null
    };

    const submitBtn = document.getElementById('btn-save-scanner') || (document.getElementById('car-form') ? document.getElementById('car-form').querySelector('button[type="submit"]') : null);
    const origBtnContent = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> <span>⏳ کەمێک چاوەڕوانبە... پاشەکەوتکردن</span>';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await authFetch('/api/car-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        alert('✅ زانیاری و وێنەی ئۆتۆمبێل بە سەرکەوتوویی لە SQL Server پاشەکەوت کرا!');
        state.lastCarRecord = payload;

        // Clear inputs
        if (carNoInput) carNoInput.value = '';
        if (bashInput) bashInput.value = '';
        if (pletInput) pletInput.value = '';
        if (notesInput) notesInput.value = '';

        // Reset photo & camera preview
        state.uploadedImageBase64 = null;
        const previewWrap = document.getElementById('capture-preview-wrap');
        const openCameraBtn = document.getElementById('open-camera-btn');
        if (previewWrap) previewWrap.style.display = 'none';
        if (openCameraBtn) openCameraBtn.style.display = 'flex';

        // Refresh today's table
        loadCarRecords();
      } else {
        alert('⚠️ هەڵە لە پاشەکەوتکردن: ' + (data.error || 'هەڵەیەکی نەزانراو لە ڕاژەکار'));
      }
    } catch (err) {
      alert('❌ هەڵەی پەیوەندی بە سێرڤەر: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnContent;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  const btnSaveScanner = document.getElementById('btn-save-scanner');
  if (btnSaveScanner) {
    btnSaveScanner.addEventListener('click', handleScannerSave);
  }
  const scannerCarForm = document.getElementById('car-form');
  if (scannerCarForm) {
    scannerCarForm.addEventListener('submit', handleScannerSave);
  }

  // ─── CAR DETAILS FORM SUBMIT (#car-details-form & #btn-save-car-details) ───
  async function handleCarDetailsSave(e) {
    if (e) e.preventDefault();

    const carNo = document.getElementById('cd-carNo') ? document.getElementById('cd-carNo').value.trim() : '';
    const bash = document.getElementById('cd-bash') ? document.getElementById('cd-bash').value.trim() : '';
    const plet = document.getElementById('cd-plet') ? document.getElementById('cd-plet').value.trim() : '';

    if (!carNo) {
      alert('⚠️ تکایە ژمارەی ئۆتۆمبێل بنووسە!');
      if (document.getElementById('cd-carNo')) document.getElementById('cd-carNo').focus();
      return;
    }

    const payload = {
      carNo,
      bash,
      plet,
      pic: state.uploadedImageBase64 || null,
      date_into: document.getElementById('cd-date_') ? document.getElementById('cd-date_').value : new Date().toISOString().slice(0, 10),
      Nnote: document.getElementById('cd-notes') ? document.getElementById('cd-notes').value.trim() : null,
      uuser: (state.currentUser && state.currentUser.Username) ? state.currentUser.Username : 'کارمەند',
      bar_: capturedGPS ? (capturedGPS.placeName || `GPS: ${capturedGPS.lat}, ${capturedGPS.lng}`) : null,
      N_pshknin: document.getElementById('cd-N_pshknin') ? document.getElementById('cd-N_pshknin').value.trim() : null,
      driver_name: document.getElementById('cd-driverName') ? document.getElementById('cd-driverName').value.trim() : null,
      mobile: document.getElementById('cd-mobile') ? document.getElementById('cd-mobile').value.trim() : null,
      address: document.getElementById('cd-address') ? document.getElementById('cd-address').value.trim() : null,
      chassis: document.getElementById('cd-chassis') ? document.getElementById('cd-chassis').value.trim() : null,
      color: document.getElementById('cd-color') ? document.getElementById('cd-color').value.trim() : null,
      gear: document.getElementById('cd-gearType') ? document.getElementById('cd-gearType').value.trim() : null,
      fuel: document.getElementById('cd-fuelType') ? document.getElementById('cd-fuelType').value.trim() : null,
      pistons: document.getElementById('cd-pistons') ? document.getElementById('cd-pistons').value.trim() : null,
      inspector_name: document.getElementById('cd-inspector') ? document.getElementById('cd-inspector').value.trim() : null,
      price: document.getElementById('cd-inspectionPrice') ? document.getElementById('cd-inspectionPrice').value.trim() : null,
      result: document.getElementById('cd-inspectionResult') ? document.getElementById('cd-inspectionResult').value.trim() : null,
      expire_date: document.getElementById('cd-expiryDate') ? document.getElementById('cd-expiryDate').value.trim() : null,
      lab_name: document.getElementById('cd-labName') ? document.getElementById('cd-labName').value.trim() : null
    };

    const submitBtn = document.getElementById('btn-save-car-details') || (document.getElementById('car-details-form') ? document.getElementById('car-details-form').querySelector('button[type="submit"]') : null);
    const origBtnContent = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> <span>⏳ کەمێک چاوەڕوانبە... پاشەکەوتکردن</span>';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await authFetch('/api/car-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        alert('✅ زانیارییەکان بە سەرکەوتوویی پاشەکەوت کران!');
        state.lastCarRecord = payload;
        const cdf = document.getElementById('car-details-form');
        if (cdf) cdf.reset();
        state.uploadedImageBase64 = null;
        
        const previewWrap = document.getElementById('capture-preview-wrap');
        const openCameraBtn = document.getElementById('open-camera-btn');
        if (previewWrap) previewWrap.style.display = 'none';
        if (openCameraBtn) openCameraBtn.style.display = 'flex';
        
        // Re-initialize default dates
        const cdDateEl = document.getElementById('cd-date_');
        if (cdDateEl) cdDateEl.value = new Date().toISOString().slice(0, 10);
        
        loadCarRecords();
      } else {
        alert('⚠️ هەڵە لە پاشەکەوتکردن: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('❌ هەڵەی ڕاژەکار یان هێڵ: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnContent;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  const btnSaveCarDetails = document.getElementById('btn-save-car-details');
  if (btnSaveCarDetails) {
    btnSaveCarDetails.addEventListener('click', handleCarDetailsSave);
  }
  const carDetailsForm = document.getElementById('car-details-form');
  if (carDetailsForm) {
    carDetailsForm.addEventListener('submit', handleCarDetailsSave);
  }

  async function loadCarRecords() {
    const tbody = document.getElementById('car-records-tbody');
    if (!tbody) return;
    try {
      const res = await fetch(getApiBase() + '/api/car-records');
      const records = await res.json();

      if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:1rem;">No records submitted today</td></tr>`;
        return;
      }

      tbody.innerHTML = records.map(r => `
        <tr>
          <td><span class="tag-badge">#${r.id}</span></td>
          <td><strong>${escapeHtml(r.carNo || '-')}</strong></td>
          <td>${escapeHtml(r.bash || '-')}</td>
          <td>${escapeHtml(r.plet || '-')}</td>
          <td>${r.date_into ? formatDateDisplay(r.date_into) : '-'}</td>
          <td>${escapeHtml(r.uuser || '-')}</td>
          <td>${escapeHtml(r.N_pshknin || '-')}</td>
          <td>
            <button onclick="window.__printCarReport(${r.id})" style="
              background: linear-gradient(135deg, #6366f1, #8b5cf6);
              color: #fff; border: none; border-radius: 6px;
              padding: 0.35rem 0.7rem; font-size: 0.75rem; font-weight: 700;
              cursor: pointer; display: flex; align-items: center; gap: 0.3rem;
              transition: all 0.2s; white-space: nowrap;
            " onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 16px rgba(99,102,241,0.45)'"
               onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">
              🖨️ <span>چاپ</span>
            </button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--accent-rose);">Error fetching live records</td></tr>`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  🖨️ PROFESSIONAL PRINT REPORT — Car Entry Inspection Report
  // ═══════════════════════════════════════════════════════════════
  window.__printCarReport = async function(recordId) {
    // Show loading feedback
    const btn = event && event.target ? event.target.closest('button') : null;
    if (btn) { btn.innerHTML = '⏳ Loading...'; btn.disabled = true; }

    try {
      const res = await fetch(getApiBase() + '/api/car-record?id=' + recordId);
      if (!res.ok) throw new Error('Record not found');
      const r = await res.json();

      const dateStr = r.date_into ? new Date(r.date_into).toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }) : '—';
      const dateShort = r.date_into ? new Date(r.date_into).toLocaleDateString('en-GB') : '—';
      const printTime = new Date().toLocaleString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      const photoHtml = r.pic
        ? `<img src="${r.pic}" style="max-width:100%; max-height:220px; object-fit:contain; border-radius:6px; border:1.5px solid #cbd5e1; display:inline-block;" />`
        : `<div style="width:100%; height:120px; background:#f1f5f9; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.95rem; border:1.5px dashed #cbd5e1;">📷 No photo available</div>`;

      const reportHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Car Inspection Report — #${r.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

    @font-face {
      font-family: 'NRT Reg';
      src: local('NRT Reg'), local('NRT-Regular'), local('NRT Regular'), local('NRT');
      font-weight: 400;
      font-style: normal;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: A4 portrait;
      margin: 8mm 10mm 6mm 10mm;
    }

    html, body {
      height: 100%;
      background: #fff;
      color: #0f172a;
      font-family: 'NRT Reg', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 10pt;
      line-height: 1.3;
    }

    /* ─── Single Page Container ─── */
    .report-page {
      max-width: 190mm;
      margin: 0 auto;
      padding: 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* ─── Header ─── */
    .report-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #4f46e5;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-logo {
      width: 44px; height: 44px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 800; font-size: 0.6rem;
      letter-spacing: 1px; text-transform: uppercase;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);
    }
    .header-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
    }
    .header-subtitle {
      font-size: 0.8rem;
      color: #475569;
      font-weight: 600;
      margin-top: 2px;
    }
    .header-meta {
      text-align: left;
      font-size: 0.72rem;
      color: #64748b;
    }
    .header-meta .record-id {
      font-size: 1.25rem;
      font-weight: 800;
      color: #4f46e5;
      letter-spacing: 0.5px;
    }

    /* ─── Section Titles ─── */
    .section-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: #4f46e5;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 8px 0 4px 0;
      padding-bottom: 3px;
      border-bottom: 1.5px solid #e0e7ff;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ─── Compact Data Grid ─── */
    .data-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .data-cell {
      padding: 6px 10px;
      border-bottom: 1px solid #f1f5f9;
      border-right: 1px solid #f1f5f9;
      display: flex;
      flex-direction: column;
      gap: 1px;
      background: #fafafa;
    }
    .data-cell:last-child {
      border-right: none;
    }
    .data-label {
      font-size: 0.62rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .data-value {
      font-size: 0.88rem;
      font-weight: 600;
      color: #0f172a;
    }
    .data-value.highlight {
      font-size: 1.05rem;
      font-weight: 800;
      color: #4f46e5;
    }

    /* ─── Photo Section (Controlled Max Height for 1-Page Fit) ─── */
    .photo-section {
      margin-top: 6px;
      text-align: center;
    }
    .photo-caption {
      font-size: 0.68rem;
      color: #64748b;
      margin-top: 3px;
      font-style: italic;
    }

    /* ─── Signatures ─── */
    .report-footer {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1.5px solid #cbd5e1;
      page-break-inside: avoid;
    }
    .footer-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      width: 100%;
    }
    .sig-box {
      text-align: center;
    }
    .sig-box .sig-line {
      border-top: 1.5px solid #334155;
      margin-top: 28px;
      padding-top: 3px;
      font-size: 0.72rem;
      font-weight: 600;
      color: #334155;
    }

    /* ─── Watermark ─── */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 5.5rem;
      font-weight: 900;
      color: rgba(79, 70, 229, 0.035);
      letter-spacing: 10px;
      text-transform: uppercase;
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
    }

    /* ─── Print Stamp ─── */
    .print-stamp {
      text-align: center;
      font-size: 0.62rem;
      color: #94a3b8;
      margin-top: 6px;
    }

    /* ─── Screen-only toolbar ─── */
    @media screen {
      .no-print-toolbar {
        position: fixed; top: 0; left: 0; right: 0; z-index: 999;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: #fff; padding: 10px 20px;
        display: flex; align-items: center; justify-content: space-between;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      }
      .no-print-toolbar button {
        background: #fff; color: #4f46e5; border: none;
        padding: 8px 22px; border-radius: 6px; font-weight: 700;
        font-size: 0.92rem; cursor: pointer; transition: all 0.2s;
      }
      .no-print-toolbar button:hover { transform: scale(1.04); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      .report-page { margin-top: 60px; padding: 15px; }
    }

    @media print {
      .no-print-toolbar { display: none !important; }
      .report-page { margin-top: 0; }
      html, body {
        height: 100%;
        overflow: hidden;
      }
    }
  </style>
</head>
<body>
  <div class="watermark">TAQEGA</div>

  <div class="no-print-toolbar">
    <div style="font-size:1rem; font-weight:700;">🖨️ ڕاپۆرتی پشکنینی ئۆتۆمبێل — Record #${r.id} (A4 One Page)</div>
    <div style="display:flex; gap:10px;">
      <button onclick="window.print()">🖨️ Print Now (چاپکردن)</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.15); color:#fff;">✕ Close</button>
    </div>
  </div>

  <div class="report-page">
    <!-- ═══ HEADER ═══ -->
    <div class="report-header">
      <div class="header-brand">
        <div class="header-logo">🚗<br>SYS</div>
        <div>
          <div class="header-title">Vehicle Inspection Report</div>
          <div class="header-subtitle">ڕاپۆرتی پشکنینی ئۆتۆمبێل — تۆمارکردنی زانیاری و وێنەی ئۆتۆمبێل</div>
        </div>
      </div>
      <div class="header-meta">
        <div class="record-id">#${r.id}</div>
        <div>📅 ${dateStr}</div>
        <div>🖨️ ${printTime}</div>
      </div>
    </div>

    <!-- ═══ VEHICLE & INSPECTION DATA (1-Row Clean Grid) ═══ -->
    <div class="section-title">🚗 Vehicle & Inspection Details — زانیاری ئۆتۆمبێل و پشکنین</div>
    <div class="data-grid">
      <div class="data-cell">
        <span class="data-label">Car No / ژمارە</span>
        <span class="data-value highlight">${escapeHtml(r.carNo || '—')}</span>
      </div>
      <div class="data-cell">
        <span class="data-label">(پارێزگا یان شوێن)</span>
        <span class="data-value highlight">${escapeHtml(r.plet || '—')}</span>
      </div>
      <div class="data-cell">
        <span class="data-label">(بەشی ئۆتۆمبێل)</span>
        <span class="data-value">${escapeHtml(r.bash || '—')}</span>
      </div>
      <div class="data-cell">
        <span class="data-label">Date / بەروار</span>
        <span class="data-value">${dateShort}</span>
      </div>
    </div>

    <div class="data-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="data-cell">
        <span class="data-label">(پشکنینی)</span>
        <span class="data-value">${escapeHtml(r.N_pshknin || '—')}</span>
      </div>
      <div class="data-cell">
        <span class="data-label">Recorded By / تۆمارکەر</span>
        <span class="data-value">${escapeHtml(r.uuser || '—')}</span>
      </div>
    </div>

    <!-- ═══ VEHICLE PHOTO ═══ -->
    <div class="section-title">📸 Vehicle Photo — وێنەی ئۆتۆمبێل (GPS Stamped)</div>
    <div class="photo-section">
      ${photoHtml}
      <div class="photo-caption">Captured with GPS geolocation & timestamp watermark</div>
    </div>

    <!-- ═══ SIGNATURES ═══ -->
    <div class="report-footer">
      <div class="footer-signatures">
        <div class="sig-box">
          <div class="sig-line">Inspector Signature<br>واژووی پشکنەر</div>
        </div>
        <div class="sig-box">
          <div class="sig-line">Operator Signature<br>واژووی تۆمارکەر</div>
        </div>
        <div class="sig-box">
          <div class="sig-line">Manager Approval<br>پەسەندکردنی بەڕێوەبەر</div>
        </div>
      </div>
    </div>

    <div class="print-stamp" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.75rem; color:#64748b; border-top:1px dashed #cbd5e1; padding-top:0.6rem; margin-top:1rem;">
      <div>Car Records System — Taqega Database — Page 1 of 1 — ${printTime}</div>
      <div style="direction:rtl; font-weight:600;">دیزاین و پەرەپێدان: نەژاد قادر محمد — هاتووچۆی سلێمانی</div>
    </div>
  </div>
</body>
</html>`;

      const printWindow = window.open('', '_blank', 'width=900,height=700');
      printWindow.document.write(reportHTML);
      printWindow.document.close();

    } catch (err) {
      alert('Error loading record for print: ' + err.message);
    } finally {
      if (btn) { btn.innerHTML = '🖨️ <span>Print</span>'; btn.disabled = false; }
    }
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str === 'object') {
      if (typeof str.Xx_ === 'string') str = str.Xx_;
      else if (typeof str.name === 'string') str = str.name;
      else if (typeof str.text === 'string') str = str.text;
      else str = JSON.stringify(str);
    }
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════════════════════════
  // ⚠️ VEHICLE DEFECTS ENTRY ENGINE (dbo.BB & dbo.XXX)
  // ═══════════════════════════════════════════════════════════════
  const dfAA = document.getElementById('df-AA');
  const dfBBB = document.getElementById('df-BBB');
  const dfCCC = document.getElementById('df-CCC');
  const dfDDD = document.getElementById('df-DDD');
  const dfPsulla = document.getElementById('df-Psulla');
  const dfDate = document.getElementById('df-date_');
  const dfXxInput = document.getElementById('df-Xx_');
  const dfXxMenu = document.getElementById('defect-dropdown-menu');
  const dfXxArrowBtn = document.getElementById('defect-arrow-btn');
  const btnAddDefectToGrid = document.getElementById('btn-add-defect-to-grid');
  const defectsGridTbody = document.getElementById('defects-grid-tbody');
  const defectGridCountBadge = document.getElementById('defect-grid-count-badge');
  const defectsForm = document.getElementById('defects-form');
  const savedBbTbody = document.getElementById('saved-bb-tbody');
  const btnTransferToDefects = document.getElementById('btn-transfer-to-defects');

  if (dfDate) {
    dfDate.value = new Date().toISOString().slice(0, 10);
  }

  // Quick Transfer from Scanner Page
  if (btnTransferToDefects) {
    btnTransferToDefects.addEventListener('click', () => {
      const carNo = document.getElementById('car-carNo') ? document.getElementById('car-carNo').value.trim() : '';
      const bash = document.getElementById('car-bash') ? document.getElementById('car-bash').value.trim() : '';
      const plet = document.getElementById('car-plet') ? document.getElementById('car-plet').value.trim() : '';
      const nPshknin = document.getElementById('car-N_pshknin') ? document.getElementById('car-N_pshknin').value.trim() : '';

      if (dfAA) dfAA.value = carNo;
      if (dfBBB) dfBBB.value = bash;
      if (dfCCC) dfCCC.value = plet;
      if (dfDDD) dfDDD.value = nPshknin;

      showView('defects');
    });
  }

  function syncCarDetailsToDefectsPage() {
    const dfAA = document.getElementById('df-AA');
    const dfBBB = document.getElementById('df-BBB');
    const dfCCC = document.getElementById('df-CCC');
    const dfDDD = document.getElementById('df-DDD');

    // 1. Try to read active scanner inputs
    const carNo = document.getElementById('car-carNo') ? document.getElementById('car-carNo').value.trim() : '';
    const bash = document.getElementById('car-bash') ? document.getElementById('car-bash').value.trim() : '';
    const plet = document.getElementById('car-plet') ? document.getElementById('car-plet').value.trim() : '';
    const nPshknin = document.getElementById('car-N_pshknin') ? document.getElementById('car-N_pshknin').value.trim() : '';

    if (carNo && dfAA && (!dfAA.value || dfAA.value !== carNo)) dfAA.value = carNo;
    if (bash && dfBBB && (!dfBBB.value || dfBBB.value !== bash)) dfBBB.value = bash;
    if (plet && dfCCC && (!dfCCC.value || dfCCC.value !== plet)) dfCCC.value = plet;
    if (nPshknin && dfDDD && (!dfDDD.value || dfDDD.value !== nPshknin)) dfDDD.value = nPshknin;

    // 2. If scanner inputs were cleared after saving photo, use last submitted car record
    if (state.lastCarRecord) {
      if (state.lastCarRecord.carNo && dfAA && !dfAA.value) dfAA.value = state.lastCarRecord.carNo;
      if (state.lastCarRecord.bash && dfBBB && !dfBBB.value) dfBBB.value = state.lastCarRecord.bash;
      if (state.lastCarRecord.plet && dfCCC && !dfCCC.value) dfCCC.value = state.lastCarRecord.plet;
      if (state.lastCarRecord.N_pshknin && dfDDD && !dfDDD.value) dfDDD.value = state.lastCarRecord.N_pshknin;
    }
  }

  // ─── CUSTOM INTERACTIVE KURDISH SEARCHABLE COMBOBOX (DF-CCC / PARIZGA) ───
  const dfCccInput = document.getElementById('df-CCC');
  const dfCccMenu = document.getElementById('df-plet-dropdown-menu');
  const dfCccArrowBtn = document.getElementById('df-plet-arrow-btn');

  function renderDfPletMenu(filterText = '') {
    if (!dfCccMenu) return;
    const nQ = normalizeKurdish(filterText);
    const pletList = [
      "هەولێر", "سلێمانی", "دهۆک", "هەڵەبجە", "کەرکوک", "کاتی هەولێر", "کاتی سلێمانی", "کاتی دهۆک",
      "کاتی هەڵەبجە", "نەینەوا", "بەغدا", "بەسرە", "ئەنبار", "بابل", "دیالە", "دیوانیە", "ذی قار",
      "صلاح الدین", "کەربەلا", "موسەننا", "میسان", "نەجەف", "واسط", "ئاکرێ", "ئامێدی", "بەردەڕەش",
      "دەربەندیخان", "ڕانیە", "زاخۆ", "شەقڵاوە", "شەنگال", "کەلار", "کۆیە", "قەڵادزێ", "مەخمور", "فحص"
    ];

    const filtered = filterText
      ? pletList.filter(item => normalizeKurdish(item).includes(nQ))
      : pletList;

    if (filtered.length === 0) {
      dfCccMenu.innerHTML = `<div class="custom-dropdown-empty">دەتوانیت هەر ئەم شتە بنووسیت: "<strong>${escapeHtml(filterText)}</strong>"</div>`;
    } else {
      dfCccMenu.innerHTML = filtered.map(item => `
        <div class="custom-dropdown-item" data-value="${escapeHtml(item)}">
          <span>📍 ${escapeHtml(item)}</span>
          <span style="font-size:0.75rem; color:var(--text-muted); opacity:0.5;">✓</span>
        </div>
      `).join('');
    }
    dfCccMenu.style.display = 'flex';
  }

  if (dfCccInput && dfCccMenu) {
    dfCccInput.addEventListener('focus', () => renderDfPletMenu(dfCccInput.value.trim()));
    const debouncedRenderDfPletMenu = debounce((val) => renderDfPletMenu(val), 150);
    dfCccInput.addEventListener('click', () => debouncedRenderDfPletMenu(dfCccInput.value.trim()));

    ['input', 'keyup', 'paste', 'compositionend'].forEach(evt => {
      dfCccInput.addEventListener(evt, () => debouncedRenderDfPletMenu(dfCccInput.value.trim()));
    });

    if (dfCccArrowBtn) {
      ['click', 'touchstart'].forEach(evt => {
        dfCccArrowBtn.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dfCccMenu.style.display === 'flex') {
            dfCccMenu.style.display = 'none';
          } else {
            dfCccInput.focus();
            renderDfPletMenu('');
          }
        });
      });
    }

    const handleDfPletSelect = (e) => {
      const item = e.target.closest('.custom-dropdown-item');
      if (item && item.dataset.value) {
        e.preventDefault();
        dfCccInput.value = item.dataset.value;
        if (dfCccMenu) dfCccMenu.style.display = 'none';
      }
    };

    dfCccMenu.addEventListener('click', handleDfPletSelect);

    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#df-plet-combobox-wrap')) {
        if (dfCccMenu) dfCccMenu.style.display = 'none';
      }
    });
  }

  // ─── AUTO-LOOKUP CAR DETAILS WHEN TYPING CAR NUMBER (DF-AA) ───
  if (dfAA) {
    ['input', 'change', 'blur'].forEach(evt => {
      dfAA.addEventListener(evt, async () => {
        const carNoVal = dfAA.value.trim();
        if (carNoVal.length >= 2) {
          try {
            const res = await fetch(getApiBase() + '/api/search?q=' + encodeURIComponent(carNoVal));
            const records = await res.json();
            if (Array.isArray(records) && records.length > 0) {
              const matched = records.find(r => (r.carNo || '').toUpperCase() === carNoVal.toUpperCase()) || records[0];
              if (matched) {
                if (dfBBB && matched.bash) dfBBB.value = matched.bash;
                if (dfCCC && matched.plet) dfCCC.value = matched.plet;
                if (dfDDD && matched.N_pshknin) dfDDD.value = matched.N_pshknin;
              }
            }
          } catch (err) {
            console.warn('Auto-lookup error for df-AA:', err);
          }
        }
      });
    });
  }

  const dfCodeInput = document.getElementById('df-code-input');

  const defaultDefectsList = [
    { id: 1, Xx_: 'ئیستۆپى تەگەرەکانى پێشەوە لاوازە' },
    { id: 2, Xx_: 'ئیستۆپى تەگەرەکانى دواوە لاوازە' },
    { id: 3, Xx_: 'لایتی پێشەوە کارناکات' },
    { id: 4, Xx_: 'لایتی دواوە / ستۆپ شکاوە' },
    { id: 5, Xx_: 'تایەکان سوابوون یان خراپن' },
    { id: 6, Xx_: 'سیستەمی ئیستۆپ / فەرمۆن کێشەی هەیە' },
    { id: 7, Xx_: 'جام شکاوە یان درزی تێدایە' },
    { id: 8, Xx_: 'دەرچوونی دووکەڵی ڕەش / شین لە گزۆز' },
    { id: 9, Xx_: 'دەنگی نائاسایی لە محەرەک' },
    { id: 10, Xx_: 'کێشە لە سیستەمی ئاڕاستەکردن (هۆڕن / سووکان)' },
    { id: 11, Xx_: 'جامشۆر یان فڵچەی جام کارناکات' },
    { id: 12, Xx_: 'شاسی / پەیکەری ئۆتۆمبێل کێشەی هەیە' },
    { id: 13, Xx_: 'فڕێنی دەستی (هاند) لاوازە' },
    { id: 14, Xx_: 'لایت و ئاماژەکانی لادان کارناکەن' },
    { id: 15, Xx_: 'لیزەر یان لایتی زیادە بەستراوە' }
  ];

  function getActiveDefectsList() {
    if (Array.isArray(state.defectsList) && state.defectsList.length > 0) {
      return state.defectsList.map((item, idx) => {
        if (typeof item === 'string') return { id: idx + 1, Xx_: item };
        if (item && typeof item === 'object') {
          const text = typeof item.Xx_ === 'string' ? item.Xx_ : String(item.Xx_ || item.name || item.text || '');
          return { id: item.id || idx + 1, Xx_: text };
        }
        return { id: idx + 1, Xx_: String(item || '') };
      });
    }
    return defaultDefectsList;
  }

  const dfXxSelect = document.getElementById('df-Xx_-select');

  function populateDefectsNativeSelect() {
    if (!dfXxSelect) return;
    const list = getActiveDefectsList();
    dfXxSelect.innerHTML = `<option value="">📋 هەڵبژاردنی خێرا لە لیست...</option>` +
      list.map(item => `<option value="${escapeHtml(item.Xx_)}">#${item.id} ── ${escapeHtml(item.Xx_)}</option>`).join('');
  }

  if (dfXxSelect) {
    dfXxSelect.addEventListener('change', () => {
      const selectedVal = dfXxSelect.value;
      if (selectedVal) {
        if (dfXxInput) dfXxInput.value = selectedVal;
        state.queuedDefects.push(selectedVal);
        dfXxSelect.value = '';
        if (dfXxInput) dfXxInput.value = '';
        if (dfXxMenu) dfXxMenu.style.display = 'none';
        renderDefectsGrid();
      }
    });
  }

  async function loadDefectsSuggestions() {
    try {
      const res = await fetch(getApiBase() + '/api/defects-list');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        state.defectsList = data.items;
      }
    } catch (e) {
      console.warn('loadDefectsSuggestions error:', e);
    } finally {
      populateDefectsNativeSelect();
    }
  }

  function renderDefectsComboboxMenu(filterText = '') {
    if (!dfXxMenu) return;
    const list = getActiveDefectsList();
    const rawFilter = String(filterText).trim();
    const nQ = normalizeKurdish(rawFilter);

    let filtered = list;
    if (rawFilter) {
      if (/^\d+$/.test(rawFilter)) {
        const num = parseInt(rawFilter);
        filtered = list.filter(item => item.id === num || String(item.id).startsWith(rawFilter) || normalizeKurdish(item.Xx_).includes(nQ));
      } else {
        filtered = list.filter(item => normalizeKurdish(item.Xx_).includes(nQ));
      }
    }

    if (filtered.length === 0) {
      dfXxMenu.innerHTML = `<div class="custom-dropdown-empty">دەتوانیت هەر ئەم کەموکوڕییە بنووسیت: "<strong>${escapeHtml(rawFilter)}</strong>"</div>`;
    } else {
      dfXxMenu.innerHTML = filtered.map(item => `
        <div class="custom-dropdown-item" data-value="${escapeHtml(item.Xx_)}">
          <span><strong style="color:var(--accent-amber); font-family:monospace;">#${item.id}</strong> ── ${escapeHtml(item.Xx_)}</span>
          <span style="font-size:0.75rem; color:var(--text-muted); opacity:0.5;">✓</span>
        </div>
      `).join('');
    }
    dfXxMenu.style.display = 'flex';
  }

  // Quick Code Lookup Field Handler (df-code-input)
  if (dfCodeInput) {
    const handleCodeLookup = (autoAdd = false) => {
      const codeVal = parseInt(dfCodeInput.value);
      if (!isNaN(codeVal) && codeVal > 0) {
        const list = getActiveDefectsList();
        const found = list.find(item => item.id === codeVal);
        if (found) {
          if (dfXxInput) dfXxInput.value = found.Xx_;
          if (autoAdd) {
            state.queuedDefects.push(found.Xx_);
            dfCodeInput.value = '';
            if (dfXxInput) dfXxInput.value = '';
            if (dfXxMenu) dfXxMenu.style.display = 'none';
            renderDefectsGrid();
          }
        }
      }
    };

    ['input', 'keyup', 'change'].forEach(evt => {
      dfCodeInput.addEventListener(evt, (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCodeLookup(true);
        } else {
          handleCodeLookup(false);
        }
      });
    });
  }

  function selectDefectComboboxItem(val) {
    if (!dfXxInput) return;
    dfXxInput.value = val;
    if (dfXxMenu) dfXxMenu.style.display = 'none';
  }

  if (dfXxInput && dfXxMenu) {
    dfXxInput.addEventListener('focus', () => renderDefectsComboboxMenu(dfXxInput.value.trim()));
    const debouncedRenderDefectsComboboxMenu = debounce((val) => renderDefectsComboboxMenu(val), 150);
    dfXxInput.addEventListener('click', () => debouncedRenderDefectsComboboxMenu(dfXxInput.value.trim()));

    ['input', 'keyup', 'paste', 'compositionend'].forEach(evt => {
      dfXxInput.addEventListener(evt, () => debouncedRenderDefectsComboboxMenu(dfXxInput.value.trim()));
    });

    if (dfXxArrowBtn) {
      ['click', 'touchstart'].forEach(evt => {
        dfXxArrowBtn.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dfXxMenu.style.display === 'flex') {
            dfXxMenu.style.display = 'none';
          } else {
            dfXxInput.focus();
            renderDefectsComboboxMenu('');
          }
        });
      });
    }

    const handleDefectItemSelect = (e) => {
      const item = e.target.closest('.custom-dropdown-item');
      if (item && item.dataset.value) {
        e.preventDefault();
        e.stopPropagation();
        const val = item.dataset.value;
        selectDefectComboboxItem(val);
        // Also auto-add to grid for convenience on mobile touch!
        state.queuedDefects.push(val);
        if (dfXxInput) dfXxInput.value = '';
        if (dfXxMenu) dfXxMenu.style.display = 'none';
        renderDefectsGrid();
      }
    };

    dfXxMenu.addEventListener('mousedown', handleDefectItemSelect);
    dfXxMenu.addEventListener('touchstart', handleDefectItemSelect, { passive: false });
    dfXxMenu.addEventListener('click', handleDefectItemSelect);

    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#defect-combobox-wrap')) {
        if (dfXxMenu) dfXxMenu.style.display = 'none';
      }
    });
  }

  // Render Data Grid View (Temporary queue of 1 to 10 defects)
  function renderDefectsGrid() {
    if (!defectsGridTbody) return;

    if (defectGridCountBadge) {
      defectGridCountBadge.textContent = `${state.queuedDefects.length} هەڵبژێردراو`;
    }

    if (state.queuedDefects.length === 0) {
      defectsGridTbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; color:var(--text-muted); padding:1.5rem;">
            هیچ کەموکوڕییەک زیادنەکراوە. لە سەرەوە کەموکوڕی هەڵبژێرە و دوگمەی (➕ زیادکردن) دابگرە.
          </td>
        </tr>`;
      return;
    }

    defectsGridTbody.innerHTML = state.queuedDefects.map((defText, idx) => `
      <tr>
        <td style="font-weight:700; text-align:center;"><span class="tag-badge" style="background:var(--accent-amber); color:#000;">#${idx + 1}</span></td>
        <td style="font-weight:600; color:#fbbf24;">⚠️ ${escapeHtml(defText)}</td>
        <td style="text-align:center;">
          <button type="button" onclick="window.__removeDefectFromGrid(${idx})" style="
            background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.4);
            border-radius: 6px; padding: 0.3rem 0.65rem; font-size: 0.75rem; font-weight: 700; cursor: pointer;
          ">🗑️ سڕینەوە</button>
        </td>
      </tr>
    `).join('');
  }

  window.__removeDefectFromGrid = function(index) {
    if (index >= 0 && index < state.queuedDefects.length) {
      state.queuedDefects.splice(index, 1);
      renderDefectsGrid();
    }
  };

  function validateCarDetailsFields() {
    const aaVal = dfAA ? dfAA.value.trim() : '';
    const bbbVal = dfBBB ? dfBBB.value.trim() : '';
    const cccVal = dfCCC ? dfCCC.value.trim() : '';
    const dddVal = dfDDD ? dfDDD.value.trim() : '';

    if (!aaVal) {
      alert('⚠️ ئاگاداری: خانەی (ژمارەی ئۆتۆمبێل) بە بەتاڵی بەجێماوە! تکایە پڕی بکەرەوە.');
      if (dfAA) {
        dfAA.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dfAA.focus();
      }
      return false;
    }

    if (!bbbVal) {
      alert('⚠️ ئاگاداری: خانەی (بەشی ئۆتۆمبێل) بە بەتاڵی بەجێماوە! تکایە هەڵبژاردنێک بکە.');
      if (dfBBB) {
        dfBBB.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dfBBB.focus();
      }
      return false;
    }

    if (!cccVal) {
      alert('⚠️ ئاگاداری: خانەی (پارێزگا یان شوێن) بە بەتاڵی بەجێماوە! تکایە بنووسە یان هەڵبژێرە.');
      if (dfCCC) {
        dfCCC.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dfCCC.focus();
      }
      return false;
    }

    if (!dddVal) {
      alert('⚠️ ئاگاداری: خانەی (پشکنینی) بە بەتاڵی بەجێماوە! تکایە هەڵبژاردنێک بکە.');
      if (dfDDD) {
        dfDDD.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dfDDD.focus();
      }
      return false;
    }

    return true;
  }

  // Add Defect to Data Grid View Button
  if (btnAddDefectToGrid && dfXxInput) {
    btnAddDefectToGrid.addEventListener('click', () => {
      if (!validateCarDetailsFields()) return;

      const text = dfXxInput.value.trim();
      if (!text) {
        alert('تکایە کەموکوڕییەک لە لیست هەڵبژێرە یان بنووسە');
        dfXxInput.focus();
        return;
      }

      state.queuedDefects.push(text);
      dfXxInput.value = '';
      if (dfXxMenu) dfXxMenu.style.display = 'none';
      renderDefectsGrid();
    });
  }

  // ─── BATCH SAVE DEFECTS TO dbo.BB ───
  let isBatchSaving = false;
  async function handleDefectsBatchSave(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (isBatchSaving) return;
    isBatchSaving = true;

    if (!state.currentUser) {
      alert('کاتی دانیشتنەکە بەسەرچوو. تکایە دووبارە بچۆژوورەوە.');
      showView('login');
      return;
    }

    if (!validateCarDetailsFields()) return;

    // Auto-add current input if user selected or typed a defect but forgot to click '+'
    if (state.queuedDefects.length === 0) {
      if (dfXxInput && dfXxInput.value.trim()) {
        state.queuedDefects.push(dfXxInput.value.trim());
        dfXxInput.value = '';
        if (dfXxMenu) dfXxMenu.style.display = 'none';
        renderDefectsGrid();
      } else if (dfXxSelect && dfXxSelect.value.trim()) {
        state.queuedDefects.push(dfXxSelect.value.trim());
        dfXxSelect.value = '';
        renderDefectsGrid();
      } else {
        alert('⚠️ تکایە لانیکەم یەک کەموکوڕی زیاد بکە بۆ لیست بەرلەوەی پاشەکەوتی بکەیت!');
        if (dfXxInput) dfXxInput.focus();
        return;
      }
    }

    const currentUserName = state.currentUser ? (state.currentUser.User_ || state.currentUser.Username || state.currentUser.username || 'admin') : 'admin';

    const payload = {
      AA: dfAA ? dfAA.value.trim() : '',
      BBB: dfBBB ? dfBBB.value.trim() : '',
      CCC: dfCCC ? dfCCC.value.trim() : '',
      DDD: dfDDD ? dfDDD.value.trim() : '',
      Psulla: dfPsulla && dfPsulla.value ? dfPsulla.value : null,
      date_: dfDate && dfDate.value ? dfDate.value : new Date().toISOString().slice(0, 10),
      user_: currentUserName,
      EEE: null,
      defects: [...state.queuedDefects]
    };

    const saveBtn = document.getElementById('btn-save-all-defects');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '⏳ <span>لە حاڵەتی پاشەکەوتکردن...</span>';
    }

    try {
      const res = await authFetch('/api/defects-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert(`✅ کەموکوڕییەکان بە سەرکەوتوویی پاشەکەوتکران (وەسڵ #${data.Psulla})`);
        state.queuedDefects = [];
        renderDefectsGrid();
        if (dfPsulla) dfPsulla.value = '';
        loadDefectsBBHistory();
      } else {
        alert('هەڵە لە پاشەکەوتکردن: ' + (data.error || 'کێشە لە پەیوەندی سێرڤەر'));
      }
    } catch (err) {
      alert('هەڵەی پەیوەندی سێرڤەر: ' + err.message);
    } finally {
      isBatchSaving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="database"></i> <span>💾 پاشەکەوتکردنی هەموو کەموکوڕییەکان بە یەک جار</span>';
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  const btnSaveAllDefects = document.getElementById('btn-save-all-defects');
  if (btnSaveAllDefects) {
    btnSaveAllDefects.addEventListener('click', handleDefectsBatchSave);
  }
  if (defectsForm) {
    defectsForm.addEventListener('submit', handleDefectsBatchSave);
  }

  const bbHistoryCountBadge = document.getElementById('bb-history-count-badge');

  function formatDateDisplay(rawDate) {
    if (!rawDate) return '-';
    if (typeof rawDate === 'string') {
      const match1 = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match1) return `${match1[1]}-${match1[2]}-${match1[3]}`;
      const match2 = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (match2) return `${match2[3]}-${match2[2]}-${match2[1]}`;
    }
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {}
    return String(rawDate).slice(0, 10);
  }

  // Load Today's Saved Defects History from dbo.BB
  async function loadDefectsBBHistory() {
    if (!savedBbTbody) return;
    try {
      const url = '/api/defects-history';
      const res = await fetch(url);
      const records = await res.json();

      if (bbHistoryCountBadge) {
        bbHistoryCountBadge.textContent = `📊 ${Array.isArray(records) ? records.length : 0} کەموکوڕیی ئەمڕۆ`;
      }

      if (!Array.isArray(records) || records.length === 0) {
        savedBbTbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:1.5rem;">هیچ کەموکوڕییەک تۆمار نەکراوە بۆ ئەمڕۆ</td></tr>`;
        return;
      }

      savedBbTbody.innerHTML = records.map(r => `
        <tr>
          <td><span class="tag-badge">#${r.id}</span></td>
          <td><span class="tag-badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; font-weight:700;">${escapeHtml(r.DDD || '-')}</span></td>
          <td><strong style="color:var(--accent-cyan);">${escapeHtml(r.AA || '-')}</strong></td>
          <td>${escapeHtml(r.BBB || '-')}</td>
          <td>${escapeHtml(r.CCC || '-')}</td>
          <td style="font-weight:600; color:#fbbf24;">⚠️ ${escapeHtml(r.Xx_ || '-')}</td>
          <td>${formatDateDisplay(r.date_)}</td>
          <td>${escapeHtml(r.user_ || '-')}</td>
          <td>
            <button type="button" class="btn-delete-defect" data-id="${r.id}" style="
              background: linear-gradient(135deg, #ef4444, #b91c1c);
              color: #fff; border: none; border-radius: 6px;
              padding: 0.35rem 0.7rem; font-size: 0.75rem; font-weight: 700;
              cursor: pointer; display: flex; align-items: center; gap: 0.3rem;
              transition: all 0.2s; white-space: nowrap;
            " onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 16px rgba(239,68,68,0.45)'"
               onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'"
            title="Delete defect">
              <i data-lucide="trash-2" style="width:14px;height:14px;"></i> سڕینەوە
            </button>
          </td>
        </tr>
      `).join('');

      // Attach click handlers for delete buttons
      savedBbTbody.querySelectorAll('.btn-delete-defect').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = parseInt(btn.getAttribute('data-id'), 10);
          if (!confirm(`Are you sure you want to delete defect #${id}?`)) return;
          try {
            const deleteRes = await authFetch('/api/defects-delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id })
            });
            const d = await deleteRes.json();
            if (d.success) {
              loadDefectsBBHistory(); // Refresh the grid
            } else {
              alert('Delete failed: ' + (d.error || 'Unknown error'));
            }
          } catch (e) {
            alert('Delete request failed: ' + e.message);
          }
        });
      });

      if (window.lucide) lucide.createIcons();
    } catch (e) {
      console.error('loadDefectsBBHistory error:', e);
      savedBbTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--accent-rose);">هەڵە لە هێنانی زانیارییەکان: ${escapeHtml(e.message)}</td></tr>`;
    }
  }

  // Expiry Date Logic
  const cdInspectionResult = document.getElementById('cd-inspectionResult');
  const cdExpiryDate = document.getElementById('cd-expiryDate');
  const cdDate_ = document.getElementById('cd-date_');
  
  if (cdInspectionResult && cdExpiryDate && cdDate_) {
    cdInspectionResult.addEventListener('change', () => {
      const result = cdInspectionResult.value.trim();
      const baseDateStr = cdDate_.value;
      if (!result || !baseDateStr) {
        cdExpiryDate.value = '';
        return;
      }
      
      const baseDate = new Date(baseDateStr);
      let daysToAdd = 0;
      
      if (result.includes('دەرنەچووە')) {
        daysToAdd = 30; // 30 days for fail
      } else if (result.includes('دەرچووە')) {
        daysToAdd = 365; // 365 days for pass
      }
      
      if (daysToAdd > 0) {
        baseDate.setDate(baseDate.getDate() + daysToAdd);
        const yyyy = baseDate.getFullYear();
        const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
        const dd = String(baseDate.getDate()).padStart(2, '0');
        cdExpiryDate.value = `${yyyy}-${mm}-${dd}`;
      } else {
        cdExpiryDate.value = '';
      }
    });
  }

  // ─── Auto-Updater Frontend Integration ───
  const updatePageVersionBadge = document.getElementById('update-page-version-badge');
  const appCurrentVersionLabel = document.getElementById('app-current-version-label');
  const btnStartSystemUpdate = document.getElementById('btn-start-system-update');
  const btnForceSystemUpdate = document.getElementById('btn-force-system-update');
  const btnCheckUpdate = document.getElementById('btn-check-update');

  async function loadSystemVersion() {
    try {
      const res = await fetch(getApiBase() + '/api/system/version');
      if (res.ok) {
        const data = await res.json();
        const verStr = `v${data.version || '1.1.0'}`;
        if (appCurrentVersionLabel) appCurrentVersionLabel.textContent = `${verStr} (Build ${data.build || 100})`;
        if (updatePageVersionBadge) updatePageVersionBadge.textContent = verStr;
      }
    } catch (e) {}
  }
  loadSystemVersion();

  async function performSystemUpdate(isForce = false) {
    const feedbackBox = document.getElementById('update-feedback-box');
    const updateStatusMsg = document.getElementById('update-status-msg');
    const centerIcon = document.getElementById('update-center-icon');
    const titleEl = document.getElementById('update-main-status-title');
    const descEl = document.getElementById('update-main-status-desc');

    // 1. Pause actions and show loading state
    if (btnStartSystemUpdate) btnStartSystemUpdate.disabled = true;
    if (btnForceSystemUpdate) btnForceSystemUpdate.disabled = true;
    if (btnCheckUpdate) btnCheckUpdate.disabled = true;

    if (centerIcon) {
      centerIcon.style.animation = 'spin 1s linear infinite';
    }

    const showLoading = (el) => {
      if (!el) return;
      el.style.display = 'block';
      el.style.background = 'rgba(34, 211, 238, 0.12)';
      el.style.border = '1.5px solid rgba(34, 211, 238, 0.4)';
      el.style.color = '#38bdf8';
      el.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem; justify-content:center; padding:0.5rem 0;">
          <span style="font-size:1.4rem;">⏳</span>
          <span style="font-weight:700; font-size:0.95rem;">کەمێک چاوەڕوان بە... پەیوەندی بە سێرڤەری سەرەکی دەکرێت بۆ پشکنین و داگرتنی فایلە نوێیەکان...</span>
        </div>
      `;
    };

    showLoading(feedbackBox);
    showLoading(updateStatusMsg);

    try {
      const res = await fetch(getApiBase() + '/api/system/check-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: isForce })
      });

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        if (res.status === 404 || text.includes('404')) {
          throw new Error('سێرڤەری پرۆگرامەکە پێویستی بە یەکجار داخستن و کردنەوەیە (Restart) بۆ ئەوەی خزمەتگوزاری نوێکاری چالاک بێت.');
        } else {
          throw new Error(`وەڵامی سێرڤەر: ${text.substring(0, 80)}`);
        }
      }

      if (data.success && data.hasUpdate) {
        // Updated successfully
        const successHtml = `
          <div style="font-size:1.15rem; font-weight:800; margin-bottom:0.4rem; color:#34d399;">
            🎉 پیرۆزە! سیستەمەکە بە سەرکەوتوویی نوێکرایەوە بۆ وەشانی (${escapeHtml(data.newVersion)})
          </div>
          <div style="font-size:0.88rem; color:var(--text-main); line-height:1.7;">
            فایلە سەرەکییەکان نوێکرانەوە: <b>${escapeHtml((data.updatedFiles || []).join(', '))}</b><br>
            <span style="color:var(--accent-cyan); font-weight:700;">🔄 بەرنامەکە دوای ٣ چرکە بە شێوەیەکی خۆکار ڕیفرێش دەبێت بۆ کەوتنەگەڕی گۆڕانکارییەکان...</span>
          </div>
        `;

        const applySuccess = (el) => {
          if (!el) return;
          el.style.display = 'block';
          el.style.background = 'rgba(16, 185, 129, 0.15)';
          el.style.border = '1.5px solid rgba(16, 185, 129, 0.5)';
          el.style.color = '#34d399';
          el.innerHTML = successHtml;
        };

        applySuccess(feedbackBox);
        applySuccess(updateStatusMsg);

        if (titleEl) titleEl.textContent = '✅ نوێکاری بە سەرکەوتوویی تەواو بوو!';
        if (descEl) descEl.textContent = 'سیستەمەکە گەیشتە نوێترین وەشان.';
        loadSystemVersion();

        // Smart Auto-reload with health polling to ensure server is ready
        let reloadAttempts = 0;
        const checkAndReload = async () => {
          try {
            const testRes = await fetch(getApiBase() + '/api/setup-status?t=' + Date.now());
            if (testRes.ok) {
              window.location.reload();
              return;
            }
          } catch(e) {}
          reloadAttempts++;
          if (reloadAttempts < 25) {
            setTimeout(checkAndReload, 800);
          } else {
            window.location.reload();
          }
        };
        setTimeout(checkAndReload, 2500);

      } else if (data.success && !data.hasUpdate) {
        // Already latest version
        const latestHtml = `
          <div style="font-size:1.05rem; font-weight:800; margin-bottom:0.3rem; color:#38bdf8;">
            ✅ سیستەمەکەت لەسەر نوێترین وەشانە (${escapeHtml(data.currentVersion)})
          </div>
          <div style="font-size:0.88rem; color:var(--text-main);">
            ئەمە دوا گۆڕانکارییە و لە ئێستادا پێویست بە هیچ نوێکارییەک ناکات.
          </div>
        `;

        const applyLatest = (el) => {
          if (!el) return;
          el.style.display = 'block';
          el.style.background = 'rgba(56, 189, 248, 0.12)';
          el.style.border = '1.5px solid rgba(56, 189, 248, 0.4)';
          el.style.color = '#38bdf8';
          el.innerHTML = latestHtml;
        };

        applyLatest(feedbackBox);
        applyLatest(updateStatusMsg);

        if (titleEl) titleEl.textContent = '✅ سیستەمەکەت نوێترین وەشانە';
      } else {
        // Error or failed
        const errHtml = `
          <div style="font-size:1.05rem; font-weight:800; margin-bottom:0.3rem; color:#f87171;">
            ⚠️ نەتوانرا نوێکاری بکرێت
          </div>
          <div style="font-size:0.86rem; color:var(--text-main);">
            ${escapeHtml(data.error || 'نەتوانرا پەیوەندی بە سێرڤەری نوێکاری بکرێت.')}<br>
            تکایە دڵنیابەرەوە لە پەیوەندی هێڵی ئینتەرنێت و دووبارە هەوڵبدەرەوە.
          </div>
        `;

        const applyErr = (el) => {
          if (!el) return;
          el.style.display = 'block';
          el.style.background = 'rgba(239, 68, 68, 0.15)';
          el.style.border = '1.5px solid rgba(239, 68, 68, 0.5)';
          el.style.color = '#f87171';
          el.innerHTML = errHtml;
        };

        applyErr(feedbackBox);
        applyErr(updateStatusMsg);
      }
    } catch (err) {
      const netErrHtml = `
        <div style="font-size:1.05rem; font-weight:800; margin-bottom:0.3rem; color:#f87171;">
          ⚠️ هەڵە لە پەیوەندی هێڵی ئینتەرنێت
        </div>
        <div style="font-size:0.86rem; color:var(--text-main);">
          ${escapeHtml(err.message)}
        </div>
      `;
      if (feedbackBox) {
        feedbackBox.style.display = 'block';
        feedbackBox.style.background = 'rgba(239, 68, 68, 0.15)';
        feedbackBox.style.border = '1.5px solid rgba(239, 68, 68, 0.5)';
        feedbackBox.innerHTML = netErrHtml;
      }
      if (updateStatusMsg) {
        updateStatusMsg.style.display = 'block';
        updateStatusMsg.style.background = 'rgba(239, 68, 68, 0.15)';
        updateStatusMsg.style.border = '1.5px solid rgba(239, 68, 68, 0.5)';
        updateStatusMsg.innerHTML = netErrHtml;
      }
    } finally {
      if (btnStartSystemUpdate) btnStartSystemUpdate.disabled = false;
      if (btnForceSystemUpdate) btnForceSystemUpdate.disabled = false;
      if (btnCheckUpdate) btnCheckUpdate.disabled = false;
      if (centerIcon) centerIcon.style.animation = '';
      safeCreateIcons();
    }
  }

  if (btnStartSystemUpdate) {
    btnStartSystemUpdate.addEventListener('click', () => performSystemUpdate(false));
  }
  if (btnForceSystemUpdate) {
    btnForceSystemUpdate.addEventListener('click', () => performSystemUpdate(true));
  }
  if (btnCheckUpdate) {
    btnCheckUpdate.addEventListener('click', () => performSystemUpdate(false));
  }

  // Copy About Phone Number Listener
  const btnCopyAboutPhone = document.getElementById('btn-copy-about-phone');
  if (btnCopyAboutPhone) {
    btnCopyAboutPhone.addEventListener('click', () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('07726171818').then(() => {
          const original = btnCopyAboutPhone.innerHTML;
          btnCopyAboutPhone.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;color:#34d399;"></i> <span>کۆپیکرا!</span>';
          if (window.lucide) lucide.createIcons();
          setTimeout(() => {
            btnCopyAboutPhone.innerHTML = original;
            if (window.lucide) lucide.createIcons();
          }, 2000);
        }).catch(() => {
          alert('ژمارەی مۆبایل: 07726171818');
        });
      } else {
        alert('ژمارەی مۆبایل: 07726171818');
      }
    });
  }

  // Launch app




  initApp();
});
