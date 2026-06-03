// ─── TransferPage.jsx ──────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { createTransfer, updateTransfer, fetchTransferById } from '../../store/slices/transferSlice';
import api from '../../services/api';
import toast from 'react-hot-toast';
import InvoiceItemsForm from '../../components/common/InvoiceItemsForm';

const newRow = () => ({
  id: Date.now() + Math.random(),
  item: null, itemCode: '', itemName: '', unit: '',
  unitWeight: 0,
  quantity: '',
  availableQty: undefined, availableWeight: undefined,
  _totalWeight: null,
  saved: false, editing: false,
});

const r3 = (v) => Math.round((parseFloat(v) || 0) * 1000) / 1000;
const r2 = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;
const calcTW = (qty, wt, tw = null) =>
  tw != null ? r3(parseFloat(tw)) : r3((parseFloat(qty) || 0) * (parseFloat(wt) || 0));
const cleanNum = (v, decimals = 3) => {
  const n = parseFloat(v) || 0;
  return (Object.is(n, -0) || Math.abs(n) < 0.0005) ? (0).toFixed(decimals) : n.toFixed(decimals);
};

export default function TransferPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { id }    = useParams();
  const isEdit    = !!id;

  const { user }         = useSelector(s => s.auth);
  const { current }      = useSelector(s => s.transfers);
  const { activeSeason } = useSelector(s => s.season);
  const isAdmin          = user?.role === 'admin';

  const defaultFrom = user?.warehouse === 'october' ? 'october' : 'ramses';
  const [fromWarehouse,    setFromWarehouse]    = useState(defaultFrom);
  const [toWarehouse,      setToWarehouse]      = useState(defaultFrom === 'ramses' ? 'october' : 'ramses');
  const [date,             setDate]             = useState(new Date().toISOString().split('T')[0]);
  const [notes,            setNotes]            = useState('');
  const [rows,             setRows]             = useState([newRow()]);
  const [saving,           setSaving]           = useState(false);
  const [loading,          setLoading]          = useState(isEdit);
  const [existingStatus,   setExistingStatus]   = useState('pending');
  const [totalWeightInput, setTotalWeightInput] = useState({});
  const [docNumber,        setDocNumber]        = useState('');
  const [docError,         setDocError]         = useState('');
  const [docChecking,      setDocChecking]      = useState(false);

  const qtyRefs  = useRef({});
  const wtRefs   = useRef({});
  const itemRefs = useRef({});
  const docTimer = useRef(null);

  // ── تحميل للتعديل ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    dispatch(fetchTransferById(id)).then(res => {
      const data = res.payload;
      if (!data) { toast.error('التحويل مش موجود'); navigate(-1); return; }
      if (data.status === 'rejected') { toast.error('لا يمكن تعديل تحويل مرفوض'); navigate(-1); return; }
      if (data.status === 'approved' && !isAdmin) { toast.error('فقط الأدمن يمكنه تعديل تحويل معتمد'); navigate(-1); return; }

      setExistingStatus(data.status);
      setFromWarehouse(data.fromWarehouse);
      setToWarehouse(data.toWarehouse);
      setDate(data.date?.split('T')[0] || new Date().toISOString().split('T')[0]);
      setNotes(data.notes || '');
      setDocNumber(data.docNumber || '');

      const loaded = data.items.map(item => {
        const uw = parseFloat(item.weight) || 0;
        const tw = item.totalWeight != null
          ? parseFloat(item.totalWeight)
          : Math.round((parseFloat(item.quantity)||0) * uw * 1000) / 1000;
        const qty = uw > 0 && tw > 0 ? Math.round((tw/uw)*10000)/10000 : (parseFloat(item.quantity)||0);
        return {
          id: Date.now() + Math.random(),
          item: item.itemId || item.item?._id || item.item,
          itemCode: item.itemCode, itemName: item.itemName, unit: item.unit || '',
          unitWeight: uw, quantity: String(qty),
          _totalWeight: tw,
          availableQty: undefined, availableWeight: undefined,
          saved: true, editing: false,
        };
      });
      const twMap = {};
      loaded.forEach(r => { if (r._totalWeight) twMap[r.id] = String(r._totalWeight); });
      setRows([...loaded, newRow()]);
      setTotalWeightInput(twMap);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // ── تحديث الرصيد عند تغيير المخزن ────────────────────────────────────────
  const refreshStockForWarehouse = useCallback(async (warehouse) => {
    const savedWithItems = rows.filter(r => r.saved && r.item);
    if (!savedWithItems.length) return;
    try {
      const seasonId = activeSeason?._id;
      const results = await Promise.all(
        savedWithItems.map(r => api.get(`/items/${r.item}/stock`, { params: seasonId ? { seasonId } : {} }))
      );
      const stockByItem = {};
      results.forEach(({ data }, i) => { stockByItem[savedWithItems[i].item] = data.stock; });
      setRows(prev => prev.map(r => {
        if (!r.saved || !r.item || !stockByItem[r.item]) return r;
        return { ...r, availableQty: stockByItem[r.item]?.[warehouse]?.quantity ?? 0 };
      }));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeSeason]);

  // ── doc check ──────────────────────────────────────────────────────────────
  const checkDocNumber = useCallback(async (val) => {
    if (!val?.trim() || !fromWarehouse) { setDocError(''); return; }
    const direction = fromWarehouse === 'ramses' ? 'R2O' : 'O2R';
    setDocChecking(true);
    try {
      const params = { docNumber: val.trim(), direction };
      if (activeSeason?._id) params.seasonId = activeSeason._id;
      if (isEdit && id) params.excludeId = id;
      const { data } = await api.get('/transfers/check-doc', { params });
      setDocError(data.exists ? `⚠️ رقم المستند "${val}" موجود بالفعل (${data.transferNumber})` : '');
    } catch { setDocError(''); }
    finally { setDocChecking(false); }
  }, [fromWarehouse, activeSeason, isEdit, id]);

  const handleDocChange = (val) => {
    setDocNumber(val); setDocError('');
    clearTimeout(docTimer.current);
    docTimer.current = setTimeout(() => checkDocNumber(val), 500);
  };

  // ── item handlers ──────────────────────────────────────────────────────────
  const handleItemSelect = (rowId, item) => {
    if (!item) return;
    const availableQty = item.stock?.[fromWarehouse]?.quantity ?? 0;
    const availableWeight = item.stock?.[fromWarehouse]?.weight ?? 0;
    const unitWeight = parseFloat(item.defaultWeight) || 0;
    setRows(prev => prev.map(r => r.id !== rowId ? r : {
      ...r, item: item._id, itemCode: item.code, itemName: item.name, unit: item.unit || '',
      unitWeight, availableQty, availableWeight,
    }));
    setTimeout(() => qtyRefs.current[rowId]?.focus(), 50);
  };

  const updateRow = (rowId, field, val) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: val } : r));

  const handleQuantityChange = (rowId, qtyStr) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const qty = parseFloat(qtyStr) || 0;
      const uw  = parseFloat(r.unitWeight) || 0;
      if (qty > 0 && uw > 0) {
        const newTW = Math.round(qty * uw * 1000) / 1000;
        setTotalWeightInput(p => ({ ...p, [rowId]: String(newTW) }));
        return { ...r, quantity: qtyStr, _totalWeight: newTW };
      }
      setTotalWeightInput(p => ({ ...p, [rowId]: '' }));
      return { ...r, quantity: qtyStr, _totalWeight: null };
    }));
  };

  const handleUnitWeightChange = (rowId, uwStr) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const uw  = parseFloat(uwStr) || 0;
      const qty = parseFloat(r.quantity) || 0;
      if (qty > 0 && uw > 0) {
        const newTW = Math.round(qty * uw * 1000) / 1000;
        setTotalWeightInput(p => ({ ...p, [rowId]: String(newTW) }));
        return { ...r, unitWeight: uw, _totalWeight: newTW };
      }
      return { ...r, unitWeight: uw };
    }));
  };

  const handleTotalWeightChange = (rowId, totalWt) => {
    setTotalWeightInput(prev => ({ ...prev, [rowId]: totalWt }));
    const tw = parseFloat(totalWt) || 0;
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const uw  = parseFloat(r.unitWeight) || 0;
      const qty = uw > 0 && tw > 0 ? Math.round((tw / uw) * 10000) / 10000 : 0;
      return {
        ...r,
        _totalWeight: tw > 0 ? tw : null,
        quantity: qty > 0 ? String(qty) : '',
      };
    }));
  };

  const handleKeyDown = (e, rowId, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (field === 'quantity') { wtRefs.current[rowId]?.focus(); return; }
    if (field === 'weight')   { handleSaveRow(rowId); }
  };

  const handleSaveRow = (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row?.item)      { toast.error('اختار الصنف أولاً');        return; }
    if (!row.unitWeight) { toast.error('أدخل وزن/وحدة');             return; }
    const tw = row._totalWeight ?? Math.round((parseFloat(row.quantity)||0) * (parseFloat(row.unitWeight)||0) * 1000) / 1000;
    if (tw <= 0)         { toast.error('أدخل الوزن الكلي أو العدد'); return; }
    // ✅ ARCH-001: تحقق من الرصيد بالوزن
    if (row.availableWeight !== undefined) {
      const awt = parseFloat(row.availableWeight) || 0;
      if (awt < tw) { toast.error(`المخزون مش كافي — متاح: ${awt.toFixed(3)} ك — مطلوب: ${tw.toFixed(3)} ك`); return; }
    }
    const dup = rows.find(r => r.id !== rowId && r.saved && r.item === row.item);
    if (dup) { toast.error(`الصنف "${row.itemName}" موجود بالفعل`); return; }
    if (row.editing) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r));
    } else {
      const newR = newRow();
      setRows(prev => [...prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r), newR]);
      setTotalWeightInput(prev => { const n = { ...prev }; delete n[rowId]; return n; });
      setTimeout(() => { if (itemRefs.current[newR.id]) itemRefs.current[newR.id](); }, 80);
    }
  };

  const handleEditRow   = (rowId) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: false, editing: true  } : r));
  const handleCancelRow = (rowId) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: true,  editing: false } : r));
  const handleDeleteRow = (rowId) => setRows(prev => { const f = prev.filter(r => r.id !== rowId); return f.length ? f : [newRow()]; });

  const handleFromChange = async (val) => {
    setFromWarehouse(val);
    setToWarehouse(val === 'ramses' ? 'october' : 'ramses');
    await refreshStockForWarehouse(val);
  };

  const savedRows     = rows.filter(r => r.saved);
  const r3tw = (v) => Math.round((parseFloat(v)||0)*1000)/1000;
  const totalWeight   = r3tw(savedRows.reduce((s, r) => {
    const uw = parseFloat(r.unitWeight) || 0;
    const tw = r._totalWeight ?? Math.round((parseFloat(r.quantity)||0) * uw * 1000) / 1000;
    return s + tw;
  }, 0));
  const totalQuantity = savedRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
  const isApprovedEdit = isEdit && existingStatus === 'approved';

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!docNumber.trim())             { toast.error('أدخل رقم المستند'); return; }
    if (docError)                      { toast.error(docError); return; }
    if (fromWarehouse === toWarehouse) { toast.error('المخزن المصدر والهدف لازم يكونوا مختلفين'); return; }
    if (savedRows.length === 0)        { toast.error('أضف صنف واحد على الأقل'); return; }

    if (isApprovedEdit) {
      const ok = window.confirm('⚠️ هتعدل على إذن تحويل معتمد!\nده هيعكس حركات المخزن القديمة ويطبق الجديدة تلقائياً.\nمتأكد؟');
      if (!ok) return;
    }

    setSaving(true);
    const payload = {
      fromWarehouse, toWarehouse, date, notes,
      docNumber: docNumber.trim(),
      items: savedRows.map(r => {
        const uw  = parseFloat(r.unitWeight) || 0;
        const tw  = r._totalWeight ?? Math.round((parseFloat(r.quantity)||0) * uw * 1000) / 1000;
        const qty = uw > 0 ? tw / uw : (parseFloat(r.quantity) || 0);
        return {
          item: r.item, itemCode: r.itemCode, itemName: r.itemName,
          quantity: qty, weight: uw,    // ✅ ARCH-001: weight = unitWeight
          totalWeight: tw,              // ✅ المصدر الحقيقي
        };
      }),
    };

    try {
      if (isEdit) {
        const res = await dispatch(updateTransfer({ id, ...payload }));
        if (!res.error) { toast.success('تم تعديل الإذن ✅'); navigate(-1); }
        else toast.error(res.payload || 'خطأ في التعديل');
      } else {
        const res = await dispatch(createTransfer(payload));
        if (!res.error) {
          toast.success(`تم حفظ الإذن ${res.payload.transferNumber} ⏳`);
          setRows([newRow()]); setNotes(''); setDocNumber(''); setDocError('');
          setDate(new Date().toISOString().split('T')[0]);
          setTotalWeightInput({});
        } else toast.error(res.payload || 'خطأ في الحفظ');
      }
    } catch { toast.error('خطأ غير متوقع'); }
    setSaving(false);
  };

  if (loading) return <div className="text-center py-24 text-gray-400">جاري تحميل الإذن...</div>;

  const warehouseLabel = (w) => w === 'ramses' ? '🔵 رمسيس' : '🟣 أكتوبر';

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-8">

      {/* ── هيدر ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEdit ? `✏️ تعديل — ${current?.transferNumber || ''}` : 'إذن تحويل جديد'}
          </h1>
          <p className={`text-sm px-3 py-1 rounded-full mt-1 inline-block ${
            isApprovedEdit
              ? 'text-red-700 bg-red-50 border border-red-200'
              : 'text-amber-600 bg-amber-50'
          }`}>
            {isApprovedEdit
              ? '⚠️ تعديل على إذن معتمد — سيُعاد حساب المخزن'
              : isEdit ? '✏️ تعديل إذن معلق' : '⏳ في انتظار موافقة الأدمن بعد الحفظ'}
          </p>
        </div>
        <div className="flex gap-2">
          {isEdit && <button className="btn-secondary" onClick={() => navigate(-1)}>← رجوع</button>}
          <button
            className={isApprovedEdit ? 'btn-danger' : 'btn-primary'}
            onClick={handleSubmit}
            disabled={saving || savedRows.length === 0}
          >
            {saving ? 'جاري الحفظ...' : isEdit
              ? `💾 حفظ التعديل (${savedRows.length} صنف)`
              : `💾 حفظ (${savedRows.length} صنف)`}
          </button>
        </div>
      </div>

      {/* تحذير معتمد */}
      {isApprovedEdit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold mb-1">تنبيه: تعديل إذن تحويل معتمد</p>
            <p>عند الحفظ سيتم تلقائياً: عكس حركات المخزن القديمة وتطبيق البيانات الجديدة.</p>
          </div>
        </div>
      )}

      {/* ── بيانات الإذن ── */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">بيانات الإذن</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">من مخزن</label>
            <select className="input-field" value={fromWarehouse} onChange={e => handleFromChange(e.target.value)}>
              <option value="ramses">🔵 رمسيس</option>
              <option value="october">🟣 أكتوبر</option>
            </select>
          </div>
          <div className="flex justify-center items-end pb-2">
            <div className="flex items-center gap-2 text-blue-500 font-bold text-base">
              <span className="text-xs text-gray-600">{warehouseLabel(fromWarehouse)}</span>
              <span className="text-lg">←</span>
              <span className="text-xs text-gray-600">{warehouseLabel(toWarehouse)}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">إلى مخزن</label>
            <select className="input-field" value={toWarehouse} onChange={e => setToWarehouse(e.target.value)}>
              <option value="ramses">🔵 رمسيس</option>
              <option value="october">🟣 أكتوبر</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">التاريخ</label>
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">رقم المستند *</label>
            <input
              className={`input-field ${docError ? 'border-red-500 ring-2 ring-red-100' : ''}`}
              placeholder="أدخل رقم المستند..."
              value={docNumber}
              onChange={e => handleDocChange(e.target.value)}
            />
            {docChecking && <p className="text-xs text-gray-400 mt-0.5">جاري التحقق...</p>}
            {docError    && <p className="text-xs text-red-500 mt-0.5">{docError}</p>}
            {docNumber && !docError && !docChecking && (
              <p className="text-xs text-green-600 mt-0.5">✓ رقم المستند متاح</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ملاحظات</label>
            <input className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري..." />
          </div>
        </div>
      </div>

      {/* ✅ الكومبونانت المشترك — showPrice=false للتحويلات */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
          الأصناف {savedRows.length > 0 && `(${savedRows.length})`}
        </h2>
        <InvoiceItemsForm
          rows={rows}
          totalWeightInput={totalWeightInput}
          showPrice={false}
          qtyRefs={qtyRefs}
          wtRefs={wtRefs}
          prRefs={{ current: {} }}
          twRefs={{ current: {} }}
          itemRefs={itemRefs}
          onItemSelect={handleItemSelect}
          onUpdateRow={updateRow}
          onQuantityChange={handleQuantityChange}
          onUnitWeightChange={handleUnitWeightChange}
          onTotalWeightChange={handleTotalWeightChange}
          onKeyDown={handleKeyDown}
          onSaveRow={handleSaveRow}
          onEditRow={handleEditRow}
          onCancelRow={handleCancelRow}
          onDeleteRow={handleDeleteRow}
        />
      </div>

      {/* بطاقة الإجمالي */}
      {savedRows.length > 0 && (
        <div className="card bg-blue-50 border border-blue-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 space-y-1">
              <p>عدد الأصناف: <span className="font-bold text-gray-800">{savedRows.length}</span></p>
              <p>إجمالي الكراتين: <span className="font-bold text-gray-800">{cleanNum(totalQuantity, 3)}</span></p>
              <p className="text-xs text-gray-500">{warehouseLabel(fromWarehouse)} ← {warehouseLabel(toWarehouse)}</p>
              {activeSeason && <p className="text-xs text-blue-600">🌿 الموسم: {activeSeason.name}</p>}
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-500 mb-1">إجمالي الوزن المحوّل</p>
              <p className="text-3xl font-bold text-blue-700">{cleanNum(totalWeight, 2)}</p>
              <p className="text-sm text-gray-400">كيلو</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
