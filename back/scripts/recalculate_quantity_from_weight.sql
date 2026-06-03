-- ─── ARCH-001: إعادة حساب quantity من weight ────────────────────────────────
-- يُشغَّل مرة واحدة بعد التحديث لمزامنة البيانات الموجودة
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. تحديث item_stocks: quantity = weight ÷ defaultWeight
UPDATE item_stocks AS s
SET
  quantity = CASE
    WHEN i."defaultWeight" > 0
    THEN ROUND(CAST(s.weight / i."defaultWeight" AS numeric), 10)
    ELSE s.quantity
  END,
  "updatedAt" = NOW()
FROM items AS i
WHERE s."itemId" = i.id
  AND i."defaultWeight" > 0;

-- 2. تصفير القيم الوهمية (أقل من 1e-6)
UPDATE item_stocks
SET
  weight   = CASE WHEN ABS(weight)   < 0.000001 THEN 0 ELSE weight   END,
  quantity = CASE WHEN ABS(quantity) < 0.000001 THEN 0 ELSE quantity END,
  "updatedAt" = NOW()
WHERE ABS(weight) < 0.000001 OR ABS(quantity) < 0.000001;

-- 3. تقرير الأصناف بعد التحديث
SELECT
  i.code             AS item_code,
  i.name             AS item_name,
  s.warehouse,
  s.weight           AS weight_kg,
  i."defaultWeight"  AS unit_weight,
  s.quantity         AS quantity_derived
FROM item_stocks s
JOIN items i ON s."itemId" = i.id
WHERE s.weight > 0
ORDER BY i.code, s.warehouse;
