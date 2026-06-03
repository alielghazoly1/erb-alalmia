const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, 'mongo_data');

const oid = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v.$oid) return v.$oid;
  return String(v);
};

const toDate = (v) => {
  if (!v) return new Date();
  if (v.$date) return new Date(v.$date);
  return new Date(v);
};

async function main() {
  // جيب الـ admin كـ fallback
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) { console.error('مفيش admin في الـ DB!'); return; }
  console.log('Admin:', admin.username, admin.id);

  // ابني idMap من الـ DB الموجود
  const dbUsers     = await prisma.user.findMany({ select: { id: true } });
  const dbCustomers = await prisma.customer.findMany({ select: { id: true, code: true } });
  const dbSuppliers = await prisma.supplier.findMany({ select: { id: true, code: true } });
  const dbItems     = await prisma.item.findMany({ select: { id: true, code: true } });
  const dbSeasons   = await prisma.season.findMany({ select: { id: true, name: true } });

  // بنقرأ الـ mongo JSON عشان نعرف الـ old IDs
  const mongoUsers     = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ceo.users.json'), 'utf8'));
  const mongoItems     = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ceo.items.json'), 'utf8'));
  const mongoCustomers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ceo.customers.json'), 'utf8'));
  const mongoSuppliers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ceo.suppliers.json'), 'utf8'));
  const mongoSeasons   = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ceo.seasons.json'), 'utf8'));

  // بنعمل map من mongo _id → postgres id عن طريق الـ code/username
  const userMap     = new Map();
  const itemMap     = new Map();
  const customerMap = new Map();
  const supplierMap = new Map();
  const seasonMap   = new Map();

  for (const mu of mongoUsers) {
    const found = dbUsers.find(() => true); // fallback to admin
    const match = await prisma.user.findUnique({ where: { username: mu.username } });
    if (match) userMap.set(oid(mu._id), match.id);
  }

  for (const mi of mongoItems) {
    const match = dbItems.find(i => i.code === mi.code);
    if (match) itemMap.set(oid(mi._id), match.id);
  }

  for (const mc of mongoCustomers) {
    const match = dbCustomers.find(c => c.code === mc.code);
    if (match) customerMap.set(oid(mc._id), match.id);
  }

  for (const ms of mongoSuppliers) {
    const match = dbSuppliers.find(s => s.code === ms.code);
    if (match) supplierMap.set(oid(ms._id), match.id);
  }

  for (const ms of mongoSeasons) {
    const match = dbSeasons.find(s => s.name === ms.name);
    if (match) seasonMap.set(oid(ms._id), match.id);
  }

  // ── Sale Invoices الناقصة ────────────────────────────────────
  const mongoSales = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ceo.saleinvoices.json'), 'utf8'));
  const existingSales = await prisma.saleInvoice.findMany({ select: { invoiceNumber: true } });
  const existingSaleNums = new Set(existingSales.map(s => s.invoiceNumber));

  const validPaymentMethods = ['cash','credit','instapay','transfer','check','mixed'];
  const validStatuses   = ['pending','approved','suspended','cancelled','returned'];
  const validWarehouses = ['ramses','october'];

  let salesOk = 0, salesSkip = 0;
  for (const inv of mongoSales) {
    if (existingSaleNums.has(inv.invoiceNumber)) continue; // موجودة بالفعل

    const customerId  = customerMap.get(oid(inv.customer));
    const seasonId    = seasonMap.get(oid(inv.season));
    const createdById = userMap.get(oid(inv.createdBy)) || admin.id;
    const approvedById = inv.approvedBy ? (userMap.get(oid(inv.approvedBy)) || null) : null;

    if (!customerId) { console.warn('Sale skip - no customer:', inv.invoiceNumber); salesSkip++; continue; }

    const paymentMethod = validPaymentMethods.includes(inv.paymentMethod) ? inv.paymentMethod : 'credit';
    const status    = validStatuses.includes(inv.status)     ? inv.status    : 'pending';
    const warehouse = validWarehouses.includes(inv.warehouse) ? inv.warehouse : 'ramses';

    try {
      await prisma.saleInvoice.create({
        data: {
          invoiceNumber:    inv.invoiceNumber,
          docNumber:        String(inv.docNumber || ''),
          date:             toDate(inv.date),
          customerId,
          customerCode:     inv.customerCode || '',
          customerName:     inv.customerName || '',
          warehouse,
          totalAmount:      inv.totalAmount || 0,
          totalWeight:      inv.totalWeight || 0,
          paidAmount:       inv.paidAmount  || 0,
          cashAmount:       inv.cashAmount  || 0,
          instapayAmount:   inv.instapayAmount || 0,
          paymentMethod,
          status,
          allowNegativeSale: inv.allowNegativeSale === true,
          seasonId:         seasonId || null,
          notes:            inv.notes || null,
          createdById,
          approvedById:     approvedById || null,
          approvedAt:       inv.approvedAt ? toDate(inv.approvedAt) : null,
          createdAt:        toDate(inv.createdAt),
          updatedAt:        toDate(inv.updatedAt),
          items: {
            create: (inv.items || []).map(it => {
              const itemId = itemMap.get(oid(it.item));
              return { itemId, itemCode: it.itemCode || '', itemName: it.itemName || '', quantity: it.quantity || 0, weight: it.weight || 0, price: it.price || 0, total: it.total || 0 };
            }).filter(it => it.itemId),
          },
        },
      });
      salesOk++;
    } catch(e) { console.warn('Sale error:', inv.invoiceNumber, e.message); salesSkip++; }
  }
  console.log(`Sales: اتضافت ${salesOk} - تخطي ${salesSkip}`);

  // ── Purchase Invoices الناقصة ─────────────────────────────────
  const mongoPurchases = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ceo.purchaseinvoices.json'), 'utf8'));
  const existingPurch  = await prisma.purchaseInvoice.findMany({ select: { invoiceNumber: true } });
  const existingPurchNums = new Set(existingPurch.map(p => p.invoiceNumber));

  let purchOk = 0, purchSkip = 0;
  for (const inv of mongoPurchases) {
    if (existingPurchNums.has(inv.invoiceNumber)) continue;

    const supplierId  = supplierMap.get(oid(inv.supplier));
    const seasonId    = seasonMap.get(oid(inv.season));
    const createdById = userMap.get(oid(inv.createdBy)) || admin.id;
    const approvedById = inv.approvedBy ? (userMap.get(oid(inv.approvedBy)) || null) : null;

    if (!supplierId) { console.warn('Purchase skip - no supplier:', inv.invoiceNumber); purchSkip++; continue; }

    const status    = validStatuses.includes(inv.status)     ? inv.status    : 'pending';
    const warehouse = validWarehouses.includes(inv.warehouse) ? inv.warehouse : 'ramses';

    try {
      await prisma.purchaseInvoice.create({
        data: {
          invoiceNumber: inv.invoiceNumber,
          docNumber:     String(inv.docNumber || ''),
          date:          toDate(inv.date),
          supplierId,
          supplierCode:  inv.supplierCode || '',
          supplierName:  inv.supplierName || '',
          warehouse,
          totalAmount:   inv.totalAmount || 0,
          totalWeight:   inv.totalWeight || 0,
          status,
          seasonId:      seasonId || null,
          notes:         inv.notes || null,
          createdById,
          approvedById:  approvedById || null,
          approvedAt:    inv.approvedAt ? toDate(inv.approvedAt) : null,
          createdAt:     toDate(inv.createdAt),
          updatedAt:     toDate(inv.updatedAt),
          items: {
            create: (inv.items || []).map(it => {
              const itemId = itemMap.get(oid(it.item));
              return { itemId, itemCode: it.itemCode || '', itemName: it.itemName || '', quantity: it.quantity || 0, weight: it.weight || 0, price: it.price || 0, total: it.total || 0 };
            }).filter(it => it.itemId),
          },
        },
      });
      purchOk++;
    } catch(e) { console.warn('Purchase error:', inv.invoiceNumber, e.message); purchSkip++; }
  }
  console.log(`Purchases: اتضافت ${purchOk} - تخطي ${purchSkip}`);

  console.log('\nخلصت! كل حاجة اتضافت.');
}

main()
  .catch(e => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());