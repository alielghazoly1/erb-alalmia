// ══════════════════════════════════════════════════════════════════
//  config/db.js — Prisma Client Singleton
//  بدل mongoose.connect() بقت prisma client واحدة للمشروع كله
// ══════════════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');

// ✅ PERF-DB-001: Connection Pool Tuning لـ Neon Serverless
// Neon بتفصل الـ connection بعد idle — عشان كده بنعمل keepalive وnconnection صح
//
// لو DATABASE_URL بيشتغل: استخدم ?pgbouncer=true في الـ connection string
// مثال: postgresql://...@ep-xxx.neon.tech/neondb?pgbouncer=true&connection_limit=1
//
// للـ Node.js server العادي (مش serverless):
//   connection_limit = 10 (مناسب لـ Express)
//   pool_timeout = 30 ثانية قبل إلغاء الـ connection اللي في الانتظار

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']   // ✅ أزلنا 'query' من production-like — بيبطّئ الأداء جداً
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ✅ PERF-DB-002: Keep-alive للـ connection — يمنع Neon idle timeout
// كل 4 دقايق بنعمل SELECT 1 عشان الـ connection ميتفصلش
const KEEPALIVE_MS = 4 * 60 * 1000;
if (process.env.NODE_ENV !== 'test') {
  const keepAlive = setInterval(async () => {
    try { await prisma.$queryRaw`SELECT 1`; }
    catch { /* silent — reconnect automatically */ }
  }, KEEPALIVE_MS);
  // عشان الـ process يقدر يتقفل بشكل نظيف
  if (keepAlive.unref) keepAlive.unref();
}

module.exports = prisma;
