// ─── useManufacturingItems.js ─────────────────────────────────────────────────
// ✅ ARCH-001: الوزن هو مصدر الحقيقة الوحيد
//
// موحَّد مع useInvoiceRows — نفس المنطق تماماً:
//   • unitWeight  = وزن الوحدة الافتراضي من الصنف
//   • totalWeight = المصدر الحقيقي
//   • quantity    = totalWeight ÷ unitWeight (مشتق — للتقارير فقط)
//   • الـ payload يُرسَل: { totalWeight, weight(unitWeight), quantity(مشتق) }
//
// ✅ FIX-001: rowsRef + twInputRef — نهاية مشكلة stale closure
//   handleSaveRow تقرأ من الـ ref دايمًا فبتشوف أحدث state
//   handleKeyDown تستدعي handleSaveRow عبر saveRowRef بدون dependency loop
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

// ── factory ────────────────────────────────────────────────────────────────────
export const newRow = () => ({
  id: Date.now() + Math.random(),
  item: null, itemCode: '', itemName: '', unit: '',
  unitWeight: 0,
  quantity:   '',
  _totalWeight: null,
  availableQty:    undefined,
  availableWeight: undefined,
  saved: false, editing: false,
});

// ── helpers ────────────────────────────────────────────────────────────────────
const r3 = (v) => Math.round((parseFloat(v) || 0) * 1000)  / 1000;
const r4 = (v) => Math.round((parseFloat(v) || 0) * 10000) / 10000;

// ✅ ARCH-001: calcTotalWeight — المصدر الحقيقي
export const calcTotalWeight = (row, twInputVal = null) => {
  const twInput = parseFloat(twInputVal);
  if (!isNaN(twInput) && twInput > 0) return r3(twInput);
  const stored = parseFloat(row._totalWeight);
  if (!isNaN(stored) && stored > 0) return r3(stored);
  const qty = parseFloat(row.quantity)   || 0;
  const uw  = parseFloat(row.unitWeight) || 0;
  return r3(qty * uw);
};

export const fmtW = (n, d = 3) => {
  const val = parseFloat(n || 0);
  if (d === 3) return val.toFixed(3);
  return parseFloat(val.toFixed(d)).toString();
};

// ── hook ───────────────────────────────────────────────────────────────────────
export function useManufacturingItems({ warehouse, checkStock = false } = {}) {
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

  const itemRefs = useRef({});
  const qtyRefs  = useRef({});
  const wtRefs   = useRef({});
  const twRefs   = useRef({});

  // ✅ FIX-001: saveRowRef — يخلي handleKeyDown يستدعي handleSaveRow بدون stale closure
  const saveRowRef = useRef(null);

  const savedRows      = rows.filter(r => r.saved);
  const activeRow      = rows.find(r => !r.saved);
  const totalWeightAll = r3(savedRows.reduce((s, r) => s + calcTotalWeight(r), 0));

  // ── handleItemSelect ─────────────────────────────────────────────────────────
  const handleItemSelect = useCallback((rowId, item) => {
    if (!item) return;
    const stockQty   = item.stock?.[warehouse]?.quantity ?? undefined;
    const stockWt    = item.stock?.[warehouse]?.weight   ?? undefined;
    const unitWeight = parseFloat(item.defaultWeight) || 0;
    setRowsSafe(prev => prev.map(r => r.id === rowId ? {
      ...r,
      item: item._id, itemCode: item.code, itemName: item.name, unit: item.unit || '',
      unitWeight,
      availableQty: stockQty, availableWeight: stockWt,
    } : r));
    // ✅ بعد اختيار الصنف — انتقل للعدد مباشرة
    setTimeout(() => qtyRefs.current[rowId]?.focus(), 50);
  }, [warehouse, setRowsSafe]);

  // ── updateRow (legacy) ───────────────────────────────────────────────────────
  const updateRow = useCallback((rowId, field, value) =>
    setRowsSafe(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
  , [setRowsSafe]);

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
      const uw  = parseFloat(uwStr) || 0;
      const tw  = parseFloat(twInputRef.current[rowId]);
      if (!isNaN(tw) && tw > 0 && uw > 0) {
        return { ...r, unitWeight: uw, quantity: String(r4(tw / uw)) };
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
      const qty = uw > 0 && tw > 0 ? r4(tw / uw) : 0;
      return {
        ...r,
        _totalWeight: tw > 0 ? tw : null,
        quantity:     qty > 0 ? String(qty) : '',
      };
    }));
  }, [setRowsSafe, setTWInputSafe]);

  // ── handleSaveRow ────────────────────────────────────────────────────────────
  // ✅ FIX-001: يقرأ من rowsRef و twInputRef — مفيش stale closure
  const handleSaveRow = useCallback((rowId) => {
    const currentRows    = rowsRef.current;
    const currentTWInput = twInputRef.current;

    const row = currentRows.find(r => r.id === rowId);
    if (!row?.item)      return toast.error('اختار الصنف أولاً');
    if (!row.unitWeight) return toast.error('أدخل وزن/وحدة');

    const tw = calcTotalWeight(row, currentTWInput[rowId] || null);
    if (tw <= 0) return toast.error('أدخل الوزن الكلي أو العدد');

    if (checkStock && row.availableWeight !== undefined) {
      const awt = parseFloat(row.availableWeight) || 0;
      if (awt < tw) return toast.error(
        `المخزون مش كافي — متاح: ${awt.toFixed(3)} ك — مطلوب: ${tw.toFixed(3)} ك`
      );
    }

    if (currentRows.find(r => r.id !== rowId && r.saved && r.item === row.item))
      return toast.error(`"${row.itemName}" موجود بالفعل — عدّله`);

    if (row.editing) {
      setRowsSafe(prev => prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r));
      setTimeout(() => {
        const unsavedId = Object.keys(itemRefs.current).find(id => Number(id) !== rowId);
        if (unsavedId && itemRefs.current[unsavedId]) itemRefs.current[unsavedId]();
      }, 80);
    } else {
      const next = newRow();
      setRowsSafe(prev => [
        ...prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r),
        next,
      ]);
      setTWInputSafe(prev => { const n = { ...prev }; delete n[rowId]; return n; });
      // ✅ فوكاس على حقل الصنف في الصف الجديد
      setTimeout(() => { if (itemRefs.current[next.id]) itemRefs.current[next.id](); }, 80);
    }
  }, [checkStock, setRowsSafe, setTWInputSafe]);

  // ✅ FIX-001: saveRowRef يحفظ أحدث نسخة من handleSaveRow
  saveRowRef.current = handleSaveRow;

  // ── handleKeyDown ────────────────────────────────────────────────────────────
  // ✅ FIX-001: يستخدم saveRowRef — مفيش stale closure
  // ✅ ترتيب: صنف → عدد → وزن كلي → أضف
  const handleKeyDown = useCallback((e, rowId, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (field === 'quantity')    { twRefs.current[rowId]?.focus(); return; }
    if (field === 'unitWeight')  { twRefs.current[rowId]?.focus(); return; }
    if (field === 'totalWeight') { saveRowRef.current(rowId); }
  }, []);

  const handleEditRow = useCallback((rowId) => {
    setRowsSafe(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const tw = calcTotalWeight(r);
      if (tw > 0) setTWInputSafe(p => ({ ...p, [rowId]: String(tw) }));
      return { ...r, saved: false, editing: true };
    }));
  }, [setRowsSafe, setTWInputSafe]);

  const handleCancelRow = useCallback((rowId) =>
    setRowsSafe(prev => prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r))
  , [setRowsSafe]);

  const handleDeleteRow = useCallback((rowId) =>
    setRowsSafe(prev => {
      const f = prev.filter(r => r.id !== rowId);
      return f.some(r => !r.saved) ? f : [...f, newRow()];
    })
  , [setRowsSafe]);

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
        // ✅ FIX: item.itemId هو الـ UUID الصحيح المخزّن في DB
        //         item.item هو object { name, code } من الـ include — مش عنده _id
        item:        item.itemId || item.item?._id || item.item,
        itemCode:    item.itemCode,
        itemName:    item.itemName,
        unit:        item.unit || '',
        unitWeight:  uw,
        quantity:    String(qty),
        _totalWeight: tw,
        availableQty:    undefined,
        availableWeight: undefined,
        saved: true, editing: false,
      };
    });
    const twMap = {};
    loaded.forEach(r => { if (r._totalWeight) twMap[r.id] = String(r._totalWeight); });
    const withNew = [...loaded, newRow()];
    rowsRef.current    = withNew;
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

  // ── toPayload ────────────────────────────────────────────────────────────────
  const toPayload = useCallback(() =>
    rowsRef.current.filter(r => r.saved).map(r => {
      const uw  = parseFloat(r.unitWeight) || 0;
      const tw  = calcTotalWeight(r);
      const qty = uw > 0 ? tw / uw : (parseFloat(r.quantity) || 0);
      return {
        item:        r.item,
        itemCode:    r.itemCode,
        itemName:    r.itemName,
        quantity:    qty,
        weight:      uw,
        totalWeight: tw,
      };
    })
  , []);

  return {
    rows, savedRows, activeRow, totalWeightAll, totalWeightInput,
    itemRefs, qtyRefs, wtRefs, twRefs,
    handleItemSelect, updateRow,
    handleQuantityChange, handleUnitWeightChange, handleTotalWeightChange,
    handleKeyDown, handleSaveRow,
    handleEditRow, handleCancelRow, handleDeleteRow,
    loadRows, resetRows, toPayload,
  };
}
