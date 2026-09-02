const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const isLocalWindow = (webContents) => webContents.getURL().startsWith('file://');

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f5f7f9',
    title: 'Frameflow Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

async function readImage(filePath) {
  const stat = await fs.stat(filePath);
  return {
    name: path.basename(filePath),
    type: mimeType(filePath),
    bytes: await fs.readFile(filePath),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString()
  };
}

async function collectImages(dirPath) {
  const output = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) output.push(...await collectImages(fullPath));
    else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) output.push(await readImage(fullPath));
  }
  return output;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(isLocalWindow(webContents) && permission === 'media');
  });

  ipcMain.handle('images:open', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import photos into Frameflow',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }]
    });
    if (result.canceled) return [];
    return Promise.all(result.filePaths.map(readImage));
  });

  ipcMain.handle('images:open-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import a photo folder or mounted memory card',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return [];
    return collectImages(result.filePaths[0]);
  });

  ipcMain.handle('file:save', async (_event, { name, bytes }) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Frameflow export',
      defaultPath: name || 'frameflow-export.zip',
      filters: [{ name: 'Frameflow export', extensions: ['zip', 'html', 'eml', 'jpg', 'png', 'webp'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await fs.writeFile(result.filePath, Buffer.from(bytes));
    return { canceled: false, path: result.filePath };
  });

  ipcMain.handle('window:print', async (event) => new Promise((resolve) => {
    event.sender.print({ silent: false, printBackground: true }, (success, failureReason) => {
      resolve({ success, failureReason: failureReason || null });
    });
  }));

  ipcMain.handle('app:location', () => app.getPath('pictures'));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp'
  })[ext] || 'application/octet-stream';
}
