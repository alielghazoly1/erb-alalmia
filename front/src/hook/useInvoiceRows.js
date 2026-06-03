// ─── hooks/useInvoiceRows.js ──────────────────────────────────────────────────
// ✅ ARCH-001: الوزن هو مصدر الحقيقة الوحيد
//
// القاعدة الموحّدة لكل الفواتير:
//   • unitWeight  = وزن الوحدة الافتراضي من الصنف (يُعرض ويُعدَّل)
//   • totalWeight = unitWeight × quantity  أو مُدخَل يدوياً (المصدر الحقيقي)
//   • quantity    = totalWeight ÷ unitWeight (مشتق للعرض — لا يُصدَّق في الباك)
//   • الـ payload يُرسَل: { totalWeight, weight(unitWeight), price }
//   • quantity في الـ payload = totalWeight ÷ unitWeight (للتقارير فقط)
//
// ✅ FIX-001: rowsRef + twInputRef — نهاية مشكلة stale closure في handleKeyDown
//   handleSaveRow تقرأ من الـ ref دايماً عشان تشوف أحدث state
//   handleKeyDown تستدعي handleSaveRow عبر saveRowRef عشان مفيش dependency loop
//
// ترتيب الحقول الموحد في كل الفورمات:
//   صنف → عدد → وزن/وحدة (readonly) → وزن كلي → [سعر] → أضف
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

// ── مصنع صف جديد ──────────────────────────────────────────────────────────────
export const newRow = () => ({
  id: Date.now() + Math.random(),
  item:          null,
  itemCode:      '',
  itemName:      '',
  unit:          '',
  unitWeight:    0,
  quantity:      '',
  _totalWeight:  null,
  price:         '',
  availableQty:      undefined,
  availableWeight:   undefined,
  saved:   false,
  editing: false,
});

// ── حسابات آمنة ────────────────────────────────────────────────────────────────
const r2  = (v) => Math.round((parseFloat(v) || 0) * 100)    / 100;
const r3  = (v) => Math.round((parseFloat(v) || 0) * 1000)   / 1000;
const r4  = (v) => Math.round((parseFloat(v) || 0) * 10000)  / 10000;

// ── getTotalWeight ──────────────────────────────────────────────────────────────
export const getTotalWeight = (row, twOverride = null) => {
  const tw = twOverride !== null ? parseFloat(twOverride) : parseFloat(row._totalWeight);
  if (!isNaN(tw) && tw > 0) return r3(tw);
  const qty = parseFloat(row.quantity)   || 0;
  const uw  = parseFloat(row.unitWeight) || 0;
  return r3(qty * uw);
};

// ── derivedQuantity ─────────────────────────────────────────────────────────────
export const derivedQuantity = (totalWeight, unitWeight) => {
  const tw = parseFloat(totalWeight) || 0;
  const uw = parseFloat(unitWeight)  || 0;
  if (!uw || !tw) return 0;
  return tw / uw;
};

// ── formatDisplay ───────────────────────────────────────────────────────────────
export const formatDisplay = (v, maxDec = 4) => {
  const n = parseFloat(v);
  if (isNaN(n) || Math.abs(n) < 1e-10) return '0';
  return parseFloat(n.toFixed(maxDec)).toString();
};

// ── hook رئيسي ────────────────────────────────────────────────────────────────
export function useInvoiceRows({ warehouse = 'ramses', showPrice = true, checkStock = false } = {}) {
  const [rows,             setRows]             = useState([newRow()]);
  const [totalWeightInput, setTotalWeightInput] = useState({});

  // ✅ FIX-001: refs دايمًا بتشيل أحدث نسخة — تحل stale closure في handleKeyDown
  const rowsRef    = useRef(rows);
  const twInputRef = useRef(totalWeightInput);
  const setRowsSafe = useCallback((updater) => {
    setRows(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      rowsRef.current = next;
      return next;
    });
  }, []);
  const setTWInputSafe = useCallback((updater) => {
    setTotalWeightInput(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      twInputRef.current = next;
      return next;
    });
  }, []);

  const qtyRefs  = useRef({});
  const wtRefs   = useRef({});
  const prRefs   = useRef({});
  const twRefs   = useRef({});
  const itemRefs = useRef({});

  // ✅ FIX-001: saveRowRef — يخلي handleKeyDown يستدعي handleSaveRow بدون stale closure
  const saveRowRef = useRef(null);

  const savedRows = rows.filter(r => r.saved);

  // ── computed totals ─────────────────────────────────────────────────────────
  const totalWeightAll = r3(
    savedRows.reduce((s, r) => s + getTotalWeight(r), 0)
  );
  const totalAmount = r2(
    savedRows.reduce((s, r) => {
      const tw = getTotalWeight(r);
      const pr = parseFloat(r.price) || 0;
      return s + r2(tw * pr);
    }, 0)
  );

  // ── handleItemSelect ─────────────────────────────────────────────────────────
  const handleItemSelect = useCallback(async (rowId, item) => {
    if (!item) return;
    const stockQty   = item.stock?.[warehouse]?.quantity ?? undefined;
    const stockWt    = item.stock?.[warehouse]?.weight   ?? undefined;
    const unitWeight = parseFloat(item.defaultWeight) || 0;

    let defaultPrice = '';
    try {
      const { data } = await api.get(`/price-list/item/${item._id}`);
      if (data?.defaultPrice) defaultPrice = String(data.defaultPrice);
    } catch {}

    setRowsSafe(prev => prev.map(r =>
      r.id === rowId ? {
        ...r,
        item:       item._id,
        itemCode:   item.code,
        itemName:   item.name,
        unit:       item.unit || '',
        unitWeight,
        price:           defaultPrice || r.price,
        availableQty:    stockQty,
        availableWeight: stockWt,
      } : r
    ));
    // ✅ بعد اختيار الصنف — انتقل للعدد مباشرة
    setTimeout(() => qtyRefs.current[rowId]?.focus(), 50);
  }, [warehouse, setRowsSafe]);

  // ── handleQuantityChange ─────────────────────────────────────────────────────
  const handleQuantityChange = useCallback((rowId, qtyStr) => {
    setRowsSafe(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const qty = parseFloat(qtyStr) || 0;
      const uw  = parseFloat(r.unitWeight) || 0;
      if (qty > 0 && uw > 0) {
        const newTW = r3(qty * uw);
        setTWInputSafe(p => ({ ...p, [rowId]: String(newTW) }));
        return { ...r, quantity: qtyStr, _totalWeight: newTW };
      }
      setTWInputSafe(p => ({ ...p, [rowId]: '' }));
      return { ...r, quantity: qtyStr, _totalWeight: null };
    }));
  }, [setRowsSafe, setTWInputSafe]);

  // ── handleUnitWeightChange ───────────────────────────────────────────────────
  const handleUnitWeightChange = useCallback((rowId, uwStr) => {
    setRowsSafe(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const uw      = parseFloat(uwStr) || 0;
      const twInput = parseFloat(twInputRef.current[rowId]);

      if (!isNaN(twInput) && twInput > 0 && uw > 0) {
        const derivedQty = r4(twInput / uw);
        return { ...r, unitWeight: uw, quantity: String(derivedQty) };
      }
      const qty = parseFloat(r.quantity) || 0;
      if (qty > 0 && uw > 0) {
        const newTW = r3(qty * uw);
        setTWInputSafe(p => ({ ...p, [rowId]: String(newTW) }));
        return { ...r, unitWeight: uw, _totalWeight: newTW };
      }
      return { ...r, unitWeight: uw };
    }));
  }, [setRowsSafe, setTWInputSafe]);

  // ── handleTotalWeightChange ──────────────────────────────────────────────────
  const handleTotalWeightChange = useCallback((rowId, totalWt) => {
    setTWInputSafe(prev => ({ ...prev, [rowId]: totalWt }));
    const tw = parseFloat(totalWt) || 0;
    setRowsSafe(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const uw  = parseFloat(r.unitWeight) || 0;
      const dQty = uw > 0 && tw > 0 ? r4(tw / uw) : 0;
      return {
        ...r,
        _totalWeight: tw > 0 ? tw : null,
        quantity:     dQty > 0 ? String(dQty) : '',
      };
    }));
  }, [setRowsSafe, setTWInputSafe]);

  // legacy alias
  const updateRow = useCallback((rowId, field, value) => {
    if (field === 'quantity')   return handleQuantityChange(rowId, value);
    if (field === 'unitWeight') return handleUnitWeightChange(rowId, value);
    setRowsSafe(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  }, [handleQuantityChange, handleUnitWeightChange, setRowsSafe]);

  // ── handleSaveRow ────────────────────────────────────────────────────────────
  // ✅ FIX-001: يقرأ من rowsRef و twInputRef — مفيش stale closure
  const handleSaveRow = useCallback((rowId) => {
    const currentRows    = rowsRef.current;
    const currentTWInput = twInputRef.current;

    const row = currentRows.find(r => r.id === rowId);
    if (!row?.item)      { toast.error('اختار الصنف أولاً');         return; }
    if (!row.unitWeight) { toast.error('أدخل وزن/وحدة');              return; }

    const tw = getTotalWeight(row, currentTWInput[rowId] || null);
    if (tw <= 0)         { toast.error('أدخل الوزن الكلي أو العدد'); return; }
    if (showPrice && !row.price) { toast.error('أدخل السعر');         return; }

    if (checkStock && row.availableWeight !== undefined) {
      const availWt = parseFloat(row.availableWeight) || 0;
      if (availWt < tw) {
        toast.error(
          `المخزون مش كافي — متاح: ${availWt.toFixed(3)} ك — مطلوب: ${tw.toFixed(3)} ك`
        );
        return;
      }
    }

    const duplicate = currentRows.find(r => r.id !== rowId && r.saved && r.item === row.item);
    if (duplicate) { toast.error(`الصنف "${row.itemName}" موجود بالفعل`); return; }

    if (row.editing) {
      setRowsSafe(prev => prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r));
      setTimeout(() => {
        const unsavedId = Object.keys(itemRefs.current).find(id => Number(id) !== rowId);
        if (unsavedId && itemRefs.current[unsavedId]) itemRefs.current[unsavedId]();
      }, 80);
    } else {
      const newR = newRow();
      setRowsSafe(prev => [
        ...prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r),
        newR,
      ]);
      setTWInputSafe(prev => { const n = { ...prev }; delete n[rowId]; return n; });
      // ✅ فوكاس على حقل الصنف في الصف الجديد
      setTimeout(() => { if (itemRefs.current[newR.id]) itemRefs.current[newR.id](); }, 80);
    }
  }, [showPrice, checkStock, setRowsSafe, setTWInputSafe]); // rowsRef/twInputRef دايمًا محدّثين

  // ✅ FIX-001: saveRowRef يحفظ أحدث نسخة من handleSaveRow
  saveRowRef.current = handleSaveRow;

  // ── handleKeyDown ────────────────────────────────────────────────────────────
  // ✅ FIX-001: يستخدم saveRowRef — مفيش stale closure
  // ✅ ترتيب: صنف → عدد → وزن كلي → [سعر] → أضف
  const handleKeyDown = useCallback((e, rowId, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (field === 'quantity')    { twRefs.current[rowId]?.focus();  return; }
    if (field === 'unitWeight')  { twRefs.current[rowId]?.focus();  return; }
    if (field === 'totalWeight') {
      if (showPrice) { prRefs.current[rowId]?.focus(); return; }
      saveRowRef.current(rowId);
      return;
    }
    if (field === 'price') { saveRowRef.current(rowId); return; }
  }, [showPrice]);

  const handleEditRow = useCallback((rowId) => {
    setRowsSafe(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const tw = getTotalWeight(r);
      if (tw > 0) {
        setTWInputSafe(p => ({ ...p, [rowId]: String(tw) }));
      }
      return { ...r, saved: false, editing: true };
    }));
  }, [setRowsSafe, setTWInputSafe]);

  const handleCancelRow = useCallback((rowId) =>
    setRowsSafe(prev => prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r))
  , [setRowsSafe]);

  const handleDeleteRow = useCallback((rowId) =>
    setRowsSafe(prev => {
      const f = prev.filter(r => r.id !== rowId);
      return f.length === 0 ? [newRow()] : f;
    })
  , [setRowsSafe]);

  // ── toPayload ────────────────────────────────────────────────────────────────
  const toPayload = useCallback(() =>
    rowsRef.current.filter(r => r.saved).map(r => {
      const tw  = getTotalWeight(r);
      const uw  = parseFloat(r.unitWeight) || 0;
      const pr  = parseFloat(r.price)      || 0;
      const qty = uw > 0 ? tw / uw : 0;
      return {
        item:        r.item,
        itemCode:    r.itemCode,
        itemName:    r.itemName,
        weight:      uw,
        totalWeight: tw,
        quantity:    qty,
        price:       pr,
        total:       r2(tw * pr),
      };
    })
  , []);

  // ── loadRows (edit mode) ─────────────────────────────────────────────────────
  const loadRows = useCallback((items) => {
    const loaded = items.map(item => {
      const uw = parseFloat(item.weight) || 0;
      const tw = item.totalWeight != null
        ? parseFloat(item.totalWeight)
        : r3((parseFloat(item.quantity) || 0) * uw);
      const qty = uw > 0 && tw > 0 ? r4(tw / uw) : (parseFloat(item.quantity) || 0);
      return {
        id:          Date.now() + Math.random(),
        item:        item.itemId || item.item?._id || item.item,
        itemCode:    item.itemCode,
        itemName:    item.itemName,
        unit:        item.unit || '',
        unitWeight:  uw,
        quantity:    String(qty),
        _totalWeight: tw,
        price:       String(item.price || ''),
        availableQty:    undefined,
        availableWeight: undefined,
        saved:   true,
        editing: false,
      };
    });
    const twMap = {};
    loaded.forEach(r => {
      if (r._totalWeight) twMap[r.id] = String(r._totalWeight);
    });
    const withNew = [...loaded, newRow()];
    rowsRef.current = withNew;
    twInputRef.current = twMap;
    setRows(withNew);
    setTotalWeightInput(twMap);
  }, []);

  const resetRows = useCallback(() => {
    const initial = [newRow()];
    rowsRef.current    = initial;
    twInputRef.current = {};
    setRows(initial);
    setTotalWeightInput({});
  }, []);

  return {
    rows, setRows: setRowsSafe, savedRows, activeRow: rows.find(r => !r.saved),
    totalWeightInput, setTotalWeightInput: setTWInputSafe,
    totalWeightAll, totalAmount,
    qtyRefs, wtRefs, prRefs, twRefs, itemRefs,
    handleItemSelect,
    updateRow,
    handleQuantityChange,
    handleUnitWeightChange,
    handleTotalWeightChange,
    handleKeyDown,
    handleSaveRow,
    handleEditRow,
    handleCancelRow,
    handleDeleteRow,
    toPayload,
    loadRows,
    resetRows,
  };
}
