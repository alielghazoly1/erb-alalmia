// ─── scripts/verify-backend.js ───────────────────────────────────────────────
// شغّله قبل npm run dist عشان تتأكد إن الباك موجود وصح
// في front/: node scripts/verify-backend.js
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
const fs   = require('fs');

const backendDir = path.resolve(__dirname, '..', '..', 'back');
console.log('\n🔍 Checking backend folder...');
console.log('Expected path:', backendDir);

if (!fs.existsSync(backendDir)) {
  console.error('❌ FAIL: مجلد new-back غير موجود في:', backendDir);
  console.error('   تأكد إن new-back موجود بجانب front/ بالضبط');
  process.exit(1);
}

const required = ['server.js', 'package.json', 'config/db.js', 'middleware/errorMiddleware.js'];
let allOk = true;
for (const f of required) {
  const full = path.join(backendDir, f);
  if (fs.existsSync(full)) {
    console.log(`✅ ${f}`);
  } else {
    console.error(`❌ ${f} — غير موجود`);
    allOk = false;
  }
}

const nodeModules = path.join(backendDir, 'node_modules');
if (fs.existsSync(nodeModules)) {
  console.log('✅ node_modules موجود');
} else {
  console.error('❌ node_modules غير موجود — شغّل npm install في new-back/');
  allOk = false;
}

const prismaClient = path.join(backendDir, 'node_modules', '.prisma', 'client');
if (fs.existsSync(prismaClient)) {
  const engines = fs.readdirSync(prismaClient).filter(f => f.includes('query_engine'));
  if (engines.length > 0) {
    console.log('✅ Prisma engines:', engines.join(', '));
  } else {
    console.error('❌ Prisma engine binary غير موجود — شغّل npx prisma generate في new-back/');
    allOk = false;
  }
} else {
  console.error('❌ Prisma client غير موجود — شغّل npx prisma generate في new-back/');
  allOk = false;
}

if (allOk) {
  console.log('\n✅ كل حاجة تمام — تقدر تشغّل npm run dist\n');
} else {
  console.error('\n❌ في مشاكل — صلّح الأخطاء الحمرا الأول\n');
  process.exit(1);
}