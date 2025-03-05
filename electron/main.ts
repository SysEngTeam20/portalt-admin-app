import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import serve from 'electron-serve'

const isProd = process.env.NODE_ENV === 'production'
const loadURL = isProd 
  ? serve({ directory: '.next' }) 
  : null

async function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (isProd) {
    // Use a trailing slash to ensure proper path resolution
    await (loadURL as (window: BrowserWindow) => Promise<void>)(win)
    
    // Handle internal navigation manually to prevent 404s
    win.webContents.on('will-navigate', (event, url) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname === '/') {
        event.preventDefault();
        win.loadURL(url);
      }
    });
  } else {
    // In dev mode, ensure we're loading the root URL correctly
    await win.loadURL('http://localhost:3000/');
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow)

// IPC handlers
ipcMain.on('toMain', (event, args) => {
  console.log('Received in main process:', args);
  // Reply back
  event.sender.send('fromMain', 'Message received in main process!');
});
