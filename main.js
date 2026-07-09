const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'icon.ico') // We'll need a placeholder icon or it defaults
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handler for automatic backups
ipcMain.on('save-backup', (event, backupData) => {
    try {
        const backupDir = path.join(app.getPath('userData'), 'Backups');

        // Ensure backup directory exists
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const date = new Date();
        const timestamp = `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getDate().toString().padStart(2, '0')}__${date.getHours().toString().padStart(2, '0')}_${date.getMinutes().toString().padStart(2, '0')}`;

        // Keep last 10 backups and delete older ones
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort();
        if (files.length >= 10) {
            fs.unlinkSync(path.join(backupDir, files[0])); // Delete the oldest
        }

        const backupPath = path.join(backupDir, `eventmaster_backup_${timestamp}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

        console.log(`Backup saved to ${backupPath}`);
        event.reply('backup-status', { success: true, path: backupPath });
    } catch (err) {
        console.error('Backup failed:', err);
        event.reply('backup-status', { success: false, error: err.message });
    }
});
