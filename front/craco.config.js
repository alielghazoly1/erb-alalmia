// craco.config.js
// ─────────────────────────────────────────────────────────────────────────────
//  الحل النهائي لمشكلة webpack 5 + react-scripts 5:
//
//  المشكلة الجذرية:
//    electron-is-dev, electron-updater, jspdf, html2canvas
//    موجودين في "dependencies" فـ webpack بيحاول يبنيهم للمتصفح
//    وهما بيجيبوا معاهم كل node core modules (fs, path, http, constants ...)
//
//  الحل:
//    1. نستبدل الـ packages الخاصة بـ Electron/Node بـ stub فاضي في browser
//    2. نقفل كل node core modules مش محتاجينها في المتصفح
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');

module.exports = {
  webpack: {
    alias: {
      // ── Electron packages: نبدلهم بـ stub فاضي في browser bundle ──────────
      // electron-updater و electron-is-dev بيجيبوا fs/path/constants معاهم
      'electron-updater':  path.resolve(__dirname, 'src/_stubs/empty.js'),
      'electron-is-dev':   path.resolve(__dirname, 'src/_stubs/empty.js'),
      // jspdf و html2canvas: موجودين في package.json بس مش بيتستخدموا
      // نستبدلهم برضو عشان webpack يبطل يشتكي من tree اللي ورا
      'jspdf':             path.resolve(__dirname, 'src/_stubs/empty.js'),
      'html2canvas':       path.resolve(__dirname, 'src/_stubs/empty.js'),
    },
    configure: (webpackConfig) => {
      // ── نقفل كل node core modules ─────────────────────────────────────────
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        fs:            false,
        path:          false,
        http:          false,
        https:         false,
        stream:        false,
        buffer:        false,
        url:           false,
        util:          false,
        assert:        false,
        process:       false,
        zlib:          false,
        constants:     false,
        os:            false,
        crypto:        false,
        net:           false,
        tls:           false,
        child_process: false,
        readline:      false,
        events:        false,
        string_decoder: false,
        querystring:   false,
        punycode:      false,
        domain:        false,
        dns:           false,
        dgram:         false,
        cluster:       false,
        module:        false,
        vm:            false,
      };
      return webpackConfig;
    },
  },
};