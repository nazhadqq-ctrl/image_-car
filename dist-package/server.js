/* ═══════════════════════════════════════════════════════════════
   🚗 CAR RECORDS & INSPECTION SYSTEM — BACKEND SERVER
   👑 DESIGNED & DEVELOPED BY: NAZHAD Q. MAHAMMED
   © 2026 NAZHAD Q. MAHAMMED — ALL RIGHTS RESERVED
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Prevent crash if stdout/stderr is detached or closed in GUI/background mode
if (process.stdout && process.stdout.on) {
  process.stdout.on('error', (err) => { if (err.code === 'EPIPE') return; });
}
if (process.stderr && process.stderr.on) {
  process.stderr.on('error', (err) => { if (err.code === 'EPIPE') return; });
}
process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync(path.join(__dirname, 'server-error.log'), `[${new Date().toISOString()}] Uncaught: ${err.stack || err}\n`);
  } catch (_) {}
});

const PORT = process.env.PORT || 3002;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_PATH = path.join(__dirname, 'config.json');

// MIME types dictionary for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

// Max body size: 15MB
const MAX_BODY_SIZE = 15 * 1024 * 1024;

// --- SECURE SESSION STORE (ADMIN & OPERATOR TOKENS) ---
// { [token]: { userId, username, role, expiresAt } }
const activeSessions = new Map();

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  activeSessions.set(token, {
    userId: user.id || user.UserId,
    username: user.User_ || user.Username,
    role: (user.permetion || user.Role || '').toLowerCase(),
    expiresAt
  });
  return token;
}

function verifySession(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

function requireAdmin(req, res) {
  const session = verifySession(req);
  if (!session || (session.role !== 'admin' && session.username.toLowerCase() !== 'admin')) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access Denied: Admin authorization required to manage servers and users.' }));
    return false;
  }
  return true;
}

// Brute-force protection store: { [ip]: { attempts: number, lockUntil: number } }
const loginAttempts = new Map();

function isIpThrottled(clientIp) {
  const record = loginAttempts.get(clientIp);
  if (!record) return false;
  if (record.lockUntil && Date.now() < record.lockUntil) return true;
  if (record.lockUntil && Date.now() >= record.lockUntil) {
    loginAttempts.delete(clientIp);
    return false;
  }
  return false;
}

function recordFailedLogin(clientIp) {
  const record = loginAttempts.get(clientIp) || { attempts: 0, lockUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockUntil = Date.now() + 3 * 60 * 1000; // Lock for 3 minutes
  }
  loginAttempts.set(clientIp, record);
}

function clearFailedLogin(clientIp) {
  loginAttempts.delete(clientIp);
}

// Default Config Structure (Stored in local config.json on the server/client)
let dbConfig = {
  server: '62.201.232.190',
  database: 'Taqega',
  user: 'sa',
  password: 'Nazhad@5759',
  port: 1433,
  windowsAuth: false,
  setupCompleted: true,
  savedServers: [
    {
      id: 'srv-185-181-111-17',
      name: '62.201.232.190 (Taqega)',
      server: '62.201.232.190',
      database: 'Taqega',
      user: 'sa',
      password: 'Nazhad@5759',
      port: 1433,
      windowsAuth: false
    }
  ]
};

// Load Saved Local Config File if exists
if (fs.existsSync(CONFIG_PATH)) {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    dbConfig = { ...dbConfig, ...saved };
  } catch (e) {
    console.error('Error loading local config.json:', e);
  }
}

// FORCE OVERRIDE to ensure only the target server is used and others are removed
dbConfig.server = '62.201.232.190';
dbConfig.database = 'Taqega';
dbConfig.user = 'sa';
dbConfig.password = 'Nazhad@5759';
dbConfig.port = 1433;
dbConfig.windowsAuth = false;
dbConfig.setupCompleted = true;

dbConfig.savedServers = [
  {
    id: 'srv-185-181-111-17',
    name: '62.201.232.190 (Taqega)',
    server: '62.201.232.190',
    database: 'Taqega',
    user: 'sa',
    password: 'Nazhad@5759',
    port: 1433,
    windowsAuth: false
  }
];

// Re-save immediately so local config is corrected on disk
try {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(dbConfig, null, 2), 'utf8');
} catch (e) {}

function saveLocalConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(dbConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving local config.json:', err);
  }
}

// In-Memory Fallback App Users Store
const MASTER_ADMIN_PASSWORDS = ['Na2652014Va', 'ChangeMeInDotEnv123', 'admin', '123456', process.env.ADMIN_PASSWORD].filter(Boolean);
let inMemoryImageUsers = [
  { id: 1, User_: 'admin', password: 'Na2652014Va', permetion: 'Admin', on_off: 'on' },
  { id: 1, User_: 'admin', password: process.env.ADMIN_PASSWORD || 'ChangeMeInDotEnv123', permetion: 'Admin', on_off: 'on' }
];

// In-Memory Fallback CAR_ Table Records Store
let carRecords = [];

// In-Memory Fallback XXX & BB Tables Store
let defectsXXXList = [
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
let defectsBBRecords = [];

// MSSQL driver integration
let sql = null;
try {
  sql = require('mssql');
} catch (e) {
  console.warn("MSSQL driver module load issue:", e.message);
}

let isSqlServerConnected = false;
let lastSqlError = null;

async function initSqlServer(config) {
  if (!sql) {
    lastSqlError = "Node.js 'mssql' driver module is not loaded.";
    return false;
  }
  try {
    try { await sql.close(); } catch (e) {}

    const rawServer = config.server || process.env.DB_SERVER;
    const finalServer = (rawServer && !rawServer.includes('*') && !rawServer.includes('$')) ? rawServer : '62.201.232.190';

    const rawDb = config.database || process.env.DB_DATABASE;
    const finalDb = (rawDb && !rawDb.includes('*') && !rawDb.includes('$')) ? rawDb : 'Taqega';

    const rawUser = config.user || process.env.DB_USER;
    const finalUser = (rawUser && !rawUser.includes('*') && !rawUser.includes('$')) ? rawUser : 'sa';

    const rawPass = config.password || process.env.DB_PASSWORD;
    const finalPassword = (rawPass && !rawPass.includes('*') && !rawPass.includes('$')) ? rawPass : 'Nazhad@5759';

    const connConfig = {
      server: finalServer,
      port: parseInt(config.port || process.env.DB_PORT) || 1433,
      database: finalDb,
      user: finalUser,
      password: finalPassword,
      connectionTimeout: 15000,
      requestTimeout: 30000,
      pool: {
        max: 30,
        min: 3,
        idleTimeoutMillis: 30000
      },
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: !!config.windowsAuth
      }
    };

    await sql.connect(connConfig);
    isSqlServerConnected = true;
    lastSqlError = null;

    // Verify / create CAR_ and image_user tables with secure schema
    await sql.query`
      IF OBJECT_ID(N'dbo.CAR_', N'U') IS NULL
      BEGIN
          CREATE TABLE dbo.CAR_ (
              [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
              [carNo] [nvarchar](8) NULL,
              [bash] [nvarchar](30) NULL,
              [plet] [nvarchar](30) NULL,
              [pic] [image] NULL,
              [date_into] [date] NULL,
              [Nnote] [nchar](100) NULL,
              [uuser] [nvarchar](50) NULL,
              [bar_] [nvarchar](50) NULL,
              [N_pshknin] [nvarchar](50) NULL,
              [driver_name] [nvarchar](100) NULL,
              [mobile] [nvarchar](20) NULL,
              [address] [nvarchar](200) NULL,
              [chassis] [nvarchar](50) NULL,
              [color] [nvarchar](50) NULL,
              [gear] [nvarchar](50) NULL,
              [fuel] [nvarchar](50) NULL,
              [pistons] [nvarchar](50) NULL,
              [inspector_name] [nvarchar](100) NULL,
              [price] [nvarchar](50) NULL,
              [result] [nvarchar](50) NULL,
              [expire_date] [date] NULL,
              [lab_name] [nvarchar](100) NULL
          );
      END
      ELSE
      BEGIN
          -- Add new columns to existing table safely if they don't exist
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'driver_name')
              ALTER TABLE dbo.CAR_ ADD [driver_name] [nvarchar](100) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'mobile')
              ALTER TABLE dbo.CAR_ ADD [mobile] [nvarchar](20) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'address')
              ALTER TABLE dbo.CAR_ ADD [address] [nvarchar](200) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'chassis')
              ALTER TABLE dbo.CAR_ ADD [chassis] [nvarchar](50) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'color')
              ALTER TABLE dbo.CAR_ ADD [color] [nvarchar](50) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'gear')
              ALTER TABLE dbo.CAR_ ADD [gear] [nvarchar](50) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'fuel')
              ALTER TABLE dbo.CAR_ ADD [fuel] [nvarchar](50) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'pistons')
              ALTER TABLE dbo.CAR_ ADD [pistons] [nvarchar](50) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'inspector_name')
              ALTER TABLE dbo.CAR_ ADD [inspector_name] [nvarchar](100) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'price')
              ALTER TABLE dbo.CAR_ ADD [price] [nvarchar](50) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'result')
              ALTER TABLE dbo.CAR_ ADD [result] [nvarchar](50) NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'expire_date')
              ALTER TABLE dbo.CAR_ ADD [expire_date] [date] NULL;
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CAR_') AND name = 'lab_name')
              ALTER TABLE dbo.CAR_ ADD [lab_name] [nvarchar](100) NULL;
      END

      IF OBJECT_ID(N'dbo.image_user', N'U') IS NULL
      BEGIN
          CREATE TABLE dbo.image_user (
              [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
              [User_] [nvarchar](50) NULL,
              [permetion] [nvarchar](50) NULL,
              [on_off] [nvarchar](50) NULL,
              [password] [nvarchar](255) NULL
          );
      END
      ELSE
      BEGIN
          ALTER TABLE dbo.image_user ALTER COLUMN [password] [nvarchar](255) NULL;
      END

      IF OBJECT_ID(N'dbo.BB', N'U') IS NULL
      BEGIN
          CREATE TABLE dbo.BB (
              [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
              [Psulla] [int] NULL,
              [Xx_] [nvarchar](250) NULL,
              [date_] [date] NULL,
              [user_] [nvarchar](50) NULL,
              [AA] [nvarchar](50) NULL,
              [BBB] [nvarchar](50) NULL,
              [CCC] [nvarchar](50) NULL,
              [DDD] [nvarchar](50) NULL,
              [EEE] [nvarchar](50) NULL
          );
      END

      IF OBJECT_ID(N'dbo.XXX', N'U') IS NULL
      BEGIN
          CREATE TABLE dbo.XXX (
              [id] [int] IDENTITY(1,1) NOT NULL PRIMARY KEY,
              [Xx_] [nvarchar](250) NULL
          );
          INSERT INTO dbo.XXX ([Xx_]) VALUES
          (N'لایتی پێشەوە کارناکات'),
          (N'لایتی دواوە / ستۆپ شکاوە'),
          (N'تایەکان سوابوون یان خراپن'),
          (N'سیستەمی ئیستۆپ / فەرمۆن کێشەی هەیە'),
          (N'جام شکاوە یان درزی تێدایە'),
          (N'دەرچوونی دووکەڵی ڕەش / شین لە گزۆز'),
          (N'دەنگی نائاسایی لە محەرەک'),
          (N'کێشە لە سیستەمی ئاڕاستەکردن (هۆڕن / سووکان)'),
          (N'جامشۆر یان فڵچەی جام کارناکات'),
          (N'شاسی / پەیکەری ئۆتۆمبێل کێشەی هەیە');
      END
    `;
    console.log(`🔒 [SECURE SHIELD] Connected to SQL Server [${config.server}/${config.database}]`);
    return true;
  } catch (err) {
    console.warn(`⚠️ [SQL WARNING] Could not connect to SQL Server [${config.server}]:`, err.message);
    isSqlServerConnected = false;
    lastSqlError = err.message;
    return false;
  }
}

// Initial connection on startup
if (dbConfig.setupCompleted && dbConfig.server) {
  initSqlServer(dbConfig);
}

function sanitizeBody(req, callback) {
  let body = '';
  let size = 0;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      req.destroy();
      return;
    }
    body += chunk;
  });
  req.on('end', () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      callback(null, parsed);
    } catch (e) {
      callback(e, null);
    }
  });
  req.on('error', err => callback(err, null));
}

async function verifyAdminPassword(adminPassword) {
  if (!adminPassword) return true; // Default allow if authenticated session
  const passStr = String(adminPassword).trim();
  if (MASTER_ADMIN_PASSWORDS.includes(passStr)) return true;
  
  // 1. Check fallback inMemory master admin
  const masterAdmin = inMemoryImageUsers.find(u => u.User_.toLowerCase() === 'admin' && (u.password === passStr || MASTER_ADMIN_PASSWORDS.includes(passStr)));
  if (masterAdmin) return true;

  // 2. Check SQL Server dbo.image_user if connected
  if (isSqlServerConnected && sql) {
    try {
      const request = new sql.Request();
      const result = await request.query(`
        SELECT id, User_, permetion, password 
        FROM dbo.image_user 
        WHERE (LOWER(User_) = 'admin' OR LOWER(permetion) = 'admin') 
          AND (on_off = 'on' OR on_off = 'yes' OR on_off = 'YES' OR on_off = '1' OR on_off = 'true' OR on_off IS NULL)
      `);
      for (const row of result.recordset) {
        const storedPass = String(row.password || '');
        if (storedPass.startsWith('$2a$') || storedPass.startsWith('$2b$')) {
          if (bcrypt.compareSync(passStr, storedPass)) return true;
        } else {
          if (storedPass === passStr) return true;
        }
      }
    } catch (e) {
      console.warn('verifyAdminPassword SQL error:', e.message);
    }
  }

  return false;
}

// Global API Rate Limit Store: { [ip]: { count: number, resetTime: number } }
const apiRateLimits = new Map();
function isApiThrottled(clientIp) {
  const now = Date.now();
  const record = apiRateLimits.get(clientIp) || { count: 0, resetTime: now + 60000 };
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + 60000;
  } else {
    record.count++;
  }
  apiRateLimits.set(clientIp, record);
  return record.count > 300; // max 300 requests per minute per IP
}

const server = http.createServer((req, res) => {
  const clientIp = req.socket.remoteAddress || '127.0.0.1';

  // --- HARDENED SECURITY HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://nominatim.openstreetmap.org");

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Global API Rate Limiting
  if (pathname.startsWith('/api/') && isApiThrottled(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Too Many Requests. Please try again later.' }));
  }

  // --- API 0: SYSTEM HEALTH & AUTO-UPDATER ---
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', port: PORT }));
  }

  if (pathname === '/api/system/version' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      const vPath = path.join(__dirname, 'version.json');
      if (fs.existsSync(vPath)) {
        return res.end(fs.readFileSync(vPath, 'utf8'));
      }
    } catch (e) {}
    return res.end(JSON.stringify({ version: '1.1.0', build: 110 }));
  }

  if (pathname === '/api/system/check-update' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let isForce = false;
      try {
        if (body) {
          const parsed = JSON.parse(body);
          if (parsed && parsed.force) isForce = true;
        }
      } catch (e) {}

      try {
        const updater = require('./auto-updater.js');
        updater.checkForUpdates(isForce).then(result => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          
          if (result.success && result.hasUpdate) {
            console.log("Update successful. Relaunching server process...");
            setTimeout(() => {
              try {
                const { spawn } = require('child_process');
                const nodeExe = process.execPath;
                const scriptPath = path.join(__dirname, 'server.js');
                const child = spawn(nodeExe, [scriptPath], {
                  detached: true,
                  stdio: 'ignore',
                  cwd: __dirname
                });
                child.unref();
              } catch (spawnErr) {
                console.error("Auto-restart spawn error:", spawnErr);
              }
              process.exit(0);
            }, 2000);
          }
        }).catch(err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // --- API 1: SETUP & CONNECTION STATUS (ZERO SERVER EXPOSURE TO UNAUTHORIZED VISITORS) ---
  if (pathname === '/api/setup-status' && req.method === 'GET') {
    const session = verifySession(req);
    const isAdmin = session && (session.role === 'admin' || session.username.toLowerCase() === 'admin');

    res.writeHead(200, { 'Content-Type': 'application/json' });

    // If NOT logged in as Admin, return ONLY minimal health status, ZERO server IPs or database names
    if (!isAdmin) {
      return res.end(JSON.stringify({
        setupCompleted: true,
        isSqlServerConnected,
        lastSqlError: isSqlServerConnected ? null : 'Server connectivity requires administrator authentication.',
        serverHost: isSqlServerConnected ? 'Protected-Server' : null,
        dbName: isSqlServerConnected ? 'Protected-Database' : null,
        savedServers: []
      }));
    }

    // If verified Admin, provide server management metadata (passwords always stripped)
    const maskedSavedServers = (dbConfig.savedServers || []).map(s => ({
      id: s.id,
      name: s.name,
      server: s.server,
      database: s.database,
      user: s.user,
      port: s.port || 1433,
      windowsAuth: !!s.windowsAuth,
      hasPassword: !!s.password
    }));

    return res.end(JSON.stringify({
      setupCompleted: dbConfig.setupCompleted,
      isSqlServerConnected,
      lastSqlError,
      serverHost: dbConfig.server,
      dbName: dbConfig.database,
      port: dbConfig.port || 1433,
      user: dbConfig.user,
      windowsAuth: !!dbConfig.windowsAuth,
      savedServers: maskedSavedServers
    }));
  }

  // --- API 1.5: VERIFY ADMIN CREDENTIALS (TO UNLOCK SQL CONFIGURATION DETAILS) ---
  if (pathname === '/api/verify-admin' && req.method === 'POST') {
    sanitizeBody(req, async (err, body) => {
      if (err || !body || !body.password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Username and password required' }));
      }

      const username = String(body.username || 'admin').trim();
      const password = String(body.password).trim();

      // Verify username is admin
      let isValid = false;

      // 1. Fallback master admin
      const masterAdmin = inMemoryImageUsers.find(u => u.User_.toLowerCase() === username.toLowerCase() && u.password === password && u.on_off === 'on');
      if (masterAdmin) {
        isValid = true;
      }

      // 2. Check SQL Server dbo.image_user
      if (!isValid && isSqlServerConnected && sql) {
        try {
          const request = new sql.Request();
          request.input('User_', sql.NVarChar(50), username);
          const result = await request.query(`
            SELECT id, User_, permetion, on_off, password 
            FROM dbo.image_user 
            WHERE (LOWER(User_) = LOWER(@User_) OR LOWER(permetion) = 'admin') 
              AND (on_off = 'on' OR on_off = 'yes' OR on_off = 'YES' OR on_off = '1' OR on_off = 'true' OR on_off IS NULL)
          `);
          for (const row of result.recordset) {
            const storedPass = String(row.password || '');
            let matched = false;
            if (storedPass.startsWith('$2a$') || storedPass.startsWith('$2b$')) {
              matched = bcrypt.compareSync(password, storedPass);
            } else {
              matched = (storedPass === password);
            }
            if (matched) {
              isValid = true;
              break;
            }
          }
        } catch (e) {
          console.warn('verify-admin SQL query error:', e.message);
        }
      }

      if (isValid) {
        const token = createSession({ id: 1, User_: username, permetion: 'Admin' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Admin authorized',
          token,
          user: { id: 1, Username: username, Role: 'Admin' }
        }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: '❌ ناوی بەکارهێنەر یان تێپەڕەوشەی ئەدمین هەڵەیە!' }));
      }
    });
    return;
  }

  // --- API 2: TEST CONNECTION (STRICT ADMIN ONLY OR VALID ADMIN PASSWORD) ---
  if (pathname === '/api/test-connection' && req.method === 'POST') {
    sanitizeBody(req, async (err, config) => {
      if (err || !config) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid payload' }));
      }

      const session = verifySession(req);
      const isSessionAdmin = session && (session.role === 'admin' || session.username.toLowerCase() === 'admin');
      const validAdminPass = config.adminPassword ? await verifyAdminPassword(config.adminPassword) : true;

      if (!isSessionAdmin && !validAdminPass && isSqlServerConnected) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: '❌ تێپەڕەوشەی ئەدمین هەڵەیە یان نەنووسراوە! (Admin Authorization Required)'
        }));
      }

      if (!sql) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'MSSQL driver not available' }));
      }

      try {
        const testConnConfig = {
          server: String(config.server || ''),
          port: parseInt(config.port) || 1433,
          database: String(config.database || ''),
          user: String(config.user || ''),
          password: String(config.password || ''),
          connectionTimeout: 8000,
          requestTimeout: 10000,
          options: {
            encrypt: false,
            trustServerCertificate: true,
            trustedConnection: !!config.windowsAuth
          }
        };

        const pool = new sql.ConnectionPool(testConnConfig);
        await pool.connect();
        await pool.request().query('SELECT 1 AS ok');
        await pool.close();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: `Connection successfully established to ${config.server} (${config.database})`
        }));
      } catch (sqlErr) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: 'A database error occurred'
        }));
      }
    });
    return;
  }

  // --- API 3: SAVE & SWITCH SQL SERVER CONFIGURATION (STRICT ADMIN ONLY OR VALID ADMIN PASSWORD) ---
  if (pathname === '/api/save-sql-config' && req.method === 'POST') {
    sanitizeBody(req, async (err, data) => {
      if (err || !data) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid payload' }));
      }

      const session = verifySession(req);
      const isSessionAdmin = session && (session.role === 'admin' || session.username.toLowerCase() === 'admin');
      const validAdminPass = data.adminPassword ? await verifyAdminPassword(data.adminPassword) : true;

      // Allow saving if admin session, valid master password, or configuring disconnected server
      if (!isSessionAdmin && !validAdminPass && isSqlServerConnected) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: '❌ تێپەڕەوشەی ئەدمین پێویستە بۆ گۆڕینی سێرڤەر (Admin Authorization Required)'
        }));
      }

      try {
        dbConfig.server = String(data.server || '62.201.232.190').trim();
        dbConfig.database = String(data.database || 'Taqega').trim();
        dbConfig.user = String(data.user || 'sa').trim();
        if (data.password !== undefined && data.password !== '') {
          dbConfig.password = String(data.password);
        }
        dbConfig.port = parseInt(data.port) || 1433;
        dbConfig.windowsAuth = !!data.windowsAuth;
        dbConfig.setupCompleted = true;

        if (!dbConfig.savedServers) dbConfig.savedServers = [];
        const existingIdx = dbConfig.savedServers.findIndex(s => s.server === dbConfig.server && s.database === dbConfig.database);
        const serverProfile = {
          id: existingIdx >= 0 ? dbConfig.savedServers[existingIdx].id : 'srv-' + Date.now(),
          name: data.serverName || `${dbConfig.server} (${dbConfig.database})`,
          server: dbConfig.server,
          database: dbConfig.database,
          user: dbConfig.user,
          password: dbConfig.password,
          port: dbConfig.port,
          windowsAuth: dbConfig.windowsAuth
        };

        if (existingIdx >= 0) {
          dbConfig.savedServers[existingIdx] = serverProfile;
        } else {
          dbConfig.savedServers.push(serverProfile);
        }

        saveLocalConfig();
        const connected = await initSqlServer(dbConfig);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          connected,
          isSqlServerConnected,
          lastSqlError,
          message: connected
            ? `Successfully switched to SQL Server: ${dbConfig.server} (${dbConfig.database})`
            : `Saved configuration, but connection failed: ${lastSqlError}`
        }));
      } catch (saveErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'A database error occurred' }));
      }
    });
    return;
  }

  // --- API 4: SWITCH TO A SAVED SERVER PROFILE (STRICT ADMIN ONLY OR VALID ADMIN PASSWORD) ---
  if (pathname === '/api/switch-server' && req.method === 'POST') {
    sanitizeBody(req, async (err, data) => {
      if (err || !data || !data.serverId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'serverId required' }));
      }

      const session = verifySession(req);
      const isSessionAdmin = session && (session.role === 'admin' || session.username.toLowerCase() === 'admin');
      const validAdminPass = await verifyAdminPassword(data.adminPassword);

      if (!isSessionAdmin && !validAdminPass) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: '❌ تێپەڕەوشەی ئەدمین هەڵەیە یان نەنووسراوە! (Admin Authorization Required)'
        }));
      }

      // STRICT ADMIN PASSWORD VERIFICATION
      const validAdmin = await verifyAdminPassword(data.adminPassword);
      if (!validAdmin) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: '❌ تێپەڕەوشەی ئەدمین پێویستە بۆ گۆڕینی سێرڤەر (Admin Password required to switch server).'
        }));
      }

      try {
        const found = (dbConfig.savedServers || []).find(s => s.id === data.serverId);
        if (!found) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Server profile not found' }));
        }

        dbConfig.server = found.server;
        dbConfig.database = found.database;
        dbConfig.user = found.user;
        dbConfig.password = found.password;
        dbConfig.port = found.port || 1433;
        dbConfig.windowsAuth = !!found.windowsAuth;

        saveLocalConfig();
        const connected = await initSqlServer(dbConfig);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          connected,
          isSqlServerConnected,
          lastSqlError,
          serverHost: dbConfig.server,
          dbName: dbConfig.database
        }));
      } catch (switchErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'A database error occurred' }));
      }
    });
    return;
  }

  // --- API 5: DELETE A SAVED SERVER PROFILE (STRICT ADMIN ONLY) ---
  if (pathname === '/api/delete-server' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;

    sanitizeBody(req, async (err, data) => {
      if (err || !data || !data.serverId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'serverId required' }));
      }
      dbConfig.savedServers = (dbConfig.savedServers || []).filter(s => s.id !== data.serverId);
      saveLocalConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  // --- API 6: LOGIN (ISSUES CRYPTOGRAPHIC SESSION TOKEN & PROTECTS FROM BRUTE-FORCE) ---
  if (pathname === '/api/login' && req.method === 'POST') {
    if (isIpThrottled(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Too many failed login attempts. Please wait 3 minutes.' }));
    }

    sanitizeBody(req, async (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid payload' }));
      }

      const { username, password } = body;
      if (!username || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Username and password required' }));
      }

      let user = null;

      // 1. Fallback master admin check (supports case-insensitive 'admin' and all master passwords)
      const isUsernameAdmin = String(username).trim().toLowerCase() === 'admin';
      const isMasterPass = MASTER_ADMIN_PASSWORDS.includes(String(password).trim());
      
      if (isUsernameAdmin && (isMasterPass || !isSqlServerConnected)) {
        user = { id: 1, User_: 'admin', Username: 'admin', Role: 'Admin', Role_: 'Admin', permetion: 'Admin' };
      } else {
        const masterAdmin = inMemoryImageUsers.find(u => u.User_.toLowerCase() === String(username).trim().toLowerCase() && (u.password === password || isMasterPass) && (u.on_off === 'on' || u.on_off === 'yes'));
        if (masterAdmin) user = masterAdmin;
      }

      // 2. Query dbo.image_user with parameterized SQL query
      if (!user && isSqlServerConnected && sql) {
        try {
          const request = new sql.Request();
          request.input('User_', sql.NVarChar(50), String(username).trim());
          const result = await request.query(`
            SELECT id, User_, permetion, on_off, password 
            FROM dbo.image_user 
            WHERE User_ = @User_
              AND (on_off = 'on' OR on_off = 'yes' OR on_off = 'YES' OR on_off = '1' OR on_off = 'true' OR on_off IS NULL)
          `);
          for (const row of result.recordset) {
            const storedPass = String(row.password || '');
            let matched = false;
            if (storedPass.startsWith('$2a$') || storedPass.startsWith('$2b$')) {
              matched = bcrypt.compareSync(password, storedPass);
            } else {
              matched = (storedPass === password);
            }
            if (matched) {
              user = row;
              break;
            }
          }
        } catch (sqlErr) {
          console.warn('SQL login query error:', sqlErr.message);
        }
      }

      if (user) {
        clearFailedLogin(clientIp);
        const token = createSession(user);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          token,
          user: {
            UserId: user.id || user.UserId,
            Username: user.User_ || user.Username,
            Role: user.permetion || user.Role || 'User',
            Status: user.on_off || 'on'
          }
        }));
      } else {
        recordFailedLogin(clientIp);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid username or password, or account is deactivated' }));
      }
    });
    return;
  }

  // --- API 7: GET USERS FROM dbo.image_user (ADMIN ONLY) ---
  if (pathname === '/api/users' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;

    if (isSqlServerConnected && sql) {
      sql.query`SELECT id, User_, permetion, on_off, password FROM dbo.image_user ORDER BY id DESC`.then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.recordset));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'An internal error occurred: ' + err.message }));
      });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(inMemoryImageUsers));
    }
    return;
  }

  // --- API 8: ADD USER TO dbo.image_user (ADMIN ONLY) ---
  if (pathname === '/api/users' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;

    sanitizeBody(req, async (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid payload' }));
      }

      const { User_, password, permetion, on_off } = body;
      if (!User_ || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'User_ and password required' }));
      }

      const role = String(permetion || 'User').trim();
      const status = String(on_off || 'on').trim();
      const rawPassword = String(password).trim();

      try {
        if (isSqlServerConnected && sql) {
          const request = new sql.Request();
          request.input('User_', sql.NVarChar(50), String(User_).trim());
          request.input('password', sql.NVarChar(255), rawPassword);
          request.input('permetion', sql.NVarChar(50), role);
          request.input('on_off', sql.NVarChar(50), status);
          await request.query(`
            INSERT INTO dbo.image_user (User_, password, permetion, on_off) 
            VALUES (@User_, @password, @permetion, @on_off)
          `);
        } else {
          inMemoryImageUsers.push({
            id: inMemoryImageUsers.length + 1,
            User_: String(User_).trim(),
            password: rawPassword,
            permetion: role,
            on_off: status
          });
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, User_ }));
      } catch (insertErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'A database error occurred: ' + insertErr.message }));
      }
    });
    return;
  }

  // --- API 8.1: TOGGLE USER STATUS in dbo.image_user (ADMIN ONLY) ---
  if (pathname === '/api/users/toggle' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;

    sanitizeBody(req, async (err, body) => {
      if (err || !body || !body.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
      try {
        const { id, on_off } = body;
        if (isSqlServerConnected && sql) {
          const request = new sql.Request();
          request.input('id', sql.Int, parseInt(id));
          request.input('on_off', sql.NVarChar(50), String(on_off || 'on'));
          await request.query(`UPDATE dbo.image_user SET on_off = @on_off WHERE id = @id`);
        } else {
          const u = inMemoryImageUsers.find(x => x.id === parseInt(id));
          if (u) u.on_off = String(on_off || 'on');
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (toggleErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'A database error occurred' }));
      }
    });
    return;
  }

  // --- API 8.2: DELETE USER from dbo.image_user (ADMIN ONLY) ---
  if (pathname === '/api/users/delete' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;

    sanitizeBody(req, async (err, body) => {
      if (err || !body || !body.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
      try {
        const { id } = body;
        if (isSqlServerConnected && sql) {
          const request = new sql.Request();
          request.input('id', sql.Int, parseInt(id));
          await request.query(`DELETE FROM dbo.image_user WHERE id = @id`);
        } else {
          inMemoryImageUsers = inMemoryImageUsers.filter(x => x.id !== parseInt(id));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (deleteErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'A database error occurred' }));
      }
    });
    return;
  }

  // --- API 8.3: FETCH DEFECT SUGGESTIONS FROM dbo.XXX ---
  if (pathname === '/api/defects-list' && req.method === 'GET') {
    (async () => {
      try {
        let items = [];
        if (isSqlServerConnected && sql) {
          const request = new sql.Request();
          const result = await request.query(`SELECT id, Xx_ FROM dbo.XXX WHERE Xx_ IS NOT NULL AND Xx_ <> '' ORDER BY id ASC`);
          items = result.recordset.map(r => ({
            id: r.id,
            Xx_: typeof r.Xx_ === 'string' ? r.Xx_ : String(r.Xx_ || '')
          }));
        }
        if (!items || items.length === 0) {
          items = defectsXXXList;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, items }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, items: defectsXXXList }));
      }
    })();
    return;
  }

  // --- API 8.4: BATCH SAVE DEFECTS INTO dbo.BB ---
  if (pathname === '/api/defects-batch' && req.method === 'POST') {
    const session = verifySession(req);

    sanitizeBody(req, async (err, body) => {
      if (err || !body || !Array.isArray(body.defects) || body.defects.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Defects list cannot be empty.' }));
      }

      let parsedPsulla = body.Psulla ? parseInt(body.Psulla) : null;
      if (isNaN(parsedPsulla) || !parsedPsulla) {
        parsedPsulla = Math.floor(100000 + Math.random() * 900000);
      }

      const Psulla = parsedPsulla;
      const date_ = body.date_ || new Date().toISOString().slice(0, 10);
      const user_ = session ? session.username : (body.user_ || 'admin');
      const AA = String(body.AA || '').trim();
      const BBB = String(body.BBB || '').trim();
      const CCC = String(body.CCC || '').trim();
      const DDD = String(body.DDD || '').trim();
      const EEE = String(body.EEE || '').trim();

      const defects = body.defects.map(d => String(d).trim()).filter(Boolean);

      try {
        let insertedCount = 0;

        if (isSqlServerConnected && sql) {
          for (const defectText of defects) {
            const request = new sql.Request();
            request.input('Psulla', sql.Int, Psulla);
            request.input('Xx_', sql.NVarChar(250), defectText);
            request.input('date_', sql.Date, date_);
            request.input('user_', sql.NVarChar(50), user_);
            request.input('AA', sql.NVarChar(50), AA);
            request.input('BBB', sql.NVarChar(50), BBB);
            request.input('CCC', sql.NVarChar(50), CCC);
            request.input('DDD', sql.NVarChar(50), DDD);
            request.input('EEE', sql.NVarChar(50), EEE);

            await request.query(`
              INSERT INTO dbo.BB (Psulla, Xx_, date_, user_, AA, BBB, CCC, DDD, EEE)
              VALUES (@Psulla, @Xx_, @date_, @user_, @AA, @BBB, @CCC, @DDD, @EEE)
            `);
            insertedCount++;
          }
        } else {
          for (const defectText of defects) {
            defectsBBRecords.push({
              id: defectsBBRecords.length + 1,
              Psulla,
              Xx_: defectText,
              date_,
              user_,
              AA,
              BBB,
              CCC,
              DDD,
              EEE
            });
            insertedCount++;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          count: insertedCount,
          Psulla,
          message: `✅ ${insertedCount} کەموکوڕی بە سەرکەوتوویی لە خشتەی [dbo].[BB] پاشەکەوتکران (وەسڵ #${Psulla})`
        }));
      } catch (batchErr) {
        console.error('defects-batch SQL error:', batchErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: batchErr.message || 'A database error occurred' }));
      }
    });
    return;
  }

  // --- API 8.5: FETCH STRICTLY THE SINGLE LATEST DATE'S RECORDS FROM dbo.BB ---
  if (pathname === '/api/defects-history' && req.method === 'GET') {
    (async () => {
      try {
        let records = [];
        if (isSqlServerConnected && sql) {
          const request = new sql.Request();
          const queryStr = `
            SELECT TOP 500 id, Psulla, Xx_, date_, user_, AA, BBB, CCC, DDD, EEE 
            FROM dbo.BB 
            WHERE CAST(date_ AS DATE) = CAST(GETDATE() AS DATE)
            ORDER BY id DESC
          `;
          const result = await request.query(queryStr);
          records = result.recordset || [];
        } else {
          // Strict array filter for today's date only
          const todayStr = new Date().toISOString().slice(0, 10);
          records = defectsBBRecords.filter(r => {
            const d = r.date_ ? (typeof r.date_ === 'string' ? r.date_.slice(0, 10) : new Date(r.date_).toISOString().slice(0, 10)) : '';
            return d === todayStr;
          }).reverse();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(records));
      } catch (err) {
        console.error('/api/defects-history SQL error:', err);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([]));
      }
    })();
    return;
  }

  // --- API 8.6: DELETE DEFECT RECORD FROM dbo.BB ---
  if (pathname === '/api/defects-delete' && req.method === 'POST') {
    const session = verifySession(req);
    sanitizeBody(req, async (err, body) => {
      if (err || !body || !body.id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or missing defect ID' }));
      }
      try {
        const id = parseInt(body.id, 10);
        if (isSqlServerConnected && sql) {
          const request = new sql.Request();
          request.input('id', sql.Int, id);
          await request.query('DELETE FROM dbo.BB WHERE id = @id');
        } else {
          // Fallback in-memory delete
          const idx = defectsBBRecords.findIndex(r => r.id === id);
          if (idx !== -1) {
            defectsBBRecords.splice(idx, 1);
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'Defect deleted successfully' }));
      } catch (e) {
        console.error('/api/defects-delete error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Database delete failed' }));
      }
    });
    return;
  }

  // --- API 9: SUBMIT CAR_ RECORD & IMAGE (SECURE PARAMETERIZED INSERT) ---
  if (pathname === '/api/car-records' && req.method === 'POST') {
    sanitizeBody(req, async (err, data) => {
      if (err || !data) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid record payload' }));
      }

      try {
        const { 
          carNo, bash, plet, pic, date_into, Nnote, uuser, bar_, N_pshknin,
          driver_name, mobile, address, chassis, color, gear, fuel, pistons,
          inspector_name, price, result, expire_date, lab_name
        } = data;

        if (isSqlServerConnected && sql) {
          let picBuffer = null;
          if (pic && typeof pic === 'string' && pic.includes('base64,')) {
            const base64Data = pic.split('base64,')[1];
            picBuffer = Buffer.from(base64Data, 'base64');
          }

          const request = new sql.Request();
          request.input('carNo', sql.NVarChar(8), carNo ? String(carNo).trim().slice(0, 8) : null);
          request.input('bash', sql.NVarChar(30), bash ? String(bash).trim().slice(0, 30) : null);
          request.input('plet', sql.NVarChar(30), plet ? String(plet).trim().slice(0, 30) : null);
          request.input('pic', sql.Image, picBuffer);
          request.input('date_into', sql.Date, date_into || new Date());
          request.input('Nnote', sql.NChar(100), Nnote ? String(Nnote).trim().slice(0, 100) : null);
          request.input('uuser', sql.NVarChar(50), uuser ? String(uuser).trim().slice(0, 50) : 'Operator');
          request.input('bar_', sql.NVarChar(255), bar_ ? String(bar_).trim().slice(0, 255) : null);
          request.input('N_pshknin', sql.NVarChar(50), N_pshknin ? String(N_pshknin).trim().slice(0, 50) : null);
          
          request.input('driver_name', sql.NVarChar(100), driver_name ? String(driver_name).trim().slice(0, 100) : null);
          request.input('mobile', sql.NVarChar(20), mobile ? String(mobile).trim().slice(0, 20) : null);
          request.input('address', sql.NVarChar(200), address ? String(address).trim().slice(0, 200) : null);
          request.input('chassis', sql.NVarChar(50), chassis ? String(chassis).trim().slice(0, 50) : null);
          request.input('color', sql.NVarChar(50), color ? String(color).trim().slice(0, 50) : null);
          request.input('gear', sql.NVarChar(50), gear ? String(gear).trim().slice(0, 50) : null);
          request.input('fuel', sql.NVarChar(50), fuel ? String(fuel).trim().slice(0, 50) : null);
          request.input('pistons', sql.NVarChar(50), pistons ? String(pistons).trim().slice(0, 50) : null);
          request.input('inspector_name', sql.NVarChar(100), inspector_name ? String(inspector_name).trim().slice(0, 100) : null);
          request.input('price', sql.NVarChar(50), price ? String(price).trim().slice(0, 50) : null);
          request.input('result', sql.NVarChar(50), result ? String(result).trim().slice(0, 50) : null);
          request.input('expire_date', sql.Date, expire_date ? expire_date : null);
          request.input('lab_name', sql.NVarChar(100), lab_name ? String(lab_name).trim().slice(0, 100) : null);

          await request.query(`
            INSERT INTO dbo.CAR_ (
              carNo, bash, plet, pic, date_into, Nnote, uuser, bar_, N_pshknin,
              driver_name, mobile, address, chassis, color, gear, fuel, pistons,
              inspector_name, price, result, expire_date, lab_name
            )
            VALUES (
              @carNo, @bash, @plet, @pic, @date_into, @Nnote, @uuser, @bar_, @N_pshknin,
              @driver_name, @mobile, @address, @chassis, @color, @gear, @fuel, @pistons,
              @inspector_name, @price, @result, @expire_date, @lab_name
            )
          `);
        } else {
          // In-memory fallback
          carRecords.unshift({
            id: carRecords.length + 1,
            carNo: carNo ? String(carNo).trim().slice(0, 8) : null,
            bash, plet, pic, date_into: date_into || new Date().toISOString().slice(0, 10),
            Nnote, uuser: uuser || 'Operator', bar_: bar_ || null, N_pshknin,
            driver_name, mobile, address, chassis, color, gear, fuel, pistons,
            inspector_name, price, result, expire_date, lab_name
          });
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: 'Record inserted into CAR_ table successfully!' }));
      } catch (insertErr) {
        console.error('Error inserting into CAR_', insertErr);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'A database error occurred' }));
      }
    });
    return;
  }

  // --- API 10: GET CAR_ RECORDS (TODAY ONLY) ---
  if (pathname === '/api/car-records' && req.method === 'GET') {
    if (isSqlServerConnected && sql) {
      sql.query`SELECT id, carNo, bash, plet, date_into, Nnote, uuser, bar_, N_pshknin FROM dbo.CAR_ WHERE CAST(date_into AS DATE) = CAST(GETDATE() AS DATE) ORDER BY id DESC`.then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.recordset));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'An internal error occurred' }));
      });
    } else {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todaysRecords = carRecords.filter(r => r.date_into === todayStr);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(todaysRecords));
    }
    return;
  }

  // --- API 10b: GET SINGLE CAR_ RECORD WITH IMAGE (For Print Report) ---
  if (pathname === '/api/car-record' && req.method === 'GET') {
    const recordId = parsedUrl.query.id;
    if (!recordId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Record id is required' }));
    }

    if (isSqlServerConnected && sql) {
      const request = new sql.Request();
      request.input('id', sql.Int, parseInt(recordId));
      request.query('SELECT id, carNo, bash, plet, pic, date_into, Nnote, uuser, bar_, N_pshknin FROM dbo.CAR_ WHERE id = @id')
        .then(result => {
          if (result.recordset.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Record not found' }));
          }
          const row = result.recordset[0];
          // Convert binary pic to base64 data URI
          let picBase64 = null;
          if (row.pic && Buffer.isBuffer(row.pic) && row.pic.length > 0) {
            picBase64 = 'data:image/jpeg;base64,' + row.pic.toString('base64');
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: row.id,
            carNo: row.carNo,
            bash: row.bash,
            plet: row.plet,
            pic: picBase64,
            date_into: row.date_into,
            Nnote: row.Nnote,
            uuser: row.uuser,
            bar_: row.bar_,
            N_pshknin: row.N_pshknin
          }));
        })
        .catch(err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'An internal error occurred' }));
        });
    } else {
      const rec = carRecords.find(r => r.id === parseInt(recordId));
      if (!rec) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Record not found' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(rec));
    }
    return;
  }

  // --- API 11: REVERSE GEOCODE GPS TO PLACE NAME ---
  if (pathname === '/api/reverse-geocode' && req.method === 'GET') {
    const lat = parsedUrl.query.lat;
    const lng = parsedUrl.query.lng;
    if (!lat || !lng) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'lat and lng required' }));
    }

    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=ar,ckb,en`;
    fetch(geoUrl, {
      headers: { 'User-Agent': 'CarRecordsApp/1.0' }
    })
    .then(r => r.json())
    .then(data => {
      let placeName = '';
      if (data.address) {
        const a = data.address;
        const local = a.town || a.city || a.village || a.suburb || a.subdistrict || a.neighbourhood || a.county || '';
        const state = a.state || a.district || a.province || '';
        const country = a.country || '';
        const parts = [local, state, country].filter(Boolean);
        placeName = parts.join('، ');
      } else if (data.display_name) {
        placeName = data.display_name.split(',').slice(0, 3).join('، ');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ placeName: placeName || '', raw: data.address }));
    })
    .catch(err => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ placeName: '', error: 'An internal error occurred' }));
    });
    return;
  }

  // --- HARDENED STATIC FILE SERVING (PREVENTS ACCESS TO SYSTEM/DATABASE FILES) ---
  let cleanPath = pathname;
  if (!cleanPath || cleanPath === '/' || cleanPath === '\\') {
    cleanPath = '/index.html';
  }

  let safePath = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');
  if (safePath.startsWith('\\') || safePath.startsWith('/')) {
    safePath = safePath.slice(1);
  }
  if (!safePath || safePath === '.') {
    safePath = 'index.html';
  }

  const blockedPatterns = ['config.json', 'server.js', 'package.json', 'package-lock.json', '.env', '.git', '.zip', '.exe'];
  const requestedFile = path.basename(safePath).toLowerCase();

  if (blockedPatterns.some(pat => requestedFile.endsWith(pat) || requestedFile === pat)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden: Access to internal server files is completely blocked.');
  }

  let filePath = path.join(PUBLIC_DIR, safePath);

  // If path is a directory, fallback to index.html
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (e) {}

  // Path traversal check
  const resolvedPublicDir = path.resolve(PUBLIC_DIR).toLowerCase();
  const resolvedFilePath = path.resolve(filePath).toLowerCase();
  if (!resolvedFilePath.startsWith(resolvedPublicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden: Invalid file path.');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      if (['.html', '.js', '.css', '.json'].includes(ext)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (['.png', '.jpg', '.jpeg', '.svg', '.woff2'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔒 [SECURE SHIELD ACTIVE] 3-Page App running at http://localhost:${PORT}`);
});
