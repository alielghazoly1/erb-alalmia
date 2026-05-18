-- Migration: Convert Float to Decimal for Item.minStockQty and StockAdjustmentLine qty fields
-- Generated: 2026-05-18
-- Database: PostgreSQL
-- Purpose: Convert Float fields to Decimal(12,3) for precision consistency

BEGIN;

-- ============================================
-- 1. Item.minStockQty: Float → Decimal(12,3)
-- ============================================
ALTER TABLE "items" 
  ALTER COLUMN "minStockQty" TYPE DECIMAL(12,3) 
  USING "minStockQty"::DECIMAL(12,3);

-- Update default constraint
ALTER TABLE "items" 
  ALTER COLUMN "minStockQty" SET DEFAULT 0;

-- ============================================
-- 2. StockAdjustmentLine: Float → Decimal(12,3)
-- ============================================

-- systemQty
ALTER TABLE "stock_adjustment_lines" 
  ALTER COLUMN "systemQty" TYPE DECIMAL(12,3) 
  USING "systemQty"::DECIMAL(12,3);

-- actualQty
ALTER TABLE "stock_adjustment_lines" 
  ALTER COLUMN "actualQty" TYPE DECIMAL(12,3) 
  USING "actualQty"::DECIMAL(12,3);

-- diffQty
ALTER TABLE "stock_adjustment_lines" 
  ALTER COLUMN "diffQty" TYPE DECIMAL(12,3) 
  USING "diffQty"::DECIMAL(12,3);

COMMIT;

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================

-- Check Item columns
-- SELECT column_name, data_type, numeric_precision, numeric_scale 
-- FROM information_schema.columns 
-- WHERE table_name = 'items' AND column_name = 'minStockQty';

-- Check StockAdjustmentLine columns
-- SELECT column_name, data_type, numeric_precision, numeric_scale 
-- FROM information_schema.columns 
-- WHERE table_name = 'stock_adjustment_lines' 
-- AND column_name IN ('systemQty', 'actualQty', 'diffQty');
