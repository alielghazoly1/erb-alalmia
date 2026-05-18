// src/_stubs/empty.js
// stub فاضي — بيتستخدم كبديل لـ electron-updater و electron-is-dev
// في browser bundle عشان webpack متبنيش packages Node.js في المتصفح
//
// الـ app بيوصل لـ Electron APIs عبر preload.js فقط (window.electronAPI)
// مش عن طريق import مباشر
module.exports = {};