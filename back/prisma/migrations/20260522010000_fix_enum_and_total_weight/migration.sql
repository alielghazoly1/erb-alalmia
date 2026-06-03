-- ─── Migration: fix_enum_and_total_weight ────────────────────────────────────
-- 1. إضافة `mixed` لـ RefundMethod enum (لو مش موجود)
-- 2. إضافة totalWeight لـ return_invoice_items و purchase_invoice_items
-- كل العمليات آمنة (IF NOT EXISTS / DO NOTHING) — لا تمس البيانات الموجودة
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. إضافة variant `mixed` للـ enum لو مش موجود
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public."RefundMethod"'::regtype
      AND enumlabel = 'mixed'
  ) THEN
    ALTER TYPE "public"."RefundMethod" ADD VALUE 'mixed';
  END IF;
END$$;

-- 2. إضافة totalWeight لـ return_invoice_items
ALTER TABLE "return_invoice_items"
  ADD COLUMN IF NOT EXISTS "totalWeight" DECIMAL(12,3) NULL;

-- ملء البيانات القديمة
UPDATE "return_invoice_items"
  SET "totalWeight" = ROUND(CAST(quantity * weight AS numeric), 3)
  WHERE "totalWeight" IS NULL;

-- 3. إضافة totalWeight لـ purchase_invoice_items
ALTER TABLE "purchase_invoice_items"
  ADD COLUMN IF NOT EXISTS "totalWeight" DECIMAL(12,3) NULL;

-- ملء البيانات القديمة
UPDATE "purchase_invoice_items"
  SET "totalWeight" = ROUND(CAST(quantity * weight AS numeric), 3)
  WHERE "totalWeight" IS NULL;
