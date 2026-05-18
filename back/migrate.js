// ─── migrate-db1.js ───────────────────────────────────────────────────────────
// يحوّل بيانات MongoDB القديمة (db1/) إلى PostgreSQL عبر Prisma
//
// الترتيب الصح (Foreign Key safe):
//   1. Seasons
//   2. Users
//   3. Customers
//   4. Suppliers
//   5. Items + ItemStocks
//   6. PriceLists + PriceListItemLinks
//   7. CustomerSeasonBalances  (من فواتير INIT القديمة)
//   8. SupplierSeasonBalances  (من فواتير INIT القديمة)
//   9. PurchaseInvoices + Items (الفواتير الحقيقية فقط)
//  10. SeasonCounters
//
// تشغيل: node migrate-db1.js
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const path   = require('path');
const fs     = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: [] });

// ── helpers ───────────────────────────────────────────────────────────────────

/** يحوّل ObjectId أو string لـ string عادي */
const oid = (v) => (v && typeof v === 'object' && v.$oid) ? v.$oid : (v || null);

/** يحوّل $date MongoDB لـ JS Date */
const dt = (v) => {
  if (!v) return new Date();
  if (v && typeof v === 'object' && v.$date) return new Date(v.$date);
  return new Date(v);
};

/** يحوّل أي قيمة رقمية لـ float آمن */
const num = (v, def = 0) => {
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
};

/** يقرأ JSON من db1 */
const readDb1 = (filename) => {
  const p = path.join(__dirname, 'db1', filename);
  if (!fs.existsSync(p)) {
    console.warn(`  ⚠️  ملف غير موجود: ${filename}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

/** يطبع progress بشكل واضح */
const log = (msg) => console.log(`  ${msg}`);

// ── الخريطة الرئيسية: MongoDB OID → Prisma UUID ──────────────────────────────
// نبنيها أثناء الـ migration عشان نربط الـ relations صح
const ID = {
  season:   new Map(), // mongo_oid → prisma_uuid
  user:     new Map(),
  customer: new Map(),
  supplier: new Map(),
  item:     new Map(),
};

// ── 1. SEASONS ────────────────────────────────────────────────────────────────
async function migrateSeasons() {
  const data = readDb1('ceo.seasons.json');
  log(`Seasons: ${data.length} records`);

  for (const s of data) {
    const mongoId = oid(s._id);
    const created = await prisma.season.create({
      data: {
        name:            s.name,
        code:            s.name.replace(/\s+/g, '_').slice(0, 20),
        startDate:       dt(s.startDate),
        endDate:         dt(s.endDate),
        isActive:        s.isActive ?? false,
        isClosed:        s.isClosed ?? false,
        isManufacturing: s.isManufacturing ?? false,
        notes:           s.notes || null,
        createdAt:       dt(s.createdAt),
      },
    });
    ID.season.set(mongoId, created.id);
    log(`  ✅ موسم: ${created.name} → ${created.id}`);
  }

  // لو مفيش موسم نشط — ننشئ placeholder
  if (ID.season.size === 0) {
    const s = await prisma.season.create({
      data: {
        name: 'موسم افتراضي', code: 'DEFAULT',
        startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
        isActive: true,
      },
    });
    log(`  ⚠️  تم إنشاء موسم افتراضي: ${s.id}`);
    ID.season.set('DEFAULT', s.id);
  }
}

// ── 2. USERS ──────────────────────────────────────────────────────────────────
async function migrateUsers() {
  const data = readDb1('ceo.users.json');
  log(`Users: ${data.length} records`);

  // mapping من warehouse القديم لـ scope الجديد
  const scopeMap = { ramses: 'ramses', october: 'october', both: 'both' };

  for (const u of data) {
    const mongoId = oid(u._id);
    const scope   = scopeMap[u.warehouse] || 'both';
    const role    = u.role === 'admin' ? 'admin' : 'user';

    const created = await prisma.user.create({
      data: {
        name:      u.name,
        username:  u.username,
        password:  u.password, // bcrypt hash — نحتفظ بيه زي ما هو
        role,
        scope,
        isActive:  u.isActive ?? true,
        createdAt: dt(u.createdAt),
      },
    });
    ID.user.set(mongoId, created.id);

    // permissions القديمة
    if (u.permissions?.allowNegativeSale) {
      await prisma.userPermission.create({
        data: {
          userId:     created.id,
          permission: 'sale_allow_negative',
          granted:    true,
        },
      });
    }

    log(`  ✅ مستخدم: ${created.username} (${role})`);
  }
}

// ── 3. CUSTOMERS ──────────────────────────────────────────────────────────────
async function migrateCustomers() {
  const data = readDb1('ceo.customers.json');
  log(`Customers: ${data.length} records`);

  // batch insert for speed — 100 at a time
  const BATCH = 100;
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    for (const c of batch) {
      const mongoId = oid(c._id);
      const created = await prisma.customer.create({
        data: {
          code:          String(c.code),
          name:          c.name,
          phone:         c.phone  || null,
          address:       c.address || null,
          type:          c.type === 'cash' ? 'cash' : 'credit',
          isActive:      c.isActive ?? true,
          notes:         c.notes  || null,
          openingBalance: 0, // نحطه صفر — الرصيد الابتدائي هيتحط في CustomerSeasonBalance
          createdAt:     dt(c.createdAt),
        },
      });
      ID.customer.set(mongoId, created.id);
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
    const batch = data.slice(i, i + BATCH);
    for (const s of batch) {
      const mongoId = oid(s._id);
      const created = await prisma.supplier.create({
        data: {
          code:          String(s.code),
          name:          s.name,
          phone:         s.phone  || null,
          address:       s.address || null,
          notes:         s.notes  || null,
          isActive:      s.isActive ?? true,
          openingBalance: 0,
          createdAt:     dt(s.createdAt),
        },
      });
      ID.supplier.set(mongoId, created.id);
    }
    log(`  ✅ ${Math.min(i + BATCH, data.length)}/${data.length} مورد`);
  }
}

// ── 5. ITEMS + ITEMSTOCKS ─────────────────────────────────────────────────────
async function migrateItems() {
  const data = readDb1('ceo.items.json');
  log(`Items: ${data.length} records`);

  // الموسم النشط
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });

  for (const it of data) {
    const mongoId = oid(it._id);

    const created = await prisma.item.create({
      data: {
        code:              String(it.code),
        name:              it.name,
        category:          it.category  || null,
        unit:              it.unit       || 'كرتون',
        defaultWeight:     num(it.defaultWeight),
        lastPurchasePrice: num(it.lastPurchasePrice),
        lastSalePrice:     num(it.lastSalePrice),
        isRawMaterial:     it.isRawMaterial ?? false,
        isActive:          it.isActive ?? true,
        notes:             it.notes || null,
        createdAt:         dt(it.createdAt),
      },
    });
    ID.item.set(mongoId, created.id);

    // ItemStocks — ramses + october
    const stock = it.stock || {};
    const warehouses = ['ramses', 'october'];

    for (const wh of warehouses) {
      const s = stock[wh] || { quantity: 0, weight: 0 };
      await prisma.itemStock.create({
        data: {
          itemId:    created.id,
          warehouse: wh,
          quantity:  num(s.quantity),
          weight:    num(s.weight),
          seasonId:  activeSeason?.id || null,
        },
      });
    }
  }
  log(`  ✅ ${data.length} صنف مع مخزونهم`);
}

// ── 6. PRICELISTS + LINKS ─────────────────────────────────────────────────────
async function migratePriceLists() {
  const data = readDb1('ceo.pricelists.json');
  log(`PriceLists: ${data.length} records`);

  for (const pl of data) {
    // تنظيف الـ prices array من $oid
    const prices = (pl.prices || []).map(p => ({
      label: p.label || '',
      price: num(p.price),
    }));

    const created = await prisma.priceList.create({
      data: {
        priceListName:        pl.priceListName,
        priceListDescription: pl.priceListDescription || '',
        displayOrder:         num(pl.displayOrder),
        displayName:          pl.displayName || '',
        origin:               pl.origin || '',
        unit:                 pl.unit   || '',
        notes:                pl.notes  || '',
        prices,
        defaultPrice:         num(pl.defaultPrice),
        itemDisplayOrder:     num(pl.itemDisplayOrder),
        isActive:             pl.isActive ?? true,
        createdAt:            dt(pl.createdAt),
      },
    });

    // PriceListItemLinks
    for (const li of (pl.linkedItems || [])) {
      const itemMongoId = oid(li.item);
      const itemPrismaId = ID.item.get(itemMongoId);
      if (!itemPrismaId) {
        console.warn(`    ⚠️  صنف غير موجود: ${itemMongoId} في قائمة ${pl.priceListName}`);
        continue;
      }
      await prisma.priceListItemLink.create({
        data: {
          priceListId: created.id,
          itemId:      itemPrismaId,
          itemCode:    li.itemCode || '',
          itemName:    li.itemName || '',
        },
      });
    }
  }
  log(`  ✅ ${data.length} قائمة أسعار`);
}

// ── 7. CUSTOMER SEASON BALANCES ───────────────────────────────────────────────
// الرصيد الابتدائي في الـ MongoDB كان مخزون في فواتير INIT أو في حقل initialBalance
// نحوّله لـ CustomerSeasonBalance في Prisma
async function migrateCustomerBalances() {
  const sales    = readDb1('ceo.saleinvoices.json');
  const customers = readDb1('ceo.customers.json');

  // الموسم النشط
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) { log('  ⚠️  مفيش موسم نشط — تخطي customer balances'); return; }

  // نبني map من customer mongo OID → initialBalance من فواتير INIT
  const initSalesMap = new Map(); // customerMongoId → balance
  for (const inv of sales) {
    if (!inv.docNumber?.startsWith('INIT')) continue;
    const custOid = oid(inv.customer);
    if (!custOid) continue;
    // الـ balance هو price × quantity في الـ item الوحيد في الفاتورة
    const item  = inv.items?.[0];
    if (!item) continue;
    const amount = num(item.price) * num(item.quantity);
    initSalesMap.set(custOid, amount);
  }

  // بديل ثاني: initialBalance مباشرة على الـ customer document
  for (const c of customers) {
    const mongoId = oid(c._id);
    if (!initSalesMap.has(mongoId) && c.initialBalance) {
      initSalesMap.set(mongoId, num(c.initialBalance));
    }
  }

  log(`CustomerSeasonBalances: ${initSalesMap.size} عميل عنده رصيد ابتدائي`);

  let done = 0;
  for (const [mongoId, balance] of initSalesMap) {
    if (balance === 0) continue;
    const prismaId = ID.customer.get(mongoId);
    if (!prismaId) {
      console.warn(`    ⚠️  عميل غير موجود: ${mongoId}`);
      continue;
    }
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
  if (!activeSeason) { log('  ⚠️  مفيش موسم نشط — تخطي supplier balances'); return; }

  const initPurchMap = new Map(); // supplierMongoId → balance
  for (const inv of purchases) {
    if (!inv.docNumber?.startsWith('INIT')) continue;
    const suppOid = oid(inv.supplier);
    if (!suppOid) continue;
    const item   = inv.items?.[0];
    if (!item) continue;
    const amount = num(item.price) * num(item.quantity);
    initPurchMap.set(suppOid, amount);
  }

  log(`SupplierSeasonBalances: ${initPurchMap.size} مورد عنده رصيد ابتدائي`);

  let done = 0;
  for (const [mongoId, balance] of initPurchMap) {
    if (balance === 0) continue;
    const prismaId = ID.supplier.get(mongoId);
    if (!prismaId) {
      console.warn(`    ⚠️  مورد غير موجود: ${mongoId}`);
      continue;
    }
    await prisma.supplierSeasonBalance.upsert({
      where:  { supplierId_seasonId: { supplierId: prismaId, seasonId: activeSeason.id } },
      update: { openingBalance: balance },
      create: { supplierId: prismaId, seasonId: activeSeason.id, openingBalance: balance },
    });
    done++;
  }
  log(`  ✅ ${done} رصيد ابتدائي للموردين`);
}

// ── 9. PURCHASE INVOICES (الحقيقية بس — مش INIT) ─────────────────────────────
async function migratePurchaseInvoices() {
  const data = readDb1('ceo.purchaseinvoices.json');
  const real = data.filter(inv => !inv.docNumber?.startsWith('INIT'));
  log(`PurchaseInvoices: ${real.length} فاتورة حقيقية (تم تخطي ${data.length - real.length} INIT)`);

  const activeSeason  = await prisma.season.findFirst({ where: { isActive: true } });
  const defaultUserId = [...ID.user.values()][0]; // أول user كـ fallback

  for (const inv of real) {
    const suppMongoId  = oid(inv.supplier);
    const suppPrismaId = ID.supplier.get(suppMongoId);

    if (!suppPrismaId) {
      console.warn(`    ⚠️  مورد غير موجود: ${suppMongoId} — تخطي فاتورة ${inv.invoiceNumber}`);
      continue;
    }

    const createdByMongoId = oid(inv.createdBy);
    const createdById      = ID.user.get(createdByMongoId) || defaultUserId;
    const approvedByMongoId= oid(inv.approvedBy);
    const approvedById     = approvedByMongoId ? (ID.user.get(approvedByMongoId) || null) : null;

    // recalculate totals من الـ items
    const recalcItems = (inv.items || []).map(i => {
      const qty = num(i.quantity);
      const wt  = num(i.weight);
      const pr  = num(i.price);
      const tw  = Math.round(qty * wt * 1000) / 1000;
      const tot = Math.round(tw * pr * 100) / 100;
      return { ...i, _tw: tw, _tot: tot };
    });

    const totalWeight = Math.round(recalcItems.reduce((s, i) => s + i._tw, 0) * 1000) / 1000;
    const totalAmount = Math.round(recalcItems.reduce((s, i) => s + i._tot, 0) * 100) / 100;

    await prisma.purchaseInvoice.create({
      data: {
        invoiceNumber:  inv.invoiceNumber,
        docNumber:      String(inv.docNumber),
        date:           dt(inv.date),
        supplierId:     suppPrismaId,
        supplierCode:   inv.supplierCode || '',
        supplierName:   inv.supplierName || '',
        warehouse:      inv.warehouse === 'october' ? 'october' : 'ramses',
        totalAmount,
        totalWeight,
        discountAmount: num(inv.discountAmount),
        netAmount:      num(inv.netAmount) || totalAmount,
        paidAmount:     num(inv.paidAmount),
        remainingAmount: Math.round((totalAmount - num(inv.paidAmount)) * 100) / 100,
        status:         inv.status === 'approved' ? 'approved' : 'pending',
        seasonId:       activeSeason?.id || null,
        notes:          inv.notes || null,
        createdById,
        approvedById,
        approvedAt:     inv.approvedAt ? dt(inv.approvedAt) : null,
        createdAt:      dt(inv.createdAt),
        items: {
          create: recalcItems.map((i, idx) => {
            const itemMongoId  = oid(i.item);
            const itemPrismaId = ID.item.get(itemMongoId);
            return {
              itemId:    itemPrismaId || (async () => { throw new Error(`صنف مش موجود: ${itemMongoId}`) })(),
              itemCode:  i.itemCode || '',
              itemName:  i.itemName || '',
              quantity:  num(i.quantity),
              weight:    num(i.weight),
              price:     num(i.price),
              discount:  num(i.discount),
              total:     i._tot,
              sortOrder: idx,
            };
          }).filter(i => i.itemId), // skip items with no matching prisma id
        },
      },
    });
    log(`  ✅ فاتورة شراء: ${inv.invoiceNumber}`);
  }
}

// ── 10. SEASON COUNTERS ───────────────────────────────────────────────────────
async function migrateCounters() {
  const data = readDb1('ceo.counters.json');
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) { log('  ⚠️  مفيش موسم نشط — تخطي counters'); return; }

  log(`SeasonCounters: ${data.length} عداد`);

  for (const c of data) {
    await prisma.seasonCounter.upsert({
      where:  { seasonId_prefix: { seasonId: activeSeason.id, prefix: c.name } },
      update: { value: c.value },
      create: { seasonId: activeSeason.id, prefix: c.name, value: c.value },
    });
    log(`  ✅ عداد ${c.name}: ${c.value}`);
  }

  // تأكد إن RET counter موجود (بدأ من صفر لو مش موجود)
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
    try {
      await fn();
    } catch (err) {
      console.error(`  ❌ خطأ في ${name}:`, err.message);
      if (process.env.STOP_ON_ERROR === '1') throw err;
    }
  }

  console.log('\n════════════════════════════════════════════════');
  console.log('  ✅ Migration اتكملت بنجاح!');
  console.log('════════════════════════════════════════════════\n');

  // ── ملخص ──────────────────────────────────────────────────────────────────
  const [
    seasons, users, customers, suppliers, items,
    priceLists, custBalances, suppBalances, purchaseInvoices,
  ] = await Promise.all([
    prisma.season.count(),
    prisma.user.count(),
    prisma.customer.count(),
    prisma.supplier.count(),
    prisma.item.count(),
    prisma.priceList.count(),
    prisma.customerSeasonBalance.count(),
    prisma.supplierSeasonBalance.count(),
    prisma.purchaseInvoice.count(),
  ]);

  console.log('  📊 ملخص الداتا المحوّلة:');
  console.log(`     مواسم:              ${seasons}`);
  console.log(`     مستخدمين:           ${users}`);
  console.log(`     عملاء:              ${customers}`);
  console.log(`     موردين:             ${suppliers}`);
  console.log(`     أصناف:              ${items}`);
  console.log(`     قوائم أسعار:        ${priceLists}`);
  console.log(`     أرصدة افتتاحية عملاء: ${custBalances}`);
  console.log(`     أرصدة افتتاحية موردين: ${suppBalances}`);
  console.log(`     فواتير شراء:        ${purchaseInvoices}`);
  console.log('');
}

main()
  .catch((err) => {
    console.error('\n❌ Migration فشلت:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());