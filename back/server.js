// ─── server.js ────────────────────────────────────────────────────────────────
'use strict';
const express      = require('express');
const cors         = require('cors');
const dotenv       = require('dotenv');
const path         = require('path');

// ── Load .env أول حاجة قبل أي require تاني ───────────────────────────────────
dotenv.config({ path: path.join(__dirname, '.env') });

const compression  = require('compression');
const cookieParser = require('cookie-parser');

// ── Logger: لو winston موجود استخدمه، لو لأ اشتغل بـ console ────────────────
let log;
try {
  log = require('./utils/logger');
} catch {
  const ts  = () => new Date().toISOString();
  log = {
    info:  (...a) => console.log(`[${ts()}] [INFO]`, ...a),
    warn:  (...a) => console.warn(`[${ts()}] [WARN]`, ...a),
    error: (...a) => console.error(`[${ts()}] [ERROR]`, ...a),
    debug: (...a) => console.log(`[${ts()}] [DEBUG]`, ...a),
  };
}

// ── Prisma: لو فشل نوضح السبب ────────────────────────────────────────────────
let prisma;
try {
  prisma = require('./config/db');
} catch (err) {
  log.error('Prisma failed to load:', err.message);
  log.error('Make sure you ran: npx prisma generate');
  process.exit(1);
}

const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const app = express();
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      true,
  credentials: true,
  methods:     ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms  = Date.now() - start;
    const lvl = res.statusCode >= 500 ? 'error'
              : res.statusCode >= 400 ? 'warn' : 'info';
    log[lvl](`[${res.statusCode}] ${req.method} ${req.originalUrl} — ${ms}ms`);
  });
  next();
});

// ═══════════════════════════════ Routes ══════════════════════════════════════
app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/seasons',       require('./routes/seasonRoutes'));
app.use('/api/suppliers',     require('./routes/supplierRoutes'));
app.use('/api/items',         require('./routes/itemRoutes'));
app.use('/api/purchase',      require('./routes/purchaseRoutes'));
app.use('/api/customers',     require('./routes/customerRoutes'));
app.use('/api/sales',         require('./routes/saleRoutes'));
app.use('/api/payments',      require('./routes/paymentRoutes'));
app.use('/api/cash-register', require('./routes/Cashregisterroutes'));
app.use('/api/returns',       require('./routes/returnRoutes'));
app.use('/api/transfers',     require('./routes/transferRoutes'));
app.use('/api/manufacturing', require('./routes/manufacturingRoutes'));
app.use('/api/reports',       require('./routes/reportRoutes'));
app.use('/api/price-list',    require('./routes/priceListRoutes'));
app.use('/api/audit',         require('./routes/Auditroutes'));
app.use('/api/workers',       require('./routes/Workerroutes'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', message: 'API شغال' }));

// ── Error handlers ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (sig) => {
  log.info(`${sig} received — shutting down`);
  try { await prisma.$disconnect(); } catch {}
  process.exit(0);
};
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception:', err.message);
  log.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', String(reason));
  process.exit(1);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);

app.listen(PORT, '127.0.0.1', () => {
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log.info(`Server running on port ${PORT}`);
  log.info(`DB: ${process.env.DATABASE_URL ? 'configured ✅' : 'NOT SET ⚠️'}`);
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

module.exports = app;