//  ══════════════════════════════════════════════════════════════════════════════
//  migrate.js  —  ترحيل كامل من MongoDB → PostgreSQL (Prisma)
//
//  الملفات المدعومة:
//    ceo.seasons.json        → seasons
//    ceo.users.json          → users
//    ceo.customers.json      → customers + customer_season_balances
//    ceo.suppliers.json      → suppliers
//    ceo.items.json          → items + item_stocks
//    ceo.pricelists.json     → price_lists + price_list_item_links
//    ceo.saleinvoices.json   → sale_invoices + sale_invoice_items
//    ceo.purchaseinvoices.json → purchase_invoices + purchase_invoice_items
//    ceo.counters.json       → global_counters
//
//  تشغيل:
//    node migrate.js              ← ترحيل كامل
//    DRY_RUN=1 node migrate.js    ← قراءة بس بدون كتابة
//    STOP_ON_ERROR=1 node migrate.js
// ══════════════════════════════════════════════════════════════════════════════
'use strict';

require('dotenv').config();
const path = require('path');
const fs   = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma  = new PrismaClient({ log: [] });
const STOP    = process.env.STOP_ON_ERROR === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
const DB1     = path.join(__dirname, 'db1');

// ── الألوان ────────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
  bold: '\x1b[1m', dim: '\x1b[2m',
};
const ok   = (m) => console.log(`${C.green}  ✓${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}  ⚠${C.reset}  ${m}`);
const fail = (m) => console.log(`${C.red}  ✗${C.reset} ${m}`);
const head = (m) => console.log(`\n${C.bold}${C.blue}── ${m}${C.reset}`);
const line = ()  => console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`);

// ── helpers ───────────────────────────────────────────────────────────────────
const oid = (v) => (v && typeof v === 'object' && v.$oid) ? v.$oid : (v || null);
const dt  = (v) => {
  if (!v) return new Date();
  if (v && typeof v === 'object' && v.$date) return new Date(v.$date);
  return new Date(v);
};
const num = (v, d = 0) => { const n = parseFloat(v); return isNaN(n) ? d : n; };

const readJson = (fname) => {
  const p = path.join(DB1, fname);
  if (!fs.existsSync(p)) { console.error(`  ❌ مش موجود: db1/${fname}`); process.exit(1); }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error(`  ❌ خطأ في ${fname}: ${e.message}`); process.exit(1); }
};

// ── خرائط للـ IDs ──────────────────────────────────────────────────────────────
const MAP = {
  users:     new Map(), // mongoOid → prismaUUID
  customers: new Map(),
  suppliers: new Map(),
  items:     new Map(),
  itemByCode:new Map(),
  seasons:   new Map(),
};

// ── stats ─────────────────────────────────────────────────────────────────────
const S = {};
const stat = (key) => { if (!S[key]) S[key] = { ok: 0, skip: 0, fail: 0 }; return S[key]; };
const inc  = (key, field) => { stat(key)[field] = (stat(key)[field] || 0) + 1; };

// ══════════════════════════════════════════════════════════════════════════════
//  STEP 0 — المواسم
// ══════════════════════════════════════════════════════════════════════════════
async function migrateSeasons() {
  head('STEP 0 — المواسم');
  const data = readJson('ceo.seasons.json');
  console.log(`  ${data.length} موسم في الملف`);

  for (const s of data) {
    const mongoId = oid(s._id);
    const name    = s.name?.trim();
    const code    = (s.code || name.replace(/\s+/g, '_').replace(/[^\w_]/g, '').substring(0, 20) || 'SEASON1').trim();

    try {
      let rec;
      if (!DRY_RUN) {
        rec = await prisma.season.upsert({
          where:  { code },
          update: { name, isActive: s.isActive ?? false, isManufacturing: s.isManufacturing ?? false,
                    startDate: dt(s.startDate), endDate: dt(s.endDate) },
          create: { name, code, isActive: s.isActive ?? false, isManufacturing: s.isManufacturing ?? false,
                    isClosed: s.isClosed ?? false, startDate: dt(s.startDate), endDate: dt(s.endDate),
                    notes: s.notes || null, createdAt: dt(s.createdAt) },
        });
      } else {
        rec = { id: `dry_season_${mongoId}` };
      }
      if (mongoId) MAP.seasons.set(mongoId, rec.id);
      ok(`${name}  (${code})`);
      inc('seasons', 'ok');
    } catch (e) {
      fail(`موسم [${name}]: ${e.message}`);
      inc('seasons', 'fail');
      if (STOP) throw e;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  STEP 1 — المستخدمون
// ══════════════════════════════════════════════════════════════════════════════
async function migrateUsers() {
  head('STEP 1 — المستخدمون');
  const data = readJson('ceo.users.json');
  console.log(`  ${data.length} مستخدم في الملف`);

  // role map: mongo → prisma
  const roleMap = { super_admin: 'super_admin', admin: 'admin', supervisor: 'supervisor', user: 'user', viewer: 'viewer' };
  // scope/warehouse map
  const scopeMap = { ramses: 'ramses', october: 'october', both: 'both' };

  for (const u of data) {
    const mongoId  = oid(u._id);
    const username = u.username?.toLowerCase().trim();
    try {
      let rec;
      if (!DRY_RUN) {
        rec = await prisma.user.upsert({
          where:  { username },
          update: { name: u.name, role: roleMap[u.role] || 'user', scope: scopeMap[u.warehouse || u.scope] || 'both',
                    isActive: u.isActive ?? true },
          create: { name: u.name, username, password: u.password,
                    role: roleMap[u.role] || 'user', scope: scopeMap[u.warehouse || u.scope] || 'both',
                    isActive: u.isActive ?? true, createdAt: dt(u.createdAt) },
        });
      } else {
        rec = { id: `dry_user_${mongoId}` };
      }
      if (mongoId) MAP.users.set(mongoId, rec.id);
      ok(`${username}  (${u.role})`);
      inc('users', 'ok');
    } catch (e) {
      fail(`مستخدم [${username}]: ${e.message}`);
      inc('users', 'fail');
      if (STOP) throw e;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  STEP 2 — العملاء
// ══════════════════════════════════════════════════════════════════════════════
async function migrateCustomers(seasonId) {
  head('STEP 2 — العملاء');
  const data = readJson('ceo.customers.json');
  console.log(`  ${data.length} عميل في الملف`);

  const BATCH = 100;
  let done = 0;

  for (const c of data) {
    const mongoId = oid(c._id);
    const code    = String(c.code).trim();
    const type    = c.type === 'cash' ? 'cash' : 'credit';

    try {
      let rec;
      if (!DRY_RUN) {
        rec = await prisma.customer.upsert({
          where:  { code },
          update: { name: c.name, phone: c.phone || null, address: c.address || null,
                    type, isActive: c.isActive ?? true, notes: c.notes || null,
                    openingBalance: num(c.initialBalance) },
          create: { code, name: c.name, phone: c.phone || null, address: c.address || null,
                    type, isActive: c.isActive ?? true, notes: c.notes || null,
                    openingBalance: num(c.initialBalance), createdAt: dt(c.createdAt) },
        });

        // رصيد أول المدة في الموسم
        const openingBal = num(c.initialBalance);
        if (openingBal !== 0 && seasonId) {
          await prisma.customerSeasonBalance.upsert({
            where:  { customerId_seasonId: { customerId: rec.id, seasonId } },
            update: { openingBalance: openingBal },
            create: { customerId: rec.id, seasonId, openingBalance: openingBal },
          });
          inc('customerBalances', 'ok');
        }
      } else {
        rec = { id: `dry_cust_${mongoId}` };
      }
      if (mongoId) MAP.customers.set(mongoId, rec.id);
      inc('customers', 'ok');
      done++;
      if (done % BATCH === 0) process.stdout.write(`\r    → ${done}/${data.length}`);
    } catch (e) {
      fail(`عميل [${code}] ${c.name}: ${e.message}`);
      inc('customers', 'fail');
      if (STOP) throw e;
    }
  }
  process.stdout.write(`\r    → ${done}/${data.length}\n`);
  ok(`${done} عميل | ${stat('customerBalances').ok || 0} رصيد ابتدائي`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  STEP 3 — الموردون
// ══════════════════════════════════════════════════════════════════════════════
async function migrateSuppliers() {
  head('STEP 3 — الموردون');
  const data = readJson('ceo.suppliers.json');
  console.log(`  ${data.length} مورد في الملف`);

  let done = 0;
  for (const s of data) {
    const mongoId = oid(s._id);
    const code    = String(s.code).trim();

    try {
      let rec;
      if (!DRY_RUN) {
        rec = await prisma.supplier.upsert({
          where:  { code },
          update: { name: s.name, phone: s.phone || null, address: s.address || null,
                    isActive: s.isActive ?? true, notes: s.notes || null },
          create: { code, name: s.name, phone: s.phone || null, address: s.address || null,
                    isActive: s.isActive ?? true, notes: s.notes || null, createdAt: dt(s.createdAt) },
        });
      } else {
        rec = { id: `dry_sup_${mongoId}` };
      }
      if (mongoId) MAP.suppliers.set(mongoId, rec.id);
      inc('suppliers', 'ok');
      done++;
      if (done % 100 === 0) process.stdout.write(`\r    → ${done}/${data.length}`);
    } catch (e) {
      fail(`مورد [${code}] ${s.name}: ${e.message}`);
      inc('suppliers', 'fail');
      if (STOP) throw e;
    }
  }
  process.stdout.write(`\r    → ${done}/${data.length}\n`);
  ok(`${done} مورد`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  STEP 4 — الأصناف + المخزون
// ══════════════════════════════════════════════════════════════════════════════
async function migrateItems(seasonId) {
  head('STEP 4 — الأصناف + المخزون');
  const data = readJson('ceo.items.json');
  console.log(`  ${data.length} صنف في الملف`);

  // بناء الخريطة من DB الموجود للـ idempotency
  if (!DRY_RUN) {
    const existing = await prisma.item.findMany({ select: { id: true, code: true, metadata: true } });
    for (const it of existing) {
      MAP.itemByCode.set(it.code, it.id);
      const mid = it.metadata?.mongoId;
      if (mid) MAP.items.set(mid, it.id);
    }
  }

  let done = 0;
  for (const it of data) {
    const mongoId = oid(it._id);
    const code    = String(it.code).trim();

    try {
      let rec;
      if (!DRY_RUN) {
        rec = await prisma.item.upsert({
          where:  { code },
          update: { name: it.name, category: it.category || null, subCategory: it.subCategory || null,
                    unit: it.unit || 'كرتون', defaultWeight: num(it.defaultWeight),
                    lastPurchasePrice: num(it.lastPurchasePrice), lastSalePrice: num(it.lastSalePrice),
                    isRawMaterial: it.isRawMaterial ?? false, isActive: it.isActive ?? true,
                    notes: it.notes || null, metadata: { mongoId } },
          create: { code, name: it.name, category: it.category || null, subCategory: it.subCategory || null,
                    unit: it.unit || 'كرتون', defaultWeight: num(it.defaultWeight),
                    lastPurchasePrice: num(it.lastPurchasePrice), lastSalePrice: num(it.lastSalePrice),
                    isRawMaterial: it.isRawMaterial ?? false, isActive: it.isActive ?? true,
                    notes: it.notes || null, createdAt: dt(it.createdAt), metadata: { mongoId } },
        });
      } else {
        rec = { id: MAP.itemByCode.get(code) || `dry_item_${mongoId}` };
      }
      MAP.items.set(mongoId, rec.id);
      MAP.itemByCode.set(code, rec.id);
      inc('items', 'ok');

      // مخزون لكل مخزن
      const stock = it.stock || {};
      for (const wh of ['ramses', 'october']) {
        const s = stock[wh] || { quantity: 0, weight: 0 };
        try {
          if (!DRY_RUN) {
            await prisma.itemStock.upsert({
              where:  { itemId_warehouse_seasonId: { itemId: rec.id, warehouse: wh, seasonId: seasonId ?? null } },
              update: { quantity: num(s.quantity), weight: num(s.weight) },
              create: { itemId: rec.id, warehouse: wh, quantity: num(s.quantity), weight: num(s.weight), seasonId: seasonId ?? null },
            });
          }
          inc('stocks', 'ok');
        } catch (e) {
          fail(`مخزون [${code}/${wh}]: ${e.message}`);
          inc('stocks', 'fail');
        }
      }

      done++;
      if (done % 50 === 0) process.stdout.write(`\r    → ${done}/${data.length}`);
    } catch (e) {
      fail(`صنف [${code}] ${it.name}: ${e.message}`);
      inc('items', 'fail');
      if (STOP) throw e;
    }
  }
  process.stdout.write(`\r    → ${done}/${data.length}\n`);
  ok(`${done} صنف | ${stat('stocks').ok} سجل مخزون`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  STEP 5 — قوائم الأسعار
// ══════════════════════════════════════════════════════════════════════════════
async function migratePriceLists() {
  head('STEP 5 — قوائم الأسعار');
  const data = readJson('ceo.pricelists.json');
  console.log(`  ${data.length} قائمة في الملف`);

  if (!DRY_RUN) {
    // امسح القديم الغلط وابدأ من صفر
    const oldCount = await prisma.priceList.count();
    if (oldCount > 0) {
      await prisma.priceListItemLink.deleteMany({});
      await prisma.priceList.deleteMany({});
      warn(`حُذف ${oldCount} سجل قديم`);
    }

    // ارفع كل القوائم دفعات
    const BATCH = 50;
    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH).map(pl => ({
        priceListName:        pl.priceListName,
        priceListDescription: pl.priceListDescription || '',
        displayOrder:         num(pl.displayOrder),
        displayName:          pl.displayName || '',
        origin:               pl.origin || '',
        unit:                 pl.unit || '',
        notes:                pl.notes || '',
        prices:               (pl.prices || []).map(p => ({ label: p.label || '', price: num(p.price) })),
        defaultPrice:         num(pl.defaultPrice),
        itemDisplayOrder:     num(pl.itemDisplayOrder),
        isActive:             pl.isActive ?? true,
        createdAt:            dt(pl.createdAt),
      }));
      await prisma.priceList.createMany({ data: batch });
      inc('priceLists', 'ok'); // بنعد الـ batch مش الأفراد هنا
      process.stdout.write(`\r    → ${Math.min(i + BATCH, data.length)}/${data.length}`);
    }
    process.stdout.write('\n');

    // بناء الروابط
    const dbPriceLists = await prisma.priceList.findMany({
      select: { id: true, priceListName: true, itemDisplayOrder: true },
    });
    const plMap = new Map(dbPriceLists.map(r => [`${r.priceListName}||${r.itemDisplayOrder}`, r.id]));

    const allLinks = [];
    for (const pl of data) {
      const plId = plMap.get(`${pl.priceListName}||${num(pl.itemDisplayOrder)}`);
      if (!plId) continue;
      for (const li of (pl.linkedItems || [])) {
        const mongoItemId  = oid(li.item);
        const code         = li.itemCode ? String(li.itemCode).trim() : null;
        const itemPrismaId = MAP.items.get(mongoItemId) || (code ? MAP.itemByCode.get(code) : null);
        if (!itemPrismaId) { inc('plLinks', 'skip'); continue; }
        allLinks.push({ priceListId: plId, itemId: itemPrismaId,
                        itemCode: code || '', itemName: li.itemName || '' });
      }
    }

    if (allLinks.length > 0) {
      const r = await prisma.priceListItemLink.createMany({ data: allLinks, skipDuplicates: true });
      inc('plLinks', 'ok');
      ok(`روابط: ${r.count} أُنشئت`);
    }

    const finalCount = await prisma.priceList.count();
    ok(`${finalCount} قائمة أسعار${finalCount === data.length ? ' ✅' : ` ⚠️ المفروض ${data.length}`}`);
  } else {
    ok(`DRY_RUN — ${data.length} قائمة سيتم رفعها`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  STEP 6 — فواتير المبيعات
// ══════════════════════════════════════════════════════════════════════════════
async function migrateSaleInvoices(seasonId, systemUserId) {
  head('STEP 6 — فواتير المبيعات');
  const data = readJson('ceo.saleinvoices.json');
  console.log(`  ${data.length} فاتورة في الملف`);

  let done = 0, skipped = 0;

  for (const inv of data) {
    const mongoId = oid(inv._id);
    const invNum  = inv.invoiceNumber;

    try {
      if (!DRY_RUN) {
        // skip لو موجودة
        const existing = await prisma.saleInvoice.findFirst({
          where: { invoiceNumber: invNum },
          select: { id: true },
        });
        if (existing) { skipped++; inc('saleInv', 'skip'); continue; }

        // resolve IDs
        const customerId  = MAP.customers.get(oid(inv.customer));
        const createdById = MAP.users.get(oid(inv.createdBy)) || systemUserId;
        const approvedById= MAP.users.get(oid(inv.approvedBy)) || null;
        const invSeasonId = MAP.seasons.get(oid(inv.season)) || seasonId;

        if (!customerId) {
          warn(`فاتورة [${invNum}] — عميل مش موجود: ${oid(inv.customer)}`);
          inc('saleInv', 'skip'); skipped++; continue;
        }

        const totalAmount   = num(inv.totalAmount);
        const paidAmount    = num(inv.paidAmount);
        const remainingAmt  = totalAmount - paidAmount;
        const paymentMethod = inv.paymentMethod || 'credit';

        // بناء الأصناف
        const itemsData = [];
        for (const li of (inv.items || [])) {
          const liMongoId    = oid(li.item);
          const liCode       = li.itemCode ? String(li.itemCode).trim() : null;
          const liItemId     = MAP.items.get(liMongoId) || (liCode ? MAP.itemByCode.get(liCode) : null);

          // للأصناف الوهمية (BALANCE-INIT) نتجاهلها أو نضيفها بـ null
          const itemId = liItemId || null;
          if (!itemId) {
            inc('saleItems', 'skip');
            warn(`  → صنف مش موجود: ${liCode || liMongoId} في ${invNum}`);
            continue;
          }

          const qty        = num(li.quantity);
          const weight     = num(li.weight);
          const totalWt    = num(li.totalWeight) || (qty * weight);
          const price      = num(li.price);
          const total      = num(li.total) || (totalWt * price);

          itemsData.push({
            itemId, itemCode: liCode || '', itemName: li.itemName || '',
            quantity: qty, weight, totalWeight: totalWt,
            price, discount: 0, total,
          });
        }

        await prisma.saleInvoice.create({
          data: {
            invoiceNumber:  invNum,
            docNumber:      inv.docNumber || invNum,
            date:           dt(inv.date),
            customerId,
            customerCode:   inv.customerCode || '',
            customerName:   inv.customerName || '',
            warehouse:      inv.warehouse || 'ramses',
            totalAmount,
            totalWeight:    num(inv.totalWeight),
            discountAmount: 0,
            netAmount:      totalAmount,
            paidAmount,
            remainingAmount: remainingAmt,
            cashAmount:     num(inv.cashAmount),
            instapayAmount: num(inv.instapayAmount),
            transferAmount: 0,
            paymentMethod,
            status:         inv.status || 'pending',
            allowNegative:  inv.allowNegativeSale ?? false,
            seasonId:       invSeasonId,
            notes:          inv.notes || null,
            createdById,
            approvedById,
            approvedAt:     inv.approvedAt ? dt(inv.approvedAt) : null,
            createdAt:      dt(inv.createdAt),
            items:          { create: itemsData },
          },
        });
        inc('saleInv', 'ok');
        inc('saleItems', 'ok');
      } else {
        inc('saleInv', 'ok');
      }

      done++;
      if (done % 10 === 0) process.stdout.write(`\r    → ${done}/${data.length}`);
    } catch (e) {
      fail(`فاتورة مبيعات [${invNum}]: ${e.message}`);
      inc('saleInv', 'fail');
      if (STOP) throw e;
    }
  }
  process.stdout.write(`\r    → ${done + skipped}/${data.length}\n`);
  ok(`${done} أُنشئت | ${skipped} موجودة مسبقاً | ${stat('saleInv').fail} فشلت`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  STEP 7 — فواتير المشتريات
// ══════════════════════════════════════════════════════════════════════════════
async function migratePurchaseInvoices(seasonId, systemUserId) {
  head('STEP 7 — فواتير المشتريات');
  const data = readJson('ceo.purchaseinvoices.json');
  console.log(`  ${data.length} فاتورة في الملف`);

  let done = 0, skipped = 0;

  for (const inv of data) {
    const invNum = inv.invoiceNumber;

    try {
      if (!DRY_RUN) {
        const existing = await prisma.purchaseInvoice.findFirst({
          where: { invoiceNumber: invNum }, select: { id: true },
        });
        if (existing) { skipped++; inc('purInv', 'skip'); continue; }

        const supplierId  = MAP.suppliers.get(oid(inv.supplier));
        const createdById = MAP.users.get(oid(inv.createdBy)) || systemUserId;
        const approvedById= MAP.users.get(oid(inv.approvedBy)) || null;
        const invSeasonId = MAP.seasons.get(oid(inv.season)) || seasonId;

        if (!supplierId) {
          warn(`فاتورة شراء [${invNum}] — مورد مش موجود`);
          inc('purInv', 'skip'); skipped++; continue;
        }

        const totalAmount  = num(inv.totalAmount);
        const paidAmount   = num(inv.paidAmount || 0);
        const remaining    = totalAmount - paidAmount;

        const itemsData = [];
        for (const li of (inv.items || [])) {
          const liCode   = li.itemCode ? String(li.itemCode).trim() : null;
          const liItemId = MAP.items.get(oid(li.item)) || (liCode ? MAP.itemByCode.get(liCode) : null);
          if (!liItemId) { inc('purItems', 'skip'); continue; }

          const qty     = num(li.quantity);
          const weight  = num(li.weight);
          const totalWt = num(li.totalWeight) || (qty * weight);
          const price   = num(li.price);
          const total   = num(li.total) || (totalWt * price);

          itemsData.push({
            itemId: liItemId, itemCode: liCode || '', itemName: li.itemName || '',
            quantity: qty, weight, totalWeight: totalWt,
            price, discount: 0, total,
          });
        }

        await prisma.purchaseInvoice.create({
          data: {
            invoiceNumber:  invNum,
            docNumber:      inv.docNumber || invNum,
            date:           dt(inv.date),
            supplierId,
            supplierCode:   inv.supplierCode || '',
            supplierName:   inv.supplierName || '',
            warehouse:      inv.warehouse || 'ramses',
            totalAmount,
            totalWeight:    num(inv.totalWeight),
            discountAmount: 0,
            netAmount:      totalAmount,
            paidAmount,
            remainingAmount: remaining,
            status:         inv.status || 'pending',
            seasonId:       invSeasonId,
            notes:          inv.notes || null,
            createdById,
            approvedById,
            approvedAt:     inv.approvedAt ? dt(inv.approvedAt) : null,
            createdAt:      dt(inv.createdAt),
            items:          { create: itemsData },
          },
        });
        inc('purInv', 'ok');
        inc('purItems', 'ok');
      } else {
        inc('purInv', 'ok');
      }

      done++;
    } catch (e) {
      fail(`فاتورة شراء [${invNum}]: ${e.message}`);
      inc('purInv', 'fail');
      if (STOP) throw e;
    }
  }
  ok(`${done} أُنشئت | ${skipped} موجودة | ${stat('purInv').fail} فشلت`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  STEP 8 — العدادات
// ══════════════════════════════════════════════════════════════════════════════
async function migrateCounters() {
  head('STEP 8 — العدادات (global_counters)');
  const data = readJson('ceo.counters.json');

  for (const c of data) {
    const name  = c.name?.trim();
    const value = num(c.value);
    try {
      if (!DRY_RUN) {
        await prisma.globalCounter.upsert({
          where:  { name },
          update: { value },
          create: { name, value },
        });
      }
      ok(`${name} = ${value}`);
      inc('counters', 'ok');
    } catch (e) {
      fail(`عداد [${name}]: ${e.message}`);
      inc('counters', 'fail');
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.clear();
  const LINE = '═'.repeat(60);

  console.log(`\n${C.bold}${C.blue}${LINE}`);
  console.log('  Migration: MongoDB JSON → PostgreSQL (Prisma)');
  if (DRY_RUN) console.log(`  ${C.yellow}⚠️  DRY RUN — قراءة بس، مفيش كتابة${C.blue}`);
  console.log(`${LINE}${C.reset}\n`);

  console.log('  الملفات:');
  const files = [
    ['ceo.seasons.json',         'مواسم'],
    ['ceo.users.json',           'مستخدمين'],
    ['ceo.customers.json',       'عملاء'],
    ['ceo.suppliers.json',       'موردين'],
    ['ceo.items.json',           'أصناف'],
    ['ceo.pricelists.json',      'قوائم أسعار'],
    ['ceo.saleinvoices.json',    'فواتير مبيعات'],
    ['ceo.purchaseinvoices.json','فواتير مشتريات'],
    ['ceo.counters.json',        'عدادات'],
  ];
  for (const [f, label] of files) {
    const data = readJson(f);
    console.log(`     ${label.padEnd(20)} ${data.length} سجل`);
  }

  // ── Steps ──────────────────────────────────────────────────────────────────
  await migrateSeasons();
  await migrateUsers();

  // الموسم النشط
  let activeSeason = null;
  if (!DRY_RUN) {
    activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
    if (!activeSeason) {
      fail('مفيش موسم نشط! تأكد إن ceo.seasons.json فيه isActive:true');
      process.exit(1);
    }
    console.log(`\n  ${C.cyan}الموسم النشط: ${activeSeason.name} (${activeSeason.id})${C.reset}`);
  }
  const seasonId = activeSeason?.id ?? null;

  // أول مستخدم admin كـ fallback لـ createdBy
  let systemUserId = null;
  if (!DRY_RUN) {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true } });
    systemUserId = admin?.id ?? null;
  }

  await migrateCustomers(seasonId);
  await migrateSuppliers();
  await migrateItems(seasonId);
  await migratePriceLists();
  await migrateSaleInvoices(seasonId, systemUserId);
  await migratePurchaseInvoices(seasonId, systemUserId);
  await migrateCounters();

  // ── التقرير النهائي ────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${C.green}${LINE}`);
  console.log('  ✅  Migration اكتملت!');
  console.log(`${LINE}${C.reset}`);

  if (!DRY_RUN) {
    const [dbSeasons, dbUsers, dbCustomers, dbSuppliers, dbItems, dbStocks,
           dbPriceLists, dbLinks, dbSaleInv, dbPurInv, dbCounters] = await Promise.all([
      prisma.season.count(),
      prisma.user.count(),
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.item.count(),
      prisma.itemStock.count(),
      prisma.priceList.count(),
      prisma.priceListItemLink.count(),
      prisma.saleInvoice.count(),
      prisma.purchaseInvoice.count(),
      prisma.globalCounter.count(),
    ]);

    console.log(`\n  قاعدة البيانات دلوقتي:`);
    const rows = [
      ['مواسم',              dbSeasons],
      ['مستخدمين',           dbUsers],
      ['عملاء',              dbCustomers],
      ['موردين',             dbSuppliers],
      ['أصناف',              dbItems],
      ['سجلات مخزون',        dbStocks],
      ['قوائم أسعار',        dbPriceLists],
      ['روابط قوائم-أصناف',  dbLinks],
      ['فواتير مبيعات',      dbSaleInv],
      ['فواتير مشتريات',     dbPurInv],
      ['عدادات',             dbCounters],
    ];
    for (const [label, count] of rows) {
      console.log(`     ${label.padEnd(22)} ${String(count).padStart(5)}`);
    }
  }

  // ملخص الأخطاء
  const anyFail = Object.values(S).some(s => s.fail > 0);
  if (anyFail) {
    console.log(`\n${C.yellow}  ⚠️  في سجلات فشلت:${C.reset}`);
    for (const [step, s] of Object.entries(S)) {
      if (s.fail > 0) console.log(`     ${step.padEnd(18)} → فشل: ${s.fail}`);
    }
  } else {
    console.log(`\n  ${C.green}${C.bold}🎉 كل حاجة اتعملت بنجاح!${C.reset}`);
  }
  console.log('');
}

main()
  .catch(e => { console.error('\n  ❌ خطأ:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());