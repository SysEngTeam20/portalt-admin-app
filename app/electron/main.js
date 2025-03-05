"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const electron_serve_1 = __importDefault(require("electron-serve"));
const isProd = process.env.NODE_ENV === 'production';
const loadURL = isProd
    ? (0, electron_serve_1.default)({ directory: '.next' })
    : null;
async function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    if (isProd) {
        // Use a trailing slash to ensure proper path resolution
        await loadURL(win);
        // Handle internal navigation manually to prevent 404s
        win.webContents.on('will-navigate', (event, url) => {
            const parsedUrl = new URL(url);
            if (parsedUrl.pathname === '/') {
                event.preventDefault();
                win.loadURL(url);
            }
        });
    }
    else {
        // In dev mode, ensure we're loading the root URL correctly
        await win.loadURL('http://localhost:3000/');
        win.webContents.openDevTools();
    }
}
electron_1.app.whenReady().then(createWindow);
// IPC handlers
electron_1.ipcMain.on('toMain', (event, args) => {
    console.log('Received in main process:', args);
    // Reply back
    event.sender.send('fromMain', 'Message received in main process!');
});
//# sourceMappingURL=main.js.map