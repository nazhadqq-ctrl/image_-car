/**
 * 🚗 CAR MANAGEMENT SYSTEM - STANDALONE CONFIGURATION FILE
 * ═══════════════════════════════════════════════════════════════
 * This file contains all primary configuration settings.
 * You can edit this file to configure the backend server IP and port,
 * default SQL database parameters, and Master Admin Passwords.
 * 
 * ئەم فایله تایبەتە بە ڕێکخستنی سەرەکی سیستم: ناونیشانی سێرڤەر و داتابەیس و وشەی نهێنی
 * ═══════════════════════════════════════════════════════════════
 */

window.APP_CONFIG = {
  // Default Backend Server URL (Node.js API Server on port 3002)
  // ئای‌پی و پۆڕتی سێرڤەری پرۆگرامەکە (بۆ بەستنەوەی ئەندرۆید و تابلێت)
  serverUrl: "http://62.201.232.190:3002",

  // Lock server URL: When true, the app strictly uses the serverUrl above and prevents accidental overrides
  // قوفڵکردنی ئای‌پی: ئەگەر ئەمە true بێت، ئای‌پیەکە جێگیر (ثابت) دەبێت و کەس ناتوانێت لە تابلێت یان وێب بیگۆڕێت
  lockServerUrl: true,

  // Default SQL Server Database parameters (Database connection credentials are securely stored on backend server)
  // زانیارییە سەرەکییەکانی بنکەی دراوەی ئێس کیو ئێڵ
  sqlServer: {
    server: "62.201.232.190",
    database: "Taqega",
    user: "sa",
    port: 1433
  },

  // Master Admin Passwords (works offline & online - weak passwords removed)
  // وشەی نهێنی سەرەکی ئەدمین
  adminMasterPasswords: [
    "Na2652014Va"
  ],

  // App Metadata
  appName: "تۆمارکردنی زانیاری ئۆتۆمبێل",
  appVersion: "1.3.5"
};
