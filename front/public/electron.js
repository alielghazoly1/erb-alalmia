const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow = null;
let serverProcess = null;
const BACKEND_PORT = 5001;

// ── انتظر الـ backend يشتغل فعلاً ─────────────────────────────────────────────
function waitForBackend(retries = 40, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/`, (res) => {
        resolve();
      });
      req.on('error', () => {
        attempts++;
        if (attempts >= retries) {
          reject(new Error(`Backend لم يستجب بعد ${retries} محاولة`));
        } else {
          setTimeout(check, delay);
        }
      });
      req.setTimeout(400, () => { req.destroy(); });
    };
    check();
  });
}

// ── شغّل الـ backend ───────────────────────────────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    const backendDir  = path.join(process.resourcesPath, 'backend');
    const serverPath  = path.join(backendDir, 'server.js');

    if (!fs.existsSync(serverPath)) {
      return reject(new Error(`ملف الـ backend غير موجود:\n${serverPath}`));
    }

    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT:     String(BACKEND_PORT),
        ELECTRON: 'true',
      },
      cwd: backendDir,
      silent: false,
    });

    serverProcess.on('error', (err) => reject(err));
    serverProcess.on('exit', (code) => {
      console.log('[backend] exited:', code);
    });

    waitForBackend().then(resolve).catch(reject);
  });
}

// ── أنشئ الـ window ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1400,
    height:          900,
    minWidth:        1024,
    minHeight:       700,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    show:            false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // ✅ الصح: لما يكون ASAR مفعّل، الـ __dirname جوه الـ asar
    // electron-builder بيحط build/ جوه الـ asar بجانب electron.js
    // electron.js موجود في public/ → بعد البناء يبقى في app.asar/public/
    // فالـ build/ يبقى في app.asar/build/
    const indexPath = path.join(__dirname, '..', 'build', 'index.html');
    if (!fs.existsSync(indexPath)) {
      dialog.showErrorBox('خطأ', `ملف الواجهة غير موجود:\n${indexPath}`);
      app.quit();
      return;
    }
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Auto Updater ───────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(mainWindow, {
        type:    'info',
        title:   'تحديث جاهز',
        message: 'تم تنزيل تحديث جديد. هل تريد إعادة التشغيل الآن؟',
        buttons: ['الآن', 'لاحقاً'],
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });
  } catch (e) {
    console.error('[updater]', e.message);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (isDev) {
    createWindow();
    return;
  }

  try {
    await startBackend();
    createWindow();
    setTimeout(setupAutoUpdater, 3000);
  } catch (err) {
    const { response } = await dialog.showMessageBox({
      type:    'error',
      title:   'خطأ في تشغيل التطبيق',
      message: 'فشل تشغيل قاعدة البيانات',
      detail:  err.message,
      buttons: ['إعادة المحاولة', 'إغلاق'],
    });
    if (response === 0) { app.relaunch(); }
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});