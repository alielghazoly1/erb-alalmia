// ══════════════════════════════════════════════════════════════════════════════
//  migrate.js  —  MongoDB (db1) → PostgreSQL  via Prisma
//  ✅ النسخة المصلحة:
//     - warehouse  →  scope  (اسم الـ field الصح في schema)
//     - permissions object  →  UserPermission rows (relation منفصلة)
//     - تحويل allowNegativeSale/canEditInvoice → enum Permission
//
//  الخطوات:
//    1. ضع الملف ده في مجلد back/ (جنب package.json)
//    2. تأكد إن DATABASE_URL في .env صح وـ DB شغال
//    3. شغّل:  node migrate.js
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs   = require('fs');
const path = require('path');

const prisma = new PrismaClient({ log: ['error', 'warn'] });

// ── مسار بيانات MongoDB ─────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'db1');

// ── Helpers ─────────────────────────────────────────────────────────────────
function loadJSON(filename) {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) { console.warn(`  ⚠️  مش لاقي الملف: ${filename}`); return []; }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error(`  ❌ خطأ في قراءة ${filename}:`, e.message); return []; }
}

// MongoDB ObjectId → string
const oid = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v.$oid) return v.$oid;
  return String(v);
};

// MongoDB date → JS Date
const toDate = (v, fallback = new Date()) => {
  if (!v) return fallback;
  if (v.$date) return new Date(v.$date);
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : d;
};

// ── خريطة IDs القديمة (ObjectId) → الجديدة (UUID) ──────────────────────────
const idMap = {
  users:      new Map(),
  seasons:    new Map(),
  customers:  new Map(),
  suppliers:  new Map(),
  items:      new Map(),
  sales:      new Map(),
  purchases:  new Map(),
  pricelists: new Map(),
};

// ── Enums المسموح بيهم في الـ Schema ────────────────────────────────────────
const VALID_ROLES       = ['super_admin','admin','supervisor','user','viewer'];
const VALID_WAREHOUSES  = ['ramses','october'];
const VALID_W_SCOPES    = ['ramses','october','both'];
const VALID_STATUSES    = ['draft','pending','approved','suspended','cancelled','returned'];
const VALID_PAY_METHODS = ['cash','credit','instapay','transfer','check','mixed'];

const safeRole      = (v) => VALID_ROLES.includes(v)       ? v : 'user';
const safeWarehouse = (v) => VALID_WAREHOUSES.includes(v)  ? v : 'ramses';
const safeScope     = (v) => VALID_W_SCOPES.includes(v)    ? v : 'both';
const safeStatus    = (v) => VALID_STATUSES.includes(v)    ? v : 'pending';
const safePayMethod = (v) => VALID_PAY_METHODS.includes(v) ? v : 'credit';

// ── تحويل permissions من MongoDB format القديم → Permission enum الجديد ────
// الـ permissions القديمة كانت object زي:
//   { allowNegativeSale: true, canEditInvoice: false }
// الـ schema الجديد عنده enum ونضيفهم في جدول UserPermission
function mapLegacyPermissions(permsObj) {
  if (!permsObj || typeof permsObj !== 'object') return [];

  const granted = [];

  // allowNegativeSale → sale_allow_negative
  if (permsObj.allowNegativeSale === true) {
    granted.push('sale_allow_negative');
  }

  // canEditInvoice → sale_edit + purchase_edit
  if (permsObj.canEditInvoice === true) {
    granted.push('sale_edit');
    granted.push('purchase_edit');
  }

  // لو كان فيه permissions تانية ممكن تضيفها هنا بنفس الأسلوب

  return granted;
}

// ── Counter for logging ──────────────────────────────────────────────────────
let stepNum = 0;
const step = (msg) => { stepNum++; console.log(`\n[${stepNum}] ═══ ${msg} ═══`); };
const ok   = (n, label) => console.log(`    ✅  ${n} ${label}`);
const skip = (n, label) => n > 0 && console.log(`    ⏭️   ${n} ${label} (موجودة)`);
const warn = (msg)      => console.log(`    ⚠️   ${msg}`);

// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Migration: MongoDB (db1) → PostgreSQL (Prisma)      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  📂 DATA_DIR: ${DATA_DIR}`);
  console.log(`  🕐 بدأ في:  ${new Date().toLocaleString('ar-EG')}`);

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`\n❌ المجلد مش موجود: ${DATA_DIR}`);
    process.exit(1);
  }

  // ─── 1. Users ────────────────────────────────────────────────────────────
  step('Users');
  const mongoUsers = loadJSON('ceo.users.json');
  let usersOk = 0, usersSkip = 0;

  for (const u of mongoUsers) {
    const oldId = oid(u._id);
    const exists = await prisma.user.findUnique({ where: { username: u.username } });
    if (exists) {
      idMap.users.set(oldId, exists.id);
      usersSkip++;
      continue;
    }

    // ✅ FIX 1: warehouse → scope (اسم الـ field الصح في schema)
    const created = await prisma.user.create({
      data: {
        name:      u.name || u.username,
        username:  u.username,
        password:  u.password,
        role:      safeRole(u.role),
        scope:     safeScope(u.warehouse || u.scope),   // ← warehouse القديم يتحول لـ scope
        isActive:  u.isActive !== false,
        createdAt: toDate(u.createdAt),
        updatedAt: toDate(u.updatedAt),
      },
    });

    // ✅ FIX 2: permissions → UserPermission rows (مش field مباشر)
    // نحول الـ permissions object القديمة لـ enum values ونحطها في الجدول المنفصل
    const rawPerms = u.permissions
      ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions)
      : null;

    const permissionValues = mapLegacyPermissions(rawPerms);

    if (permissionValues.length > 0) {
      await prisma.userPermission.createMany({
        data: permissionValues.map(permission => ({
          userId:    created.id,
          permission,
          granted:   true,
        })),
        skipDuplicates: true,
      });
      console.log(`    🔑  ${u.username}: أضفنا ${permissionValues.length} permissions → [${permissionValues.join(', ')}]`);
    }

    idMap.users.set(oldId, created.id);
    usersOk++;
  }
  ok(usersOk, 'users');
  skip(usersSkip, 'users');

  // ─── 2. Seasons ──────────────────────────────────────────────────────────
  step('Seasons');
  const mongoSeasons = loadJSON('ceo.seasons.json');
  let seasonsOk = 0, seasonsSkip = 0;

  for (const s of mongoSeasons) {
    const oldId = oid(s._id);
    const exists = await prisma.season.findFirst({ where: { name: s.name } });
    if (exists) { idMap.seasons.set(oldId, exists.id); seasonsSkip++; continue; }

    // ✅ FIX: code مش موجود في MongoDB القديمة → نولده من الـ name أو الـ _id
    // مثال: "ياميش 2026" → "YAMSH-2026"، أو fallback لأول 8 chars من الـ ObjectId
    const generateCode = (name, mongoId) => {
      // لو الـ name فيه سنة نستخرجها
      const yearMatch = name.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : '';
      // أول كلمة بالإنجليزي أو أول 4 حروف عربي transliterated
      const prefix = name.replace(/\s+\d{4}.*/, '').trim().slice(0, 4).toUpperCase()
        .replace(/[^A-Z0-9]/g, 'X'); // استبدل أي حرف مش ASCII بـ X
      const shortId = mongoId ? mongoId.slice(-4).toUpperCase() : Math.random().toString(36).slice(2,6).toUpperCase();
      return year ? `${prefix}-${year}` : `${prefix}-${shortId}`;
    };

    const code = s.code || generateCode(s.name, oid(s._id));

    const created = await prisma.season.create({
      data: {
        name:            s.name,
        code,                                    // ← الـ code المولود أو الموجود
        startDate:       toDate(s.startDate),
        endDate:         toDate(s.endDate),
        isActive:        s.isActive !== false,
        isManufacturing: s.isManufacturing === true,
        createdAt:       toDate(s.createdAt),
        updatedAt:       toDate(s.updatedAt),
      },
    });
    idMap.seasons.set(oldId, created.id);
    seasonsOk++;
  }
  ok(seasonsOk, 'seasons');
  skip(seasonsSkip, 'seasons');

  // ─── 3. Customers ────────────────────────────────────────────────────────
  step('Customers');
  const mongoCustomers = loadJSON('ceo.customers.json');
  let custOk = 0, custSkip = 0;

  for (const c of mongoCustomers) {
    const oldId = oid(c._id);
    const exists = await prisma.customer.findUnique({ where: { code: c.code } });
    if (exists) { idMap.customers.set(oldId, exists.id); custSkip++; continue; }

    const created = await prisma.customer.create({
      data: {
        code:           c.code,
        name:           c.name,
        phone:          c.phone   || null,
        address:        c.address || null,
        type:           c.type === 'cash' ? 'cash' : 'credit',
        // isSupplier: removed (not in Customer schema)
        isActive:       c.isActive !== false,
        openingBalance: c.initialBalance || 0,
        notes:          c.notes || null,
        createdAt:      toDate(c.createdAt),
        updatedAt:      toDate(c.updatedAt),
      },
    });
    idMap.customers.set(oldId, created.id);
    custOk++;
  }
  ok(custOk, `customers (من ${mongoCustomers.length})`);
  skip(custSkip, 'customers');

  // ─── 4. Suppliers ────────────────────────────────────────────────────────
  step('Suppliers');
  const mongoSuppliers = loadJSON('ceo.suppliers.json');
  let suppOk = 0, suppSkip = 0;

  for (const s of mongoSuppliers) {
    const oldId = oid(s._id);
    const exists = await prisma.supplier.findUnique({ where: { code: s.code } });
    if (exists) { idMap.suppliers.set(oldId, exists.id); suppSkip++; continue; }

    const created = await prisma.supplier.create({
      data: {
        code:           s.code,
        name:           s.name,
        phone:          s.phone   || null,
        address:        s.address || null,
        notes:          s.notes   || null,
        isActive:       s.isActive !== false,
        // isCustomer: removed (not in Supplier schema)
        openingBalance: s.initialBalance || 0,
        createdAt:      toDate(s.createdAt),
        updatedAt:      toDate(s.updatedAt),
      },
    });
    idMap.suppliers.set(oldId, created.id);
    suppOk++;
  }
  ok(suppOk, `suppliers (من ${mongoSuppliers.length})`);
  skip(suppSkip, 'suppliers');

  // ─── 5. Items ────────────────────────────────────────────────────────────
  step('Items');
  const mongoItems = loadJSON('ceo.items.json');
  let itemsOk = 0, itemsSkip = 0;

  for (const item of mongoItems) {
    const oldId = oid(item._id);
    const exists = await prisma.item.findUnique({ where: { code: item.code } });
    if (exists) { idMap.items.set(oldId, exists.id); itemsSkip++; continue; }

    // stock القديم كان object — نحوّله لـ ItemStock rows (relation منفصلة)
    const stockRows = [
      {
        warehouse: 'ramses',
        quantity:  item.stock?.ramses?.quantity  || 0,
        weight:    item.stock?.ramses?.weight    || 0,
      },
      {
        warehouse: 'october',
        quantity:  item.stock?.october?.quantity || 0,
        weight:    item.stock?.october?.weight   || 0,
      },
    ];

    const created = await prisma.item.create({
      data: {
        code:              item.code,
        name:              item.name,
        category:          item.category || null,
        unit:              item.unit || 'كرتون',
        defaultWeight:     item.defaultWeight     || 0,
        lastPurchasePrice: item.lastPurchasePrice || 0,
        lastSalePrice:     item.lastSalePrice     || 0,
        isRawMaterial:     item.isRawMaterial === true,
        isActive:          item.isActive !== false,
        notes:             item.notes || null,
        createdAt:         toDate(item.createdAt),
        updatedAt:         toDate(item.updatedAt),
        stocks: { create: stockRows },
      },
    });
    idMap.items.set(oldId, created.id);
    itemsOk++;
  }
  ok(itemsOk, `items (من ${mongoItems.length})`);
  skip(itemsSkip, 'items');

  // ─── 6. Sale Invoices ────────────────────────────────────────────────────
  step('Sale Invoices');
  const mongoSales = loadJSON('ceo.saleinvoices.json');
  let salesOk = 0, salesSkip = 0, salesErr = 0;

  // fallback: أي admin user موجود في الـ DB نستخدمه لو الـ createdBy مش في idMap
  const adminFallback = await prisma.user.findFirst({ where: { role: 'admin' } });
  const fallbackUserId = adminFallback?.id || null;

  for (const inv of mongoSales) {
    const oldId = oid(inv._id);
    const exists = await prisma.saleInvoice.findUnique({ where: { invoiceNumber: inv.invoiceNumber } });
    if (exists) { idMap.sales.set(oldId, exists.id); salesSkip++; continue; }

    const customerId   = idMap.customers.get(oid(inv.customer));
    const seasonId     = idMap.seasons.get(oid(inv.season))    || null;
    const createdById  = idMap.users.get(oid(inv.createdBy))   || fallbackUserId;
    const approvedById = inv.approvedBy ? (idMap.users.get(oid(inv.approvedBy)) || fallbackUserId) : null;

    if (!customerId)  { warn(`Sale ${inv.invoiceNumber}: customer مش موجود`); salesErr++; continue; }
    if (!createdById) { warn(`Sale ${inv.invoiceNumber}: createdBy مش موجود ولا يوجد admin fallback`); salesErr++; continue; }

    const invoiceItems = (inv.items || [])
      .map(it => {
        const itemId = idMap.items.get(oid(it.item));
        if (!itemId) return null;
        return {
          itemId,
          itemCode: it.itemCode || '',
          itemName: it.itemName || '',
          quantity: it.quantity || 0,
          weight:   it.weight   || 0,
          price:    it.price    || 0,
          total:    it.total    || 0,
        };
      })
      .filter(Boolean);

    // حساب netAmount و remainingAmount من البيانات المتاحة
    const totalAmount    = inv.totalAmount    || 0;
    const discountAmount = inv.discountAmount || 0;
    const netAmount      = inv.netAmount      ?? (totalAmount - discountAmount);
    const paidAmount     = inv.paidAmount     || 0;
    const remainingAmount = inv.remainingAmount ?? (netAmount - paidAmount);

    const created = await prisma.saleInvoice.create({
      data: {
        invoiceNumber:   inv.invoiceNumber,
        docNumber:       String(inv.docNumber || ''),
        date:            toDate(inv.date),
        customerId,
        customerCode:    inv.customerCode || '',
        customerName:    inv.customerName || '',
        warehouse:       safeWarehouse(inv.warehouse),
        totalAmount,
        totalWeight:     inv.totalWeight    || 0,
        discountAmount,
        netAmount,
        paidAmount,
        remainingAmount,
        cashAmount:      inv.cashAmount     || 0,
        instapayAmount:  inv.instapayAmount || 0,
        transferAmount:  inv.transferAmount || 0,
        paymentMethod:   safePayMethod(inv.paymentMethod),
        status:          safeStatus(inv.status),
        allowNegative:   inv.allowNegativeSale === true || inv.allowNegative === true,
        seasonId,
        notes:           inv.notes || null,
        createdById,
        approvedById,
        approvedAt:      inv.approvedAt ? toDate(inv.approvedAt) : null,
        createdAt:       toDate(inv.createdAt),
        updatedAt:       toDate(inv.updatedAt),
        items: { create: invoiceItems },
      },
    });
    idMap.sales.set(oldId, created.id);
    salesOk++;
  }
  ok(salesOk, `sale invoices (من ${mongoSales.length})`);
  skip(salesSkip, 'sale invoices');
  if (salesErr > 0) warn(`${salesErr} فاتورة بيع تم تخطيها (FK مفقود)`);

  // ─── 7. Purchase Invoices ────────────────────────────────────────────────
  step('Purchase Invoices');
  const mongoPurchases = loadJSON('ceo.purchaseinvoices.json');
  let purchOk = 0, purchSkip = 0, purchErr = 0;

  for (const inv of mongoPurchases) {
    const oldId = oid(inv._id);
    const exists = await prisma.purchaseInvoice.findUnique({ where: { invoiceNumber: inv.invoiceNumber } });
    if (exists) { idMap.purchases.set(oldId, exists.id); purchSkip++; continue; }

    const supplierId   = idMap.suppliers.get(oid(inv.supplier));
    const seasonId     = idMap.seasons.get(oid(inv.season))    || null;
    const createdById  = idMap.users.get(oid(inv.createdBy))   || fallbackUserId;
    const approvedById = inv.approvedBy ? (idMap.users.get(oid(inv.approvedBy)) || fallbackUserId) : null;

    if (!supplierId)  { warn(`Purchase ${inv.invoiceNumber}: supplier مش موجود`); purchErr++; continue; }
    if (!createdById) { warn(`Purchase ${inv.invoiceNumber}: createdBy مش موجود ولا يوجد admin fallback`); purchErr++; continue; }

    const invoiceItems = (inv.items || [])
      .map(it => {
        const itemId = idMap.items.get(oid(it.item));
        if (!itemId) return null;
        return {
          itemId,
          itemCode: it.itemCode || '',
          itemName: it.itemName || '',
          quantity: it.quantity || 0,
          weight:   it.weight   || 0,
          price:    it.price    || 0,
          total:    it.total    || 0,
        };
      })
      .filter(Boolean);

    // حساب netAmount و remainingAmount من البيانات المتاحة
    const totalAmount     = inv.totalAmount    || 0;
    const discountAmount  = inv.discountAmount || 0;
    const netAmount       = inv.netAmount      ?? (totalAmount - discountAmount);
    const paidAmount      = inv.paidAmount     || 0;
    const remainingAmount = inv.remainingAmount ?? (netAmount - paidAmount);

    const created = await prisma.purchaseInvoice.create({
      data: {
        invoiceNumber:  inv.invoiceNumber,
        docNumber:      String(inv.docNumber || ''),
        date:           toDate(inv.date),
        supplierId,
        supplierCode:   inv.supplierCode || '',
        supplierName:   inv.supplierName || '',
        warehouse:      safeWarehouse(inv.warehouse),
        totalAmount,
        totalWeight:    inv.totalWeight  || 0,
        discountAmount,
        netAmount,
        paidAmount,
        remainingAmount,
        status:         safeStatus(inv.status),
        seasonId,
        notes:          inv.notes || null,
        createdById,
        approvedById,
        approvedAt:     inv.approvedAt ? toDate(inv.approvedAt) : null,
        createdAt:      toDate(inv.createdAt),
        updatedAt:      toDate(inv.updatedAt),
        items: { create: invoiceItems },
      },
    });
    idMap.purchases.set(oldId, created.id);
    purchOk++;
  }
  ok(purchOk, `purchase invoices (من ${mongoPurchases.length})`);
  skip(purchSkip, 'purchase invoices');
  if (purchErr > 0) warn(`${purchErr} فاتورة شراء تم تخطيها (FK مفقود)`);

  // ─── 8. Price Lists ──────────────────────────────────────────────────────
  step('Price Lists');
  const mongoPriceLists = loadJSON('ceo.pricelists.json');
  let plOk = 0, plSkip = 0;

  // ✅ CLEANUP: لو في سجلات ناقصة من run سابق فاشل — امسحها وابدأ من الأول
  // (بيحصل لو الـ migration وقفت في النص وضافت record واحد بس)
  const existingPlCount = await prisma.priceList.count();
  if (existingPlCount > 0 && existingPlCount < mongoPriceLists.length) {
    console.log(`    ⚠️   في ${existingPlCount} price list ناقصة — هنمسحها ونبدأ من الأول (المفروض ${mongoPriceLists.length})`);
    await prisma.priceListItemLink.deleteMany({});
    await prisma.priceList.deleteMany({});
    console.log(`    🗑️   اتمسحت — هنضيفهم تاني صح`);
  }

  for (const pl of mongoPriceLists) {
    const oldId = oid(pl._id);

    // ✅ الحقول الصح 1:1 من MongoDB schema → Prisma schema
    // priceListName  → priceListName   (String, required)
    // displayName    → displayName     (String, required)
    // priceListDescription → priceListDescription
    // origin, unit, notes, prices, defaultPrice, itemDisplayOrder, displayOrder, isActive
    const plName        = pl.priceListName || pl.name || oid(pl._id);
    const plDisplayName = pl.displayName   || plName;
    const plDesc        = pl.priceListDescription || pl.description || '';
    const plOrigin      = pl.origin        || '';
    const plUnit        = pl.unit          || '';
    const plNotes       = pl.notes         || '';
    const plPrices      = pl.prices        || [];
    const plDefaultPrice      = pl.defaultPrice      ?? 0;
    const plItemDisplayOrder  = pl.itemDisplayOrder  ?? 0;

    // ✅ البحث بـ priceListName + displayName معاً
    // (priceListName وحده مش unique — كل الأصناف في نفس الموسم بيشتركوا فيه)
    const exists = await prisma.priceList.findFirst({
      where: { priceListName: plName, displayName: plDisplayName },
    });

    if (exists) {
      idMap.pricelists.set(oldId, exists.id);
      plSkip++;

      // ✅ backfill: لو القائمة موجودة بس linkedItems فاضية نعبيها
      const itemsCount = await prisma.priceListItemLink.count({ where: { priceListId: exists.id } });
      if (itemsCount === 0 && (pl.linkedItems || []).length > 0) {
        const backfillItems = (pl.linkedItems || [])
          .map(li => {
            const itemId = idMap.items.get(oid(li.item));
            if (!itemId) return null;
            return {
              priceListId: exists.id,
              itemId,
              itemCode: li.itemCode || '',
              itemName: li.itemName || '',
            };
          })
          .filter(Boolean);
        if (backfillItems.length > 0) {
          await prisma.priceListItemLink.createMany({ data: backfillItems, skipDuplicates: true });
          console.log(`    🔄  backfill ${backfillItems.length} items → ${exists.priceListName} / ${exists.displayName}`);
        }
      }
      continue;
    }

    // ✅ بناء linkedItems للـ create — الـ relation اسمها linkedItems في schema
    const linkedItemsData = (pl.linkedItems || [])
      .map(li => {
        const itemId = idMap.items.get(oid(li.item));
        if (!itemId) return null;
        return {
          itemId,
          itemCode: li.itemCode || '',
          itemName: li.itemName || '',
        };
      })
      .filter(Boolean);

    const updatedById = pl.updatedBy ? (idMap.users.get(oid(pl.updatedBy)) || null) : null;

    // ✅ create بالحقول الصح 1:1 مع الـ Prisma schema
    const created = await prisma.priceList.create({
      data: {
        priceListName:        plName,
        priceListDescription: plDesc,
        displayName:          plDisplayName,
        origin:               plOrigin,
        unit:                 plUnit,
        notes:                plNotes,
        prices:               plPrices,
        defaultPrice:         plDefaultPrice,
        itemDisplayOrder:     plItemDisplayOrder,
        displayOrder:         pl.displayOrder  ?? 0,
        isActive:             pl.isActive !== false,
        updatedById:          updatedById || null,
        createdAt:            toDate(pl.createdAt),
        updatedAt:            toDate(pl.updatedAt),
        linkedItems: { create: linkedItemsData },   // ✅ اسم الـ relation الصح في schema
      },
    });
    idMap.pricelists.set(oldId, created.id);
    plOk++;
  }
  ok(plOk, `price lists (من ${mongoPriceLists.length})`);
  skip(plSkip, 'price lists');

  // ─── 9. Audit Logs ───────────────────────────────────────────────────────
  step('Audit Logs');
  const mongoAuditLogs = loadJSON('ceo.auditlogs.json');

  const existingCount = await prisma.auditLog.count();
  if (existingCount > 0) {
    console.log(`    ⏭️   Audit Logs موجودة بالفعل (${existingCount} سجل)`);
  } else {
    let auditOk = 0;
    const CHUNK = 50;
    for (let i = 0; i < mongoAuditLogs.length; i += CHUNK) {
      const chunk = mongoAuditLogs.slice(i, i + CHUNK);
      const data = chunk.map(log => {
        // ✅ FIX: details مش موجود في schema — نحوله لـ JSON string في resourceRef لو محتاجينه
        // resourceId في MongoDB هو ObjectId string مش UUID — نحطه في resourceRef
        const row = {
          userId:      idMap.users.get(oid(log.user)) || null,
          userName:    log.userName    || '',
          userRole:    log.userRole    || 'user',
          action:      log.action      || '',
          resource:    log.resource    || '',
          resourceRef: log.resourceRef || null,
          createdAt:   toDate(log.createdAt),
        };
        // resourceId: لو UUID حقيقي نحطه، لو ObjectId نتركه null
        const rid = oid(log.resourceId);
        const isUUID = rid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rid);
        row.resourceId = isUUID ? rid : null;
        return row;
      });
      await prisma.auditLog.createMany({ data, skipDuplicates: true });
      auditOk += chunk.length;
      process.stdout.write(`\r    ⏳  ${auditOk}/${mongoAuditLogs.length} audit logs...`);
    }
    console.log('');
    ok(auditOk, 'audit logs');
  }

  // ─── 10. Counters ────────────────────────────────────────────────────────
  step('Counters');
  // ✅ FIX: نتحقق إن الـ model موجود في schema قبل ما نحاول نكتب فيه
  if (prisma.globalCounter) {
    const mongoCounters = loadJSON('ceo.counters.json');
    for (const c of mongoCounters) {
      const name  = c.name  || String(c._id?.$oid || 'unknown');
      const value = c.seq   || c.value || 0;
      await prisma.globalCounter.upsert({
        where:  { name },
        update: { value },
        create: { name, value },
      });
    }
    ok(mongoCounters.length, 'counters');
  } else {
    warn('model GlobalCounter مش موجود في schema — تم تخطي الـ counters');
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                   ✅  Migration خلصت!                   ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Users         : ${String(idMap.users.size).padEnd(6)} في DB                         ║`);
  console.log(`║  Seasons       : ${String(idMap.seasons.size).padEnd(6)} في DB                         ║`);
  console.log(`║  Customers     : ${String(idMap.customers.size).padEnd(6)} في DB                         ║`);
  console.log(`║  Suppliers     : ${String(idMap.suppliers.size).padEnd(6)} في DB                         ║`);
  console.log(`║  Items         : ${String(idMap.items.size).padEnd(6)} في DB                         ║`);
  console.log(`║  Sale Invoices : ${String(idMap.sales.size).padEnd(6)} في DB                         ║`);
  console.log(`║  Purchases     : ${String(idMap.purchases.size).padEnd(6)} في DB                         ║`);
  console.log(`║  Price Lists   : ${String(idMap.pricelists.size).padEnd(6)} في DB                         ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  🕐 انتهى في: ${new Date().toLocaleString('ar-EG')}`);
}

// ── Run ──────────────────────────────────────────────────────────────────────
main()
  .catch(e => {
    console.error('\n❌ Migration فشلت!');
    console.error('   Error:', e.message);
    if (e.code) console.error('   Code: ', e.code);
    if (e.meta) console.error('   Meta: ', JSON.stringify(e.meta, null, 2));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());