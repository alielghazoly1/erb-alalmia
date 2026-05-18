// ─── utils/logger.js ─────────────────────────────────────────────────────────
//  Winston Logger — بيكتب اللوج في ملفات وفي الـ console
//  في Electron: الملفات بتتحط في userData/logs (electron.js بيحدد الـ path)
//  في dev:       logs/ بجانب المشروع
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const path    = require('path');
const fs      = require('fs');
const winston = require('winston');

// ── حدد مكان ملفات اللوج ────────────────────────────────────────────────────
// في Electron main process بيمرر ELECTRON_LOG_PATH عبر الـ env
const LOG_DIR = process.env.ELECTRON_LOG_PATH
  || path.join(__dirname, '..', 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ── Format ───────────────────────────────────────────────────────────────────
const fmt = winston.format;

const fileFormat = fmt.combine(
  fmt.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  fmt.errors({ stack: true }),
  fmt.printf(({ timestamp, level, message, stack }) =>
    stack
      ? `[${timestamp}] [${level.toUpperCase()}] ${message}\n${stack}`
      : `[${timestamp}] [${level.toUpperCase()}] ${message}`
  )
);

const consoleFormat = fmt.combine(
  fmt.colorize(),
  fmt.timestamp({ format: 'HH:mm:ss' }),
  fmt.printf(({ timestamp, level, message }) =>
    `[${timestamp}] ${level}: ${message}`
  )
);

// ── Logger ───────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    // كل اللوج
    new winston.transports.File({
      filename:  path.join(LOG_DIR, 'app.log'),
      maxsize:   5 * 1024 * 1024,   // 5 MB
      maxFiles:  3,
      tailable:  true,
      format:    fileFormat,
    }),
    // الأخطاء فقط
    new winston.transports.File({
      filename:  path.join(LOG_DIR, 'error.log'),
      level:     'error',
      maxsize:   2 * 1024 * 1024,   // 2 MB
      maxFiles:  2,
      tailable:  true,
      format:    fileFormat,
    }),
    // الـ console
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

logger.info(`Logger initialized. Log dir: ${LOG_DIR}`);

module.exports = logger;