/* ═══════════════════════════════════════════════════════════════
   🚗 AUTOMATIC GITHUB UPDATER FOR DESKTOP & TABLET CLIENTS
   Silently fetches and applies the latest updates from GitHub
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_OWNER = 'nazhadqq-ctrl';
const REPO_NAME = 'image_-car';
const BRANCH = 'main';
const BASE_RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;

const FILES_TO_UPDATE = [
  'version.json',
  'auto-updater.js',
  'github-sync.js',
  'Start-App-Silent.vbs',
  'Start-Desktop-App-Silent.vbs',
  'Start-App.bat',
  'Start-Desktop-App.bat',
  'public/styles.css',
  'public/index.html',
  'public/app.js',
  'public/config.js',
  'public/lucide.min.js',
  'public/profile-avatar.jpg',
  'public/traffic-it-logo.jpg',
  'public/app-icon.png',
  'public/favicon.ico',
  'server.js',
  'android-system/android/app/src/main/assets/public/styles.css',
  'android-system/android/app/src/main/assets/public/index.html',
  'android-system/android/app/src/main/assets/public/app.js',
  'android-system/android/app/src/main/assets/public/config.js',
  'android-system/android/app/src/main/assets/public/lucide.min.js',
  'android-system/www/styles.css',
  'android-system/www/index.html',
  'android-system/www/app.js',
  'android-system/www/config.js',
  'android-system/www/lucide.min.js'
];

function fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Car-App-AutoUpdater',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timed out`));
    });
  });
}

function getLocalVersion() {
  try {
    const p = path.join(__dirname, 'version.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {}
  return { version: '1.3.4', build: 190 };
}

async function checkForUpdates(force = false) {
  const localVer = getLocalVersion();
  let remoteVer = null;
  let hasUpdate = false;

  // 1. Try fetching remote version.json from GitHub
  try {
    const verData = await fetchUrl(`${BASE_RAW_URL}/version.json?t=${Date.now()}`, 6000);
    remoteVer = JSON.parse(verData.toString('utf8'));
    if (remoteVer.build && remoteVer.build > (localVer.build || 0)) {
      hasUpdate = true;
    }
  } catch (err) {
    if (force) {
      hasUpdate = true;
      remoteVer = { version: localVer.version, build: (localVer.build || 180) + 1 };
    } else {
      return {
        success: true,
        hasUpdate: false,
        currentVersion: localVer.version,
        latestVersion: localVer.version,
        message: 'سیستەمەکەت نوێترین وەشانە.'
      };
    }
  }

  if (force) {
    hasUpdate = true;
    if (!remoteVer) remoteVer = localVer;
  }

  if (!hasUpdate) {
    return {
      success: true,
      hasUpdate: false,
      currentVersion: localVer.version,
      latestVersion: remoteVer ? remoteVer.version : localVer.version,
      message: 'سیستەمەکەت نوێترین وەشانە.'
    };
  }

  // Perform Update
  const updatedFiles = [];
  const errors = [];

  for (const relPath of FILES_TO_UPDATE) {
    try {
      const fileUrl = `${BASE_RAW_URL}/${relPath}?t=${Date.now()}`;
      const content = await fetchUrl(fileUrl, 10000);

      const localPath = path.join(__dirname, relPath);
      // Never overwrite existing local configuration files
      if (relPath.endsWith('config.js') && fs.existsSync(localPath)) {
        continue;
      }
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(localPath, content);
      updatedFiles.push(relPath);
    } catch (err) {
      if (!err.message.includes('HTTP 404')) {
        errors.push(`${relPath}: ${err.message}`);
      }
    }
  }

  if (remoteVer) {
    try {
      fs.writeFileSync(path.join(__dirname, 'version.json'), JSON.stringify(remoteVer, null, 2), 'utf8');
    } catch (e) {}
  }

  return {
    success: errors.length === 0,
    hasUpdate: true,
    previousVersion: localVer.version,
    newVersion: remoteVer ? remoteVer.version : localVer.version,
    updatedFiles,
    errors: errors.length > 0 ? errors : undefined,
    message: `سیستەمەکە بە سەرکەوتوویی نوێکرایەوە بۆ وەشانی (${remoteVer ? remoteVer.version : localVer.version})!`
  };
}

module.exports = { checkForUpdates, getLocalVersion };
