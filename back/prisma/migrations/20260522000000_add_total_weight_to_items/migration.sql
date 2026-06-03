-- ── إضافة totalWeight لجدولي return_invoice_items و purchase_invoice_items ──────
-- column عادي (nullable) — القيمة تُكتب صراحةً من الـ controller
-- للبيانات القديمة: القيمة NULL → fallback على qty × weight في الكود

ALTER TABLE "return_invoice_items"
  ADD COLUMN IF NOT EXISTS "totalWeight" DECIMAL(12,3) NULL;

ALTER TABLE "purchase_invoice_items"
  ADD COLUMN IF NOT EXISTS "totalWeight" DECIMAL(12,3) NULL;

-- تحديث البيانات القديمة (qty × weight)
UPDATE "return_invoice_items"
  SET "totalWeight" = ROUND(CAST(quantity * weight AS numeric), 3)
  WHERE "totalWeight" IS NULL;

UPDATE "purchase_invoice_items"
  SET "totalWeight" = ROUND(CAST(quantity * weight AS numeric), 3)
  WHERE "totalWeight" IS NULL;
