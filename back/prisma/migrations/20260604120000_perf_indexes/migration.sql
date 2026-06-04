-- الـ indexes دي بتشغّل تلقائياً على أي DB جديدة
-- مش محتاج تشيلها من Neon بعد ما شغّلتها — IF NOT EXISTS بتتجاهلها لو موجودة

CREATE INDEX CONCURRENTLY IF NOT EXISTS "customers_isActive_deletedAt_code_idx"
  ON customers ("isActive", "deletedAt", code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "customers_code_idx"
  ON customers (code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "suppliers_isActive_deletedAt_code_idx"
  ON suppliers ("isActive", "deletedAt", code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "suppliers_code_idx"
  ON suppliers (code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "sale_invoices_customerId_deletedAt_seasonId_idx"
  ON sale_invoices ("customerId", "deletedAt", "seasonId")
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "return_invoices_customerId_type_status_seasonId_idx"
  ON return_invoices ("customerId", type, status, "seasonId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "return_invoices_supplierId_type_status_seasonId_idx"
  ON return_invoices ("supplierId", type, status, "seasonId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "payments_customerId_type_seasonId_idx_v2"
  ON payments ("customerId", type, "seasonId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "payments_supplierId_type_seasonId_idx_v2"
  ON payments ("supplierId", type, "seasonId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "customer_season_balances_customerId_seasonId_idx"
  ON customer_season_balances ("customerId", "seasonId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "stock_movements_itemId_wh_season_date_idx"
  ON stock_movements ("itemId", warehouse, "seasonId", date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "seasons_active_partial_idx"
  ON seasons ("isActive", "startDate" DESC)
  WHERE "isActive" = true AND "isClosed" = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "treasury_entries_treasury_date_type_idx"
  ON treasury_entries (treasury, date DESC, type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "manufacturing_orders_workerId_season_status_idx"
  ON manufacturing_orders ("workerId", "seasonId", status);
