// ─── public/preload.js ───────────────────────────────────────────────────────
//  Context Bridge — الوحيد اللي يقدر يتكلم مع Main Process بأمان
//  contextIsolation: true  →  من غير preload مفيش تواصل مع Node
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── معلومات التطبيق ────────────────────────────────────────────────────────
  getAppVersion:   () => ipcRenderer.invoke('get-app-version'),
  getLogPath:      () => ipcRenderer.invoke('get-log-path'),
  openLogFolder:   () => ipcRenderer.invoke('open-log-folder'),

  // ── مساعد: هل الـ app شغال داخل Electron؟ ────────────────────────────────
  isElectron: true,
});