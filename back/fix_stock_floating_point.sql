-- ─────────────────────────────────────────────────────────────────────────────
-- migration: fix_stock_floating_point.sql
-- تنظيف بيانات المخزون الفاسدة بسبب Floating Point
--
-- المشكلة: عمليات سابقة تركت قيم مثل -0.001, -0.0001, 0.000001 في item_stocks
-- الحل:    أي قيمة مطلقها < 0.0005 تُعتبر صفراً وتُصفَّر
--
-- ⚠️ تشغيل هذا الملف مرة واحدة فقط — يفضل في وقت صيانة
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── خطوة 1: عرض الصفوف الفاسدة قبل التصليح ──────────────────────────────────
SELECT
    i.code        AS item_code,
    i.name        AS item_name,
    s.warehouse,
    s.quantity,
    s.weight,
    CASE WHEN ABS(s.quantity) < 0.0005 AND s.quantity <> 0 THEN 'qty_ghost' ELSE '' END AS qty_issue,
    CASE WHEN ABS(s.weight)   < 0.0005 AND s.weight   <> 0 THEN 'wt_ghost'  ELSE '' END AS wt_issue
FROM item_stocks s
JOIN items i ON i.id = s."itemId"
WHERE
    (ABS(s.quantity) < 0.0005 AND s.quantity <> 0)
 OR (ABS(s.weight)   < 0.0005 AND s.weight   <> 0);

-- ── خطوة 2: تصفير القيم الوهمية ─────────────────────────────────────────────
UPDATE item_stocks
SET
    quantity   = CASE WHEN ABS(quantity) < 0.0005 THEN 0::numeric ELSE ROUND(quantity, 3) END,
    weight     = CASE WHEN ABS(weight)   < 0.0005 THEN 0::numeric ELSE ROUND(weight,   3) END,
    "updatedAt" = NOW()
WHERE
    (ABS(quantity) < 0.0005 AND quantity <> 0)
 OR (ABS(weight)   < 0.0005 AND weight   <> 0)
 OR quantity <> ROUND(quantity, 3)
 OR weight   <> ROUND(weight, 3);

-- ── خطوة 3: ضمان عدم وجود قيم سالبة كبيرة (خطأ منطقي لا floating point) ──────
-- هذه الصفوف تحتاج مراجعة يدوية — نسجّلها فقط
SELECT
    i.code AS item_code, i.name AS item_name,
    s.warehouse, s.quantity, s.weight
FROM item_stocks s
JOIN items i ON i.id = s."itemId"
WHERE s.quantity < -0.001 OR s.weight < -0.001;

-- ── خطوة 4: تقريب كل القيم لـ 3 خانات عشرية ─────────────────────────────────
UPDATE item_stocks
SET
    quantity   = ROUND(quantity, 3),
    weight     = ROUND(weight,   3),
    "updatedAt" = NOW()
WHERE
    quantity <> ROUND(quantity, 3)
 OR weight   <> ROUND(weight,   3);

COMMIT;

-- ── التحقق النهائي ────────────────────────────────────────────────────────────
SELECT
    COUNT(*) FILTER (WHERE quantity < 0) AS negative_qty_rows,
    COUNT(*) FILTER (WHERE weight   < 0) AS negative_wt_rows,
    COUNT(*) FILTER (WHERE ABS(quantity) < 0.0005 AND quantity <> 0) AS ghost_qty_rows,
    COUNT(*) FILTER (WHERE ABS(weight)   < 0.0005 AND weight   <> 0) AS ghost_wt_rows,
    COUNT(*) AS total_rows
FROM item_stocks;
