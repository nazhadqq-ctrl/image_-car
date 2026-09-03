/**
 * ðŸš— CAR MANAGEMENT SYSTEM - STANDALONE CONFIGURATION FILE
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * This file contains all primary configuration settings.
 * You can edit this file to configure the backend server IP and port,
 * default SQL database parameters, and Master Admin Passwords.
 * 
 * Ø¦Û•Ù… ÙØ§ÛŒÙ„Ù‡ ØªØ§ÛŒØ¨Û•ØªÛ• Ø¨Û• Ú•ÛŽÚ©Ø®Ø³ØªÙ†ÛŒ Ø³Û•Ø±Û•Ú©ÛŒ Ø³ÛŒØ³ØªÙ…: Ù†Ø§ÙˆÙ†ÛŒØ´Ø§Ù†ÛŒ Ø³ÛŽØ±Ú¤Û•Ø± Ùˆ Ø¯Ø§ØªØ§Ø¨Û•ÛŒØ³ Ùˆ ÙˆØ´Û•ÛŒ Ù†Ù‡ÛŽÙ†ÛŒ
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

window.APP_CONFIG = {
  // Default Backend Server URL (Node.js API Server on port 3002)
  // Ø¦Ø§ÛŒâ€ŒÙ¾ÛŒ Ùˆ Ù¾Û†Ú•ØªÛŒ Ø³ÛŽØ±Ú¤Û•Ø±ÛŒ Ù¾Ø±Û†Ú¯Ø±Ø§Ù…Û•Ú©Û• (Ø¨Û† Ø¨Û•Ø³ØªÙ†Û•ÙˆÛ•ÛŒ Ø¦Û•Ù†Ø¯Ø±Û†ÛŒØ¯ Ùˆ ØªØ§Ø¨Ù„ÛŽØª)
  serverUrl: "http://62.201.232.190:3002",

  // Default SQL Server Database parameters
  // Ø²Ø§Ù†ÛŒØ§Ø±ÛŒÛŒÛ• Ø³Û•Ø±Û•Ú©ÛŒÛŒÛ•Ú©Ø§Ù†ÛŒ Ø¨Ù†Ú©Û•ÛŒ Ø¯Ø±Ø§ÙˆÛ•ÛŒ Ø¦ÛŽØ³ Ú©ÛŒÙˆ Ø¦ÛŽÚµ
  sqlServer: {
    server: "62.201.232.190",
    database: "Taqega",
    user: "sa",
    password: "Nazhad@5759",
    port: 1433
  },

  // Master Admin Passwords (works 100% offline & online)
  // ÙˆØ´Û•Ú©Ø§Ù†ÛŒ Ù†Ù‡ÛŽÙ†ÛŒ Ø¦Û•Ø¯Ù…ÛŒÙ† Ú©Û• Ø¨Û• Ø¨ÛŽ Ø³ÛŽØ±Ú¤Û•Ø± Ùˆ Ø¨Û• Ø¦Û†ÙÙ„Ø§ÛŒÙ† Ú©Ø§Ø± Ø¯Û•Ú©Û•Ù†
  adminMasterPasswords: [
    "Na2652014Va",
    "ChangeMeInDotEnv123",
    "admin",
    "123456"
  ],

  // App Metadata
  appName: "ØªÛ†Ù…Ø§Ø±Ú©Ø±Ø¯Ù†ÛŒ Ø²Ø§Ù†ÛŒØ§Ø±ÛŒ Ø¦Û†ØªÛ†Ù…Ø¨ÛŽÙ„",
  appVersion: "1.3.3"
};

