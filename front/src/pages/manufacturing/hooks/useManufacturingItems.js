import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

// ── factories ─────────────────────────────────────────────────────────────────
export const newRow = () => ({
  id: Date.now() + Math.random(),
  item: null, itemCode: '', itemName: '', unit: '',
  quantity: '',       // كراتين
  weight: '',         // وزن/كرتون
  totalWeightManual: '', // الوزن الكلي اليدوي (اختياري)
  availableQty: undefined,
  saved: false, editing: false,
});

// ── calculators ───────────────────────────────────────────────────────────────
export const calcTotalWeight = (row) => {
  if (row.totalWeightManual !== '' && row.totalWeightManual !== undefined)
    return parseFloat(row.totalWeightManual) || 0;
  return (parseFloat(row.quantity) || 0) * (parseFloat(row.weight) || 0);
};

export const fmtW = (n, d = 3) => Number(n || 0).toFixed(d);

/**
 * useManufacturingItems
 * ─────────────────────
 * نفس الـ UX بالضبط زي فاتورة المبيعات:
 *  - sticky input row في الأسفل
 *  - Enter ينتقل: صنف → كراتين → وزن/كرتون → وزن كلي → إضافة
 *  - الوزن الكلي اليدوي يحسب الكراتين تلقائياً
 *  - auto-focus بعد كل إضافة
 */
export function useManufacturingItems({ warehouse, checkStock = false } = {}) {
  const [rows,             setRows]             = useState([newRow()]);
  const [totalWeightInput, setTotalWeightInput] = useState({});  // الوزن الكلي اليدوي per row

  // ── refs للـ focus ─────────────────────────────────────────────────────────
  const itemRefs = useRef({});  // fn لفوكس الـ ItemSearch
  const qtyRefs  = useRef({});
  const wtRefs   = useRef({});
  const twRefs   = useRef({});  // total weight

  // ── computed ───────────────────────────────────────────────────────────────
  const savedRows        = rows.filter(r => r.saved);
  const activeRow        = rows.find(r => !r.saved);
  const totalWeightAll   = savedRows.reduce((s, r) => s + calcTotalWeight(r), 0);

  // ── item select ────────────────────────────────────────────────────────────
  const handleItemSelect = useCallback((rowId, item) => {
    if (!item) return;
    const stockQty = item.stock?.[warehouse]?.quantity;
    setRows(prev => prev.map(r =>
      r.id === rowId ? {
        ...r,
        item: item._id, itemCode: item.code, itemName: item.name, unit: item.unit || '',
        weight: item.defaultWeight ? String(item.defaultWeight) : r.weight,
        availableQty: stockQty,
        totalWeightManual: '',
      } : r
    ));
    setTimeout(() => qtyRefs.current[rowId]?.focus(), 50);
  }, [warehouse]);

  // ── field update ───────────────────────────────────────────────────────────
  const updateRow = useCallback((rowId, field, value) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
  , []);

  // ── الوزن الكلي اليدوي → يحسب الكراتين تلقائياً ──────────────────────────
  const handleTotalWeightChange = useCallback((rowId, totalWt) => {
    setTotalWeightInput(prev => ({ ...prev, [rowId]: totalWt }));
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const wt = parseFloat(r.weight);
      if (!wt) return { ...r, totalWeightManual: totalWt };
      const qty = (parseFloat(totalWt) || 0) / wt;
      return {
        ...r,
        totalWeightManual: totalWt,
        quantity: qty > 0 ? String(parseFloat(qty.toFixed(4))) : '',
      };
    }));
  }, []);

  // ── Enter navigation ───────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e, rowId, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (field === 'quantity') { wtRefs.current[rowId]?.focus(); return; }
    if (field === 'weight')   { twRefs.current[rowId]?.focus(); return; }
    if (field === 'totalWeight') { handleSaveRow(rowId); }
  }, []); // eslint-disable-line

  // ── save row ───────────────────────────────────────────────────────────────
  const handleSaveRow = useCallback((rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row?.item)     return toast.error('اختار الصنف أولاً');
    if (!row.quantity)  return toast.error('أدخل عدد الكراتين');
    if (!row.weight && !row.totalWeightManual)
      return toast.error('أدخل وزن/كرتون أو الوزن الكلي');
    if (calcTotalWeight(row) <= 0)
      return toast.error('الوزن الكلي لازم يكون أكبر من صفر');

    if (checkStock && row.availableQty !== undefined && Number(row.quantity) > row.availableQty)
      return toast.error(`الكمية (${row.quantity}) أكبر من المتاح (${row.availableQty} كرتون)`);

    if (rows.find(r => r.id !== rowId && r.saved && r.item === row.item))
      return toast.error(`"${row.itemName}" موجود بالفعل — عدّله`);

    if (row.editing) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r));
    } else {
      const next = newRow();
      setRows(prev => [
        ...prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r),
        next,
      ]);
      setTotalWeightInput(prev => { const n = { ...prev }; delete n[rowId]; return n; });
      // auto-focus next item search بعد الإضافة
      setTimeout(() => { if (itemRefs.current[next.id]) itemRefs.current[next.id](); }, 80);
    }
  }, [rows, checkStock]);

  const handleEditRow = useCallback((rowId) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: false, editing: true } : r))
  , []);

  const handleCancelRow = useCallback((rowId) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r))
  , []);

  const handleDeleteRow = useCallback((rowId) =>
    setRows(prev => {
      const f = prev.filter(r => r.id !== rowId);
      return f.some(r => !r.saved) ? f : [...f, newRow()];
    })
  , []);

  // ── load from existing order (edit mode) ───────────────────────────────────
  const loadRows = useCallback((items) => {
    const loaded = items.map(item => ({
      id:               Date.now() + Math.random(),
      item:             item.item?._id || item.item,
      itemCode:         item.itemCode,
      itemName:         item.itemName,
      unit:             item.unit || '',
      quantity:         String(item.quantity),
      weight:           String(item.weight),
      totalWeightManual: item.totalWeightManual != null &&
        Math.abs(item.totalWeightManual - item.quantity * item.weight) > 0.001
          ? String(item.totalWeightManual) : '',
      saved: true, editing: false,
    }));
    setRows([...loaded, newRow()]);
    setTotalWeightInput({});
  }, []);

  const resetRows = useCallback(() => {
    setRows([newRow()]);
    setTotalWeightInput({});
  }, []);

  // ── map to payload ─────────────────────────────────────────────────────────
  const toPayload = useCallback(() =>
    savedRows.map(r => ({
      item:        r.item,
      itemCode:    r.itemCode,
      itemName:    r.itemName,
      quantity:    Number(r.quantity),
      weight:      Number(r.weight) || 0,
      totalWeight: calcTotalWeight(r),
    }))
  , [savedRows]);

  return {
    rows, savedRows, activeRow, totalWeightAll, totalWeightInput,
    itemRefs, qtyRefs, wtRefs, twRefs,
    handleItemSelect, updateRow, handleTotalWeightChange,
    handleKeyDown, handleSaveRow,
    handleEditRow, handleCancelRow, handleDeleteRow,
    loadRows, resetRows, toPayload,
  };
}
