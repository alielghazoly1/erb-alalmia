-- ─── Migration: Customer & Supplier Season Balances ──────────────────────────
-- رصيد أول المدة per-season — بدل الـ openingBalance الثابت على العميل/المورد
-- Run ONCE on PostgreSQL

BEGIN;

CREATE TABLE IF NOT EXISTS "customer_season_balances" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "customerId"     UUID         NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "seasonId"       UUID         NOT NULL REFERENCES "seasons"("id"),
  "openingBalance" NUMERIC(15,2) NOT NULL DEFAULT 0,
  "updatedById"    UUID,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  UNIQUE("customerId", "seasonId")
);

CREATE INDEX IF NOT EXISTS "csb_customer_idx" ON "customer_season_balances"("customerId");
CREATE INDEX IF NOT EXISTS "csb_season_idx"   ON "customer_season_balances"("seasonId");

CREATE TABLE IF NOT EXISTS "supplier_season_balances" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "supplierId"     UUID         NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "seasonId"       UUID         NOT NULL REFERENCES "seasons"("id"),
  "openingBalance" NUMERIC(15,2) NOT NULL DEFAULT 0,
  "updatedById"    UUID,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  UNIQUE("supplierId", "seasonId")
);

CREATE INDEX IF NOT EXISTS "ssb_supplier_idx" ON "supplier_season_balances"("supplierId");
CREATE INDEX IF NOT EXISTS "ssb_season_idx"   ON "supplier_season_balances"("seasonId");

COMMIT;
