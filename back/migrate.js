// ─── migrate-db1.js ───────────────────────────────────────────────────────────
// يحوّل بيانات MongoDB القديمة (db1/) إلى PostgreSQL عبر Prisma
// ✅ idempotent — آمن للتشغيل أكثر من مرة
// تشغيل: node migrate-db1.js
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const path = require('path');
const fs   = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ── helpers ───────────────────────────────────────────────────────────────────
const oid = (v) => (v && typeof v === 'object' && v.$oid) ? v.$oid : (v || null);
const dt  = (v) => {
  if (!v) return new Date();
  if (v && typeof v === 'object' && v.$date) return new Date(v.$date);
  return new Date(v);
};
const num = (v, def = 0) => { const n = parseFloat(v); return isNaN(n) ? def : n; };
const readDb1 = (filename) => {
  const p = path.join(__dirname, 'db1', filename);
  if (!fs.existsSync(p)) { console.warn(`  ⚠️  ملف غير موجود: ${filename}`); return []; }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
const log = (msg) => console.log(`  ${msg}`);

// ── خريطة OID → Prisma UUID ───────────────────────────────────────────────────
const ID = {
  season:     new Map(),
  user:       new Map(),
  customer:   new Map(),
  supplier:   new Map(),
  item:       new Map(),
  itemByCode: new Map(),
};

// ── 1. SEASONS ────────────────────────────────────────────────────────────────
async function migrateSeasons() {
  const data = readDb1('ceo.seasons.json');
  log(`Seasons: ${data.length} records`);

  for (const s of data) {
    const mongoId = oid(s._id);
    const code    = s.name.replace(/\s+/g, '_').slice(0, 20);

    // upsert بـ code (unique)
    const created = await prisma.season.upsert({
      where:  { code },
      update: {},
      create: {
        name: s.name, code,
        startDate:       dt(s.startDate),
        endDate:         dt(s.endDate),
        isActive:        s.isActive        ?? false,
        isClosed:        s.isClosed        ?? false,
        isManufacturing: s.isManufacturing ?? false,
        notes:           s.notes           || null,
        createdAt:       dt(s.createdAt),
      },
    });
    ID.season.set(mongoId, created.id);
    log(`  ✅ موسم: ${created.name} → ${created.id}`);
  }
}

// ── 2. USERS ──────────────────────────────────────────────────────────────────
async function migrateUsers() {
  const data = readDb1('ceo.users.json');
  log(`Users: ${data.length} records`);
  const scopeMap = { ramses: 'ramses', october: 'october', both: 'both' };

  for (const u of data) {
    const created = await prisma.user.upsert({
      where:  { username: u.username },
      update: {},
      create: {
        name: u.name, username: u.username, password: u.password,
        role:  u.role === 'admin' ? 'admin' : 'user',
        scope: scopeMap[u.warehouse] || 'both',
        isActive: u.isActive ?? true,
        createdAt: dt(u.createdAt),
      },
    });
    ID.user.set(oid(u._id), created.id);

    if (u.permissions?.allowNegativeSale) {
      await prisma.userPermission.upsert({
        where:  { userId_permission: { userId: created.id, permission: 'sale_allow_negative' } },
        update: { granted: true },
        create: { userId: created.id, permission: 'sale_allow_negative', granted: true },
      });
    }
    log(`  ✅ مستخدم: ${created.username}`);
  }
}

// ── 3. CUSTOMERS ──────────────────────────────────────────────────────────────
async function migrateCustomers() {
  const data = readDb1('ceo.customers.json');
  log(`Customers: ${data.length} records`);

  const BATCH = 100;
  for (let i = 0; i < data.length; i += BATCH) {
    for (const c of data.slice(i, i + BATCH)) {
      const created = await prisma.customer.upsert({
        where:  { code: String(c.code) },
        update: {},
        create: {
          code: String(c.code), name: c.name,
          phone: c.phone || null, address: c.address || null,
          type: c.type === 'cash' ? 'cash' : 'credit',
          isActive: c.isActive ?? true, notes: c.notes || null,
          openingBalance: 0, createdAt: dt(c.createdAt),
        },
      });
      ID.customer.set(oid(c._id), created.id);
    }
    log(`  ✅ ${Math.min(i + BATCH, data.length)}/${data.length} عميل`);
  }
}

// ── 4. SUPPLIERS ──────────────────────────────────────────────────────────────
async function migrateSuppliers() {
  const data = readDb1('ceo.suppliers.json');
  log(`Suppliers: ${data.length} records`);

  const BATCH = 100;
  for (let i = 0; i < data.length; i += BATCH) {
    for (const s of data.slice(i, i + BATCH)) {
      const created = await prisma.supplier.upsert({
        where:  { code: String(s.code) },
        update: {},
        create: {
          code: String(s.code), name: s.name,
          phone: s.phone || null, address: s.address || null,
          notes: s.notes || null, isActive: s.isActive ?? true,
          openingBalance: 0, createdAt: dt(s.createdAt),
        },
      });
      ID.supplier.set(oid(s._id), created.id);
    }
    log(`  ✅ ${Math.min(i + BATCH, data.length)}/${data.length} مورد`);
  }
}

// ── 5. ITEMS + ITEMSTOCKS ─────────────────────────────────────────────────────
// @@unique([itemId, warehouse, seasonId]) — لازم seasonId في الـ where
async function migrateItems() {
  const data = readDb1('ceo.items.json');
  log(`Items: ${data.length} records`);

  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  const seasonId     = activeSeason?.id || null;

  for (const it of data) {
    const created = await prisma.item.upsert({
      where:  { code: String(it.code) },
      update: {},
      create: {
        code: String(it.code), name: it.name,
        category: it.category || null, unit: it.unit || 'كرتون',
        defaultWeight:     num(it.defaultWeight),
        lastPurchasePrice: num(it.lastPurchasePrice),
        lastSalePrice:     num(it.lastSalePrice),
        isRawMaterial: it.isRawMaterial ?? false,
        isActive:      it.isActive      ?? true,
        notes:         it.notes         || null,
        createdAt:     dt(it.createdAt),
      },
    });
    ID.item.set(oid(it._id), created.id);
    ID.itemByCode.set(String(it.code), created.id);

    // ItemStock — @@unique([itemId, warehouse, seasonId])
    const stock = it.stock || {};
    for (const wh of ['ramses', 'october']) {
      const s = stock[wh] || { quantity: 0, weight: 0 };

      const existing = await prisma.itemStock.findFirst({
        where: { itemId: created.id, warehouse: wh, seasonId },
      });

      if (existing) {
        await prisma.itemStock.update({
          where: { id: existing.id },
          data:  { quantity: num(s.quantity), weight: num(s.weight) },
        });
      } else {
        await prisma.itemStock.create({
          data: { itemId: created.id, warehouse: wh, quantity: num(s.quantity), weight: num(s.weight), seasonId },
        });
      }
    }
  }
  log(`  ✅ ${data.length} صنف مع مخزونهم`);
}

// ── 6. PRICELISTS + LINKS ─────────────────────────────────────────────────────
// PriceList مفيهاش unique غير id — نبحث بـ priceListName + displayOrder يدوياً
async function migratePriceLists() {
  const data = readDb1('ceo.pricelists.json');
  log(`PriceLists: ${data.length} records`);

  for (const pl of data) {
    const prices = (pl.prices || []).map(p => ({ label: p.label || '', price: num(p.price) }));

    // ابحث بـ priceListName + displayOrder
    const existing = await prisma.priceList.findFirst({
      where: { priceListName: pl.priceListName, displayOrder: num(pl.displayOrder) },
    });

    let created;
    if (existing) {
      created = existing; // موجود — استخدمه
    } else {
      created = await prisma.priceList.create({
        data: {
          priceListName:        pl.priceListName,
          priceListDescription: pl.priceListDescription || '',
          displayOrder:         num(pl.displayOrder),
          displayName:          pl.displayName || '',
          origin:               pl.origin      || '',
          unit:                 pl.unit        || '',
          notes:                pl.notes       || '',
          prices,
          defaultPrice:         num(pl.defaultPrice),
          itemDisplayOrder:     num(pl.itemDisplayOrder),
          isActive:             pl.isActive ?? true,
          createdAt:            dt(pl.createdAt),
        },
      });
    }

    // إعادة بناء الـ links دايماً (احذف وأعد)
    await prisma.priceListItemLink.deleteMany({ where: { priceListId: created.id } });

    for (const li of (pl.linkedItems || [])) {
      const itemPrismaId = ID.item.get(oid(li.item)) || ID.itemByCode.get(li.itemCode);
      if (!itemPrismaId) {
        console.warn(`    ⚠️  صنف غير موجود: ${li.itemCode} في قائمة ${pl.priceListName}`);
        continue;
      }
      await prisma.priceListItemLink.create({
        data: { priceListId: created.id, itemId: itemPrismaId, itemCode: li.itemCode || '', itemName: li.itemName || '' },
      });
    }
  }
  log(`  ✅ ${data.length} قائمة أسعار`);
}

// ── 7. CUSTOMER SEASON BALANCES ───────────────────────────────────────────────
async function migrateCustomerBalances() {
  const sales     = readDb1('ceo.saleinvoices.json');
  const customers = readDb1('ceo.customers.json');
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) { log('  ⚠️  مفيش موسم نشط — تخطي'); return; }

  const balMap = new Map();
  for (const inv of sales) {
    if (!inv.docNumber?.startsWith('INIT')) continue;
    const custOid = oid(inv.customer);
    if (!custOid) continue;
    const item = inv.items?.[0];
    if (item) balMap.set(custOid, num(item.price) * num(item.quantity));
  }
  for (const c of customers) {
    const mongoId = oid(c._id);
    if (!balMap.has(mongoId) && c.initialBalance) balMap.set(mongoId, num(c.initialBalance));
  }

  log(`CustomerSeasonBalances: ${balMap.size} عميل عنده رصيد ابتدائي`);
  let done = 0;
  for (const [mongoId, balance] of balMap) {
    if (!balance) continue;
    const prismaId = ID.customer.get(mongoId);
    if (!prismaId) { console.warn(`    ⚠️  عميل مش في الـ map: ${mongoId}`); continue; }
    await prisma.customerSeasonBalance.upsert({
      where:  { customerId_seasonId: { customerId: prismaId, seasonId: activeSeason.id } },
      update: { openingBalance: balance },
      create: { customerId: prismaId, seasonId: activeSeason.id, openingBalance: balance },
    });
    done++;
  }
  log(`  ✅ ${done} رصيد ابتدائي للعملاء`);
}

// ── 8. SUPPLIER SEASON BALANCES ───────────────────────────────────────────────
async function migrateSupplierBalances() {
  const purchases = readDb1('ceo.purchaseinvoices.json');
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) { log('  ⚠️  مفيش موسم نشط — تخطي'); return; }

  const balMap = new Map();
  for (const inv of purchases) {
    if (!inv.docNumber?.startsWith('INIT')) continue;
    const suppOid = oid(inv.supplier);
    if (!suppOid) continue;
    const item = inv.items?.[0];
    if (item) balMap.set(suppOid, num(item.price) * num(item.quantity));
  }

  log(`SupplierSeasonBalances: ${balMap.size} مورد عنده رصيد ابتدائي`);
  let done = 0;
  for (const [mongoId, balance] of balMap) {
    if (!balance) continue;
    const prismaId = ID.supplier.get(mongoId);
    if (!prismaId) { console.warn(`    ⚠️  مورد مش في الـ map: ${mongoId}`); continue; }
    await prisma.supplierSeasonBalance.upsert({
      where:  { supplierId_seasonId: { supplierId: prismaId, seasonId: activeSeason.id } },
      update: { openingBalance: balance },
      create: { supplierId: prismaId, seasonId: activeSeason.id, openingBalance: balance },
    });
    done++;
  }
  log(`  ✅ ${done} رصيد ابتدائي للموردين`);
}

// ── 9. PURCHASE INVOICES ──────────────────────────────────────────────────────
async function migratePurchaseInvoices() {
  const data = readDb1('ceo.purchaseinvoices.json');
  const real = data.filter(inv => !inv.docNumber?.startsWith('INIT'));
  log(`PurchaseInvoices: ${real.length} فاتورة حقيقية (تم تخطي ${data.length - real.length} INIT)`);

  const activeSeason  = await prisma.season.findFirst({ where: { isActive: true } });
  const defaultUserId = [...ID.user.values()][0];

  for (const inv of real) {
    const exists = await prisma.purchaseInvoice.findFirst({ where: { invoiceNumber: inv.invoiceNumber } });
    if (exists) { log(`  ⏭️  موجودة: ${inv.invoiceNumber}`); continue; }

    const suppPrismaId = ID.supplier.get(oid(inv.supplier));
    if (!suppPrismaId) {
      console.warn(`    ⚠️  مورد غير موجود: ${oid(inv.supplier)} — تخطي ${inv.invoiceNumber}`);
      continue;
    }

    const itemRows = [];
    for (let idx = 0; idx < (inv.items || []).length; idx++) {
      const i = inv.items[idx];
      const itemPrismaId = ID.item.get(oid(i.item)) || ID.itemByCode.get(i.itemCode);
      if (!itemPrismaId) { console.warn(`    ⚠️  صنف مش موجود: كود=${i.itemCode} — تخطي`); continue; }
      const qty = num(i.quantity), wt = num(i.weight), pr = num(i.price);
      const tw  = Math.round(qty * wt * 1000) / 1000;
      itemRows.push({
        itemId: itemPrismaId, itemCode: i.itemCode || '', itemName: i.itemName || '',
        quantity: qty, weight: wt, price: pr, discount: num(i.discount),
        total: Math.round(tw * pr * 100) / 100, sortOrder: idx,
      });
    }

    if (!itemRows.length) { console.warn(`    ⚠️  فاتورة ${inv.invoiceNumber} بدون أصناف — تخطي`); continue; }

    const totalWeight = Math.round(itemRows.reduce((s, i) => s + i.quantity * i.weight, 0) * 1000) / 1000;
    const totalAmount = Math.round(itemRows.reduce((s, i) => s + i.total, 0) * 100) / 100;

    await prisma.purchaseInvoice.create({
      data: {
        invoiceNumber: inv.invoiceNumber, docNumber: String(inv.docNumber),
        date: dt(inv.date), supplierId: suppPrismaId,
        supplierCode: inv.supplierCode || '', supplierName: inv.supplierName || '',
        warehouse: inv.warehouse === 'october' ? 'october' : 'ramses',
        totalAmount, totalWeight,
        discountAmount:  num(inv.discountAmount),
        netAmount:       num(inv.netAmount) || totalAmount,
        paidAmount:      num(inv.paidAmount),
        remainingAmount: Math.round((totalAmount - num(inv.paidAmount)) * 100) / 100,
        status:    inv.status === 'approved' ? 'approved' : 'pending',
        seasonId:  activeSeason?.id || null, notes: inv.notes || null,
        createdById:  ID.user.get(oid(inv.createdBy))  || defaultUserId,
        approvedById: ID.user.get(oid(inv.approvedBy)) || null,
        approvedAt:   inv.approvedAt ? dt(inv.approvedAt) : null,
        createdAt:    dt(inv.createdAt),
        items: { create: itemRows },
      },
    });
    log(`  ✅ فاتورة شراء: ${inv.invoiceNumber}`);
  }
}

// ── 10. SEASON COUNTERS ───────────────────────────────────────────────────────
async function migrateCounters() {
  const data = readDb1('ceo.counters.json');
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) { log('  ⚠️  مفيش موسم نشط — تخطي'); return; }

  log(`SeasonCounters: ${data.length} عداد`);
  for (const c of data) {
    await prisma.seasonCounter.upsert({
      where:  { seasonId_prefix: { seasonId: activeSeason.id, prefix: c.name } },
      update: { value: c.value },
      create: { seasonId: activeSeason.id, prefix: c.name, value: c.value },
    });
    log(`  ✅ عداد ${c.name}: ${c.value}`);
  }
  await prisma.seasonCounter.upsert({
    where:  { seasonId_prefix: { seasonId: activeSeason.id, prefix: 'RET' } },
    update: {},
    create: { seasonId: activeSeason.id, prefix: 'RET', value: 0 },
  });
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════════════');
  console.log('  Migration: MongoDB db1 → PostgreSQL (Prisma)');
  console.log('════════════════════════════════════════════════\n');

  const steps = [
    ['Seasons',                   migrateSeasons],
    ['Users',                     migrateUsers],
    ['Customers',                 migrateCustomers],
    ['Suppliers',                 migrateSuppliers],
    ['Items + Stocks',            migrateItems],
    ['PriceLists',                migratePriceLists],
    ['Customer Opening Balances', migrateCustomerBalances],
    ['Supplier Opening Balances', migrateSupplierBalances],
    ['Purchase Invoices',         migratePurchaseInvoices],
    ['Season Counters',           migrateCounters],
  ];

  for (const [name, fn] of steps) {
    console.log(`\n─── ${name} ${'─'.repeat(Math.max(0, 44 - name.length))}`);
    try { await fn(); }
    catch (err) {
      console.error(`  ❌ خطأ في ${name}:`, err.message);
      if (process.env.STOP_ON_ERROR === '1') throw err;
    }
  }

  const [seasons, users, customers, suppliers, items, priceLists,
         custBal, suppBal, purchInv] = await Promise.all([
    prisma.season.count(), prisma.user.count(), prisma.customer.count(),
    prisma.supplier.count(), prisma.item.count(), prisma.priceList.count(),
    prisma.customerSeasonBalance.count(), prisma.supplierSeasonBalance.count(),
    prisma.purchaseInvoice.count(),
  ]);

  console.log('\n════════════════════════════════════════════════');
  console.log('  ✅ Migration اتكملت!');
  console.log('════════════════════════════════════════════════');
  console.log(`     مواسم:                 ${seasons}`);
  console.log(`     مستخدمين:              ${users}`);
  console.log(`     عملاء:                 ${customers}`);
  console.log(`     موردين:                ${suppliers}`);
  console.log(`     أصناف:                 ${items}`);
  console.log(`     قوائم أسعار:           ${priceLists}`);
  console.log(`     أرصدة افتتاحية عملاء:  ${custBal}`);
  console.log(`     أرصدة افتتاحية موردين: ${suppBal}`);
  console.log(`     فواتير شراء:           ${purchInv}`);
  console.log('');
}

main()
  .catch(err => { console.error('\n❌ Migration فشلت:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());