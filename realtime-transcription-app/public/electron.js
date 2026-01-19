const { app, BrowserWindow, desktopCapturer } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#667eea',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation:  false,
      enableRemoteModule: true,
      // ✅ Enable media access
      webSecurity: false, // For development only
    },
    icon:  path.join(__dirname, 'icon.png'),
  });

  // ✅ Set permissions for media devices
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'midi', 'midiSysex', 'pointerLock', 'fullscreen', 'openExternal'];
    
    if (allowedPermissions.includes(permission)) {
      callback(true); // Allow
    } else {
      callback(false); // Deny
    }
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => (mainWindow = null));

  // ✅ Handle display media requests
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      // Grant access to the first screen found
      callback({ video: sources[0], audio: 'loopback' });
    });
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ✅ Enable system audio capture
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');