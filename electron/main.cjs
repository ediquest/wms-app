const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.VITE_DEV === 'true';
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    // Vite dev server URL
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Load built index.html
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Simple IPC example
ipcMain.handle('ping', () => 'pong from main');

const fs = require('fs');
const os = require('os');

const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;
if (isPortable) {
  const userDir = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'userdata');
  try { fs.mkdirSync(userDir, { recursive: true }); } catch {}
  app.setPath('userData', userDir);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
