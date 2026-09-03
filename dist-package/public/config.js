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

  // Default SQL Server Database parameters
  // زانیارییە سەرەکییەکانی بنکەی دراوەی ئێس کیو ئێڵ
  sqlServer: {
    server: "62.201.232.190",
    database: "Taqega",
    user: "sa",
    password: "Nazhad@5759",
    port: 1433
  },

  // Master Admin Passwords (works 100% offline & online)
  // وشەکانی نهێنی ئەدمین کە بە بێ سێرڤەر و بە ئۆفلاین کار دەکەن
  adminMasterPasswords: [
    "Na2652014Va",
    "ChangeMeInDotEnv123",
    "admin",
    "123456"
  ],

  // App Metadata
  appName: "تۆمارکردنی زانیاری ئۆتۆمبێل",
  appVersion: "1.3.3"
};
