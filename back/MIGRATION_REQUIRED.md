# ⚠️ Migration Required — تشغّله على السيرفر فوراً

## المشكلة
`SaleInvoiceItem` مش عندها حقل `totalWeight` في الـ DB
→ كل `POST /api/sales` كان بيرجع 500

## الحل السريع (بدون Prisma migrate)
شغّل الـ SQL ده مباشرة على الـ database:

```sql
ALTER TABLE sale_invoice_items
  ADD COLUMN IF NOT EXISTS "totalWeight" DECIMAL(12,3) NOT NULL DEFAULT 0;
```

## أو استخدم Prisma
```bash
cd back
npx prisma migrate dev --name add_totalWeight_to_sale_invoice_items
```

## indexes الجديدة (اختياري — للأداء مع 10M+ فاتورة)
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "sale_invoices_deletedAt_seasonId_createdAt_idx"
  ON sale_invoices ("deletedAt", "seasonId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "sale_invoices_invoiceNumber_idx"
  ON sale_invoices ("invoiceNumber");
```
> استخدم `CONCURRENTLY` عشان لا توقف الـ DB أثناء الإنشاء

## ✅ بعد التشغيل
- POST /api/sales ← يشتغل
- GET /api/sales ← cursor pagination بـ id (لا offset)
