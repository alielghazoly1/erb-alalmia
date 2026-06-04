// ══════════════════════════════════════════════════════════════════
//  config/db.js — Prisma Client Singleton
// ══════════════════════════════════════════════════════════════════
// ✅ PERF-DB-001: Connection Pool Tuning — connection_limit في .env
// ✅ PERF-DB-002: Keep-alive كل 4 دقايق — يمنع Neon idle timeout
// ✅ PERF-DB-003: Slow query logger — يلوج أي query > 500ms في development
//                يساعد في تحديد الـ queries المشكلة قبل ما تتطور
'use strict';

const { PrismaClient } = require('@prisma/client');

const IS_DEV  = process.env.NODE_ENV !== 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

const globalForPrisma = globalThis;

// ✅ PERF-DB-003: Slow Query Threshold
const SLOW_QUERY_MS = 500;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // في development: لوج الـ errors فقط + slow query middleware تحت
    // في production: errors فقط — 'query' log يبطّئ الأداء جداً
    log: IS_DEV ? ['error', 'warn'] : ['error'],
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });

// ✅ PERF-DB-003: Slow Query Middleware — development فقط
// يطبع أي query أخذت أكثر من SLOW_QUERY_MS مع الـ params
if (IS_DEV) {
  prisma.$use(async (params, next) => {
    const before = Date.now();
    const result = await next(params);
    const after  = Date.now();
    const ms     = after - before;
    if (ms > SLOW_QUERY_MS) {
      console.warn(
        `[SLOW QUERY] ${ms}ms — ${params.model}.${params.action}` +
        (params.args?.where ? ` WHERE ${JSON.stringify(params.args.where)}` : ''),
      );
    }
    return result;
  });
}

if (IS_DEV) globalForPrisma.prisma = prisma;

// ✅ PERF-DB-002: Keep-alive — يمنع Neon idle timeout (يفصل بعد ~5 دقايق)
const KEEPALIVE_MS = 4 * 60 * 1000; // كل 4 دقايق
if (!IS_TEST) {
  const keepAlive = setInterval(async () => {
    try { await prisma.$queryRaw`SELECT 1`; }
    catch { /* silent — Prisma يعيد الاتصال تلقائياً */ }
  }, KEEPALIVE_MS);
  if (keepAlive.unref) keepAlive.unref();
}

module.exports = prisma;