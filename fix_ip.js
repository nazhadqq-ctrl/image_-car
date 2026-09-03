const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    const originalContent = content;
    
    content = content.replace(/185\.181\.111\.17/g, "62.201.232.190");
    content = content.replace(/image_coart/g, "Taqega");
    content = content.replace(/"ASA"/g, '"sa"');
    content = content.replace(/'ASA'/g, "'sa'");
    content = content.replace(/Nazhad9999/g, "Nazhad@5759");

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            if (name !== 'node_modules' && name !== '.git' && name !== 'android') {
                walkSync(filePath, callback);
            }
        }
    });
}

const filesToUpdate = [
    'server.js',
    'config.json',
    '.env',
    'public/app.js',
    'public/config.js',
    'android-system/www/app.js',
    'android-system/www/config.js',
    'android-system/android/app/src/main/assets/public/app.js',
    'android-system/android/app/src/main/assets/public/config.js'
];

// Update specific files
filesToUpdate.forEach(file => {
    const fullPath = path.join(__dirname, file);
    replaceInFile(fullPath);
});

// Also search in dist-package specifically
if (fs.existsSync(path.join(__dirname, 'dist-package'))) {
    walkSync(path.join(__dirname, 'dist-package'), function(filePath, stat) {
        if (filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.endsWith('.env')) {
            replaceInFile(filePath);
        }
    });
}

console.log("Done");
