// public/electron.js — النسخة النهائية
'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path   = require('path');
const http   = require('http');
const { execFile } = require('child_process');
const fs     = require('fs');

// ── Logger ────────────────────────────────────────────────────────────────────
const LOG_DIR  = path.join(app.getPath('userData'), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const ERR_FILE = path.join(LOG_DIR, 'error.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}
function writeLog(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  process.stdout.write(line);
  try {
    ensureLogDir();
    fs.appendFileSync(level === 'ERROR' ? ERR_FILE : LOG_FILE, line);
  } catch {}
}
const log = {
  info:  (m) => writeLog('INFO',  m),
  warn:  (m) => writeLog('WARN',  m),
  error: (m) => writeLog('ERROR', m),
};

// ── Config ────────────────────────────────────────────────────────────────────
const isDev        = !app.isPackaged;
const BACKEND_PORT = 5001;
let mainWindow     = null;
let serverProcess  = null;

log.info('═══════════════════════════════════════════════');
log.info(`CEO Management v${app.getVersion()} starting`);
log.info(`isDev=${isDev}  platform=${process.platform}`);
log.info(`userData=${app.getPath('userData')}`);
log.info(`logs=${LOG_DIR}`);
log.info('═══════════════════════════════════════════════');

// ── انتظار الباك ─────────────────────────────────────────────────────────────
function waitForBackend(retries = 40, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/`, (res) => {
        log.info(`Backend responded — status ${res.statusCode}`);
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
      req.setTimeout(400, () => req.destroy());
    };
    check();
  });
}

// ── تشغيل الباك ──────────────────────────────────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    const backendDir = isDev
      ? path.join(__dirname, '..', '..', 'back')
      : path.join(process.resourcesPath, 'backend');

    const serverPath = path.join(backendDir, 'server.js');
    const envPath    = path.join(backendDir, '.env');

    log.info(`Backend dir: ${backendDir}`);
    log.info(`Server path: ${serverPath}`);

    if (!fs.existsSync(serverPath)) {
      return reject(new Error(`server.js غير موجود في:\n${serverPath}`));
    }

    // اقرأ DATABASE_URL — ابحث في 3 أماكن بالترتيب:
    // 1. userData (يضعه المستخدم/الـ installer هناك)
    // 2. backend folder (resources/backend/.env)
    // 3. process.env مباشرة
    let dbUrl = process.env.DATABASE_URL || '';

    const envLocations = [
      path.join(app.getPath('userData'), '.env'),   // 1. userData
      envPath,                                        // 2. resources/backend/.env
    ];

    if (!dbUrl) {
      for (const loc of envLocations) {
        if (fs.existsSync(loc)) {
          const raw = fs.readFileSync(loc, 'utf8');
          const m   = raw.match(/^DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m);
          if (m && m[1].trim()) {
            dbUrl = m[1].trim();
            log.info(`DATABASE_URL loaded from: ${loc}`);
            break;
          }
        }
      }
    }

    if (!dbUrl) {
      log.error('DATABASE_URL غير موجودة! ضع .env في: ' + app.getPath('userData'));
      // لا نوقف التطبيق — الباك هيوضح الخطأ بنفسه
    } else {
      log.info('DATABASE_URL: found ✅');
    }

    // اعرف مسار node.exe (Electron بيجي معاه Node)
    const nodePath = process.execPath; // هو نفسه Electron لكن بيشغّل JS كـ node

    log.info(`Launching backend with: ${nodePath}`);

    // استخدم execFile بدل fork — بيديك stderr كامل
    serverProcess = require('child_process').spawn(nodePath, [serverPath], {
      env: {
        ...process.env,
        NODE_ENV:     'production',
        PORT:         String(BACKEND_PORT),
        ELECTRON:     'true',
        DATABASE_URL: dbUrl,
        JWT_SECRET:   process.env.JWT_SECRET || 'ceo_electron_secret_2026',
        ELECTRON_RUN_AS_NODE: '1',
      },
      cwd:   backendDir,
      stdio: 'pipe',
    });

    // اكتب كل output في اللوج
    serverProcess.stdout.on('data', (d) => {
      d.toString().split('\n').forEach(l => { if (l.trim()) log.info(`[backend] ${l.trim()}`); });
    });
    serverProcess.stderr.on('data', (d) => {
      d.toString().split('\n').forEach(l => { if (l.trim()) log.error(`[backend:err] ${l.trim()}`); });
    });

    let crashed = false;
    serverProcess.on('exit', (code, signal) => {
      log.warn(`[backend] exited code=${code} signal=${signal}`);
      if (code !== 0) crashed = true;
    });

    serverProcess.on('error', (err) => {
      log.error(`[backend spawn error] ${err.message}`);
      reject(err);
    });

    // انتظر الباك يصحى
    log.info('Waiting for backend health check...');
    waitForBackend()
      .then(resolve)
      .catch((err) => {
        // لو الباك كرش، انتظر شوية عشان يكتب اللوج كامل
        setTimeout(() => reject(err), 200);
      });
  });
}

// ── النافذة ───────────────────────────────────────────────────────────────────
function createWindow() {
  log.info('Creating main window...');
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
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '..', 'build', 'index.html');
    log.info(`Loading: ${indexPath}`);
    if (!fs.existsSync(indexPath)) {
      log.error(`build/index.html غير موجود: ${indexPath}`);
      dialog.showErrorBox('خطأ', `ملف الواجهة غير موجود:\n${indexPath}`);
      app.quit();
      return;
    }
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log.info('Window shown');
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.on('render-process-gone', (_e, d) => {
    log.error(`Renderer crash: ${JSON.stringify(d)}`);
  });
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-log-path',    () => LOG_DIR);
ipcMain.handle('open-log-folder', () => { ensureLogDir(); shell.openPath(LOG_DIR); });

// ── Main ──────────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  log.info('App ready');

  if (isDev) {
    createWindow();
    return;
  }

  try {
    await startBackend();
    log.info('Backend started successfully ✅');
    createWindow();
  } catch (err) {
    log.error(`Failed to start backend: ${err.message}`);

    // افتح مجلد اللوج تلقائياً عشان المستخدم يشوف الخطأ
    shell.openPath(LOG_DIR);

    const { response } = await dialog.showMessageBox({
      type:    'error',
      title:   'فشل تشغيل التطبيق',
      message: 'لم يتمكن التطبيق من تشغيل الخادم الداخلي',
      detail:  `${err.message}\n\nتم فتح مجلد اللوج تلقائياً.\nافتح ملف error.log لمعرفة السبب الدقيق.`,
      buttons: ['إعادة المحاولة', 'إغلاق'],
    });

    if (response === 0) { app.relaunch(); }
    app.quit();
  }
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (serverProcess) { serverProcess.kill('SIGTERM'); serverProcess = null; }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  log.info('App quitting...');
  if (serverProcess) { serverProcess.kill('SIGTERM'); serverProcess = null; }
});

process.on('uncaughtException', (err) => {
  log.error(`Uncaught: ${err.message}\n${err.stack}`);
});