// ─── server.js ────────────────────────────────────────────────────────────────
//  يشتغل في:
//    - development:         node server.js  (PORT=5000)
//    - Electron production: fork() من electron.js  (PORT=5001)
//    - Vercel (لو محتاج):   module.exports = app
// ─────────────────────────────────────────────────────────────────────────────
const express      = require('express');
const cors         = require('cors');
const dotenv       = require('dotenv');
const compression  = require('compression');
const cookieParser = require('cookie-parser');
const path         = require('path');
const prisma       = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// ── Load .env ─────────────────────────────────────────────────────────────────
// في Electron production: الـ .env موجودة في resources/backend/
// لو مش موجودة (Vercel مثلاً): dotenv بيتجاهلها وبيعتمد على env vars
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const app = express();

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
// في Electron: الريكويست بتيجي من localhost:3000 (dev) أو file:// (prod)
// بنسمح بكل حاجة لأن الـ app على نفس الجهاز
const isElectron = process.env.ELECTRON === 'true';

app.use(cors({
  origin: isElectron ? true : (process.env.FRONTEND_URL || true),
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Request Logger ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms  = Date.now() - start;
    const clr =
      res.statusCode >= 500 ? '\x1b[31m' :
      res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${clr}[${res.statusCode}]\x1b[0m ${req.method} ${req.originalUrl} — ${ms}ms`);
  });
  next();
});

// ═══════════════════════════════ Routes ═══════════════════════════════════════
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

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', message: 'API شغال ✅' }));

// ── Error handlers ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} — closing Prisma...`);
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, '127.0.0.1', () => {
  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log(`\x1b[32m✅  Server running on port ${PORT}\x1b[0m`);
  console.log(`\x1b[34m📡  http://localhost:${PORT}\x1b[0m`);
  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
});

module.exports = app;
