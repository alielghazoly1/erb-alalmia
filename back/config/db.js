// ══════════════════════════════════════════════════════════════════
//  config/db.js — Prisma Client Singleton
//  بدل mongoose.connect() بقت prisma client واحدة للمشروع كله
// ══════════════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');

// Singleton pattern — عشان منعملش أكتر من connection واحدة
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
