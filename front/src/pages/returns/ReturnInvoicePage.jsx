import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { createReturn } from '../../store/slices/returnSlice';
import CustomerSearch from '../../components/common/CustomerSearch';
import SupplierSearch from '../../components/common/SupplierSearch';
import api from '../../services/api';
import toast from 'react-hot-toast';
import InvoiceItemsForm from '../../components/common/InvoiceItemsForm';

const r2 = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;
const r3 = (v) => Math.round((parseFloat(v) || 0) * 1000) / 1000;
const calcTotalWeight = (q, w, tw = null) =>
  tw != null ? r3(parseFloat(tw)) : r3((parseFloat(q) || 0) * (parseFloat(w) || 0));
const cleanNum = (v, decimals = 3) => {
  const n = parseFloat(v) || 0;
  return (Object.is(n, -0) || Math.abs(n) < 0.0005) ? (0).toFixed(decimals) : n.toFixed(decimals);
};

const newRow = () => ({
  id: Date.now() + Math.random(),
  item: null, itemCode: '', itemName: '', unit: '',
  unitWeight: 0,   // وزن الوحدة الافتراضي (default من الصنف)
  quantity: '', price: '',
  availableQty: undefined, availableWeight: undefined,
  _totalWeight: null,
  saved: false, editing: false,
});

export default function ReturnInvoicePage({ type = 'customer_return' }) {
  const dispatch    = useDispatch();
  const navigate    = useNavigate();
  const { id }      = useParams();
  const isEditMode  = !!id;
  const isCustomer  = type === 'customer_return';

  const { user }  = useSelector((s) => s.auth);
  const isAdmin   = user?.role === 'admin';

  const [party,            setParty]            = useState(null);
  const [partyError,       setPartyError]       = useState(false);
  const [docNumber,        setDocNumber]        = useState('');
  const [originalInvoice,  setOriginalInvoice]  = useState('');
  const [date,             setDate]             = useState(new Date().toISOString().split('T')[0]);
  const [warehouse,        setWarehouse]        = useState('ramses');
  const [notes,            setNotes]            = useState('');
  const [rows,             setRows]             = useState([newRow()]);
  const [saving,           setSaving]           = useState(false);
  const [totalWeightInput, setTotalWeightInput] = useState({});
  const [loadingEdit,      setLoadingEdit]      = useState(isEditMode);
  const [existingReturn,   setExistingReturn]   = useState(null);
  const [refundMethod,     setRefundMethod]     = useState('none');
  const [refundCashAmount, setRefundCashAmount] = useState('');
  const [refundBankAmount, setRefundBankAmount] = useState('');

  const qtyRefs  = useRef({});
  const wtRefs   = useRef({});
  const twRefs   = useRef({});
  const prRefs   = useRef({});
  const itemRefs = useRef({});

  // ── load for edit ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    api.get(`/returns/${id}`)
      .then(({ data }) => {
        if (data.status === 'rejected') { toast.error('لا يمكن تعديل مرتجع مرفوض'); navigate(-1); return; }
        if (data.status === 'approved' && !isAdmin) { toast.error('فقط الأدمن يمكنه تعديل مرتجع معتمد'); navigate(-1); return; }

        setExistingReturn(data);
        setDocNumber(data.docNumber || '');
        setOriginalInvoice(data.originalInvoice || '');
        setDate(data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0]);
        setWarehouse(data.warehouse || 'ramses');
        setNotes(data.notes || '');

        const storedMethod = data.refundMethod || 'none';
        setRefundMethod((storedMethod === 'cash' && Number(data.refundBankAmount) > 0) ? 'mixed' : storedMethod);
        setRefundCashAmount(data.refundCashAmount ? String(data.refundCashAmount) : '');
        setRefundBankAmount(data.refundBankAmount ? String(data.refundBankAmount) : '');

        if (isCustomer && data.customerCode)
          setParty({ _id: data.customer?._id || data.customer, code: data.customerCode, name: data.customerName });
        else if (!isCustomer && data.supplierCode)
          setParty({ _id: data.supplier?._id || data.supplier, code: data.supplierCode, name: data.supplierName });

        const loaded = data.items.map((item) => ({
          id: Date.now() + Math.random(),
          item: item.itemId || item.item?._id || item.item,
          itemCode: item.itemCode, itemName: item.itemName,
          unit: item.unit || '',
          unitWeight: parseFloat(item.weight) || 0,
          quantity: String(
            item.totalWeight
              ? Math.round((parseFloat(item.totalWeight) / (parseFloat(item.weight) || 1)) * 10000) / 10000
              : (parseFloat(item.quantity) || 0)
          ),
          price: String(item.price),
          _totalWeight: item.totalWeight != null
            ? parseFloat(item.totalWeight)
            : Math.round(parseFloat(item.quantity) * parseFloat(item.weight) * 1000) / 1000,
          availableQty: undefined, availableWeight: undefined,
          saved: true, editing: false,
        }));
        setRows([...loaded, newRow()]);
        setLoadingEdit(false);
      })
      .catch(() => { toast.error('خطأ في تحميل المرتجع'); navigate(-1); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleItemSelect = (rowId, item) => {
    if (!item) return;
    const stockQty = item.stock?.[warehouse]?.quantity ?? 0;
    const stockWt  = item.stock?.[warehouse]?.weight   ?? 0;
    const unitWeight = parseFloat(item.defaultWeight) || 0;
    setRows(prev => prev.map(r => r.id !== rowId ? r : {
      ...r, item: item._id, itemCode: item.code, itemName: item.name, unit: item.unit || '',
      unitWeight, availableQty: stockQty, availableWeight: stockWt,
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
    if (field === 'quantity')    { twRefs.current[rowId]?.focus(); return; }
    if (field === 'totalWeight') { prRefs.current[rowId]?.focus(); return; }
    if (field === 'price')       { handleSaveRow(rowId); }
  };

  const handleSaveRow = (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row?.item)      { toast.error('اختار الصنف أولاً');        return; }
    if (!row.unitWeight) { toast.error('أدخل وزن/وحدة');             return; }
    const tw = row._totalWeight ?? Math.round((parseFloat(row.quantity)||0) * (parseFloat(row.unitWeight)||0) * 1000) / 1000;
    if (tw <= 0)         { toast.error('أدخل الوزن الكلي أو العدد'); return; }
    if (!row.price)      { toast.error('أدخل السعر');                return; }
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

  const savedRows      = rows.filter(r => r.saved);
  const totalAmount    = r2(savedRows.reduce((s, r) => {
    const uw = parseFloat(r.unitWeight) || 0;
    const tw = r._totalWeight ?? Math.round((parseFloat(r.quantity)||0) * uw * 1000) / 1000;
    return s + r2(tw * (parseFloat(r.price)||0));
  }, 0));
  const totalWeightAll = r3(savedRows.reduce((s, r) => {
    const tw = r._totalWeight != null ? parseFloat(r._totalWeight) : calcTotalWeight(r.quantity, r.weight);
    return s + (tw || 0);
  }, 0));

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!party)               { setPartyError(true); toast.error(isCustomer ? 'اختار العميل' : 'اختار المورد'); return; }
    if (!docNumber.trim())    { toast.error('أدخل رقم المستند'); return; }
    if (savedRows.length === 0) { toast.error('أضف صنف واحد على الأقل'); return; }

    if (isEditMode && existingReturn?.status === 'approved') {
      const ok = window.confirm('⚠️ هتعدل على مرتجع معتمد!\nده هيعكس أثر المخزن والخزنة القديم ويطبق الجديد تلقائياً.\nمتأكد؟');
      if (!ok) return;
    }

    setSaving(true);
    const itemsPayload = savedRows.map(r => {
      const uw  = parseFloat(r.unitWeight) || 0;
      const pr  = parseFloat(r.price) || 0;
      const tw  = r._totalWeight ?? Math.round((parseFloat(r.quantity)||0) * uw * 1000) / 1000;
      const qty = uw > 0 ? tw / uw : (parseFloat(r.quantity) || 0);
      return { item: r.item, itemId: r.item, itemCode: r.itemCode, itemName: r.itemName,
               quantity: qty, weight: uw,   // ✅ ARCH-001: weight = unitWeight
               price: pr, totalWeight: tw,  // ✅ المصدر الحقيقي
               total: Math.round(tw * pr * 100) / 100 };
    });

    const partyFields  = isCustomer
      ? { customerId: party._id, customerCode: party.code, customerName: party.name }
      : { supplierId: party._id, supplierCode: party.code, supplierName: party.name };
    const refundFields = isCustomer
      ? { refundMethod, refundCashAmount: Number(refundCashAmount) || 0, refundBankAmount: Number(refundBankAmount) || 0 }
      : {};

    const payload = { type, docNumber: docNumber.trim(), date, warehouse, notes, originalInvoice,
                      ...partyFields, ...refundFields, items: itemsPayload };

    try {
      if (isEditMode) {
        // ✅ لو معتمد → force-edit (يعكس المخزون والخزنة)، لو معلق → update عادي
        const endpoint = existingReturn?.status === 'approved'
          ? `/returns/${id}/force-edit`
          : `/returns/${id}`;
        await api.put(endpoint, payload);
        toast.success('تم تعديل المرتجع ✅');
        navigate(-1);
      } else {
        const res = await dispatch(createReturn(payload));
        if (!res.error) {
          toast.success(`تم حفظ المرتجع ${res.payload.invoiceNumber} — في انتظار موافقة الأدمن ✅`);
          setParty(null); setDocNumber(''); setOriginalInvoice('');
          setDate(new Date().toISOString().split('T')[0]);
          setNotes(''); setRows([newRow()]); setPartyError(false);
          setTotalWeightInput({}); setRefundMethod('none');
          setRefundCashAmount(''); setRefundBankAmount('');
        } else { toast.error(res.payload || 'خطأ في الحفظ'); }
      }
    } catch (err) { toast.error(err.response?.data?.message || 'خطأ في الحفظ'); }
    setSaving(false);
  };

  if (loadingEdit)
    return <div className="text-center py-20 text-gray-400">جاري تحميل المرتجع...</div>;

  const isApprovedEdit = isEditMode && existingReturn?.status === 'approved';

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── هيدر ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditMode
              ? `✏️ تعديل — ${existingReturn?.invoiceNumber}`
              : isCustomer ? 'مرتجع عميل جديد' : 'مرتجع مورد جديد'}
          </h1>
          <p className={`text-sm px-3 py-1 rounded-full mt-1 inline-block ${
            isApprovedEdit
              ? 'text-red-700 bg-red-50 border border-red-200'
              : 'text-amber-600 bg-amber-50'
          }`}>
            {isApprovedEdit
              ? '⚠️ تعديل على مرتجع معتمد — سيُعاد حساب المخزن والخزنة'
              : isEditMode ? '✏️ تعديل على مرتجع معلق'
              : '⏳ في انتظار موافقة الأدمن بعد الحفظ'}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditMode && <button className="btn-secondary" onClick={() => navigate(-1)}>← رجوع</button>}
          <button
            className={isApprovedEdit ? 'btn-danger' : 'btn-primary'}
            onClick={handleSubmit}
            disabled={saving || savedRows.length === 0}
          >
            {saving ? 'جاري الحفظ...'
              : isEditMode ? `💾 حفظ التعديل (${savedRows.length} صنف)`
              : `💾 حفظ (${savedRows.length} صنف)`}
          </button>
        </div>
      </div>

      {/* تحذير مرتجع معتمد */}
      {isApprovedEdit && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-2">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold mb-1">تنبيه: تعديل مرتجع معتمد</p>
            <p>عند الحفظ سيتم تلقائياً: عكس حركات المخزن القديمة، عكس أثر الخزنة القديم، تطبيق البيانات الجديدة.</p>
          </div>
        </div>
      )}

      {/* رأس المرتجع */}
      <div className="card mb-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">بيانات المرتجع</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">رقم المستند *</label>
            <input className="input-field" value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="رقم المستند" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">التاريخ</label>
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">المخزن</label>
            <select className="input-field" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
              <option value="ramses">رمسيس</option>
              <option value="october">أكتوبر</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              {isCustomer ? 'العميل *' : 'المورد *'}
              {isEditMode && <span className="text-xs text-blue-500 mr-1">(يمكن التغيير)</span>}
            </label>
            {isCustomer ? (
              <CustomerSearch
                key={existingReturn?._id || 'new'}
                onSelect={c => { setParty(c); setPartyError(false); }}
                error={partyError}
                defaultValue={party?.name || ''}
              />
            ) : (
              <SupplierSearch
                key={existingReturn?._id || 'new'}
                onSelect={s => { setParty(s); setPartyError(false); }}
                error={partyError}
                defaultValue={party?.name || ''}
              />
            )}
            {party && <p className="text-xs text-green-600 mt-0.5 font-medium">✓ {party.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">رقم الفاتورة الأصلية</label>
            <input className="input-field" value={originalInvoice} onChange={e => setOriginalInvoice(e.target.value)} placeholder="اختياري" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ملاحظات</label>
            <input className="input-field" value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري" />
          </div>
        </div>

        {/* رد الأموال — مرتجع عميل فقط */}
        {isCustomer && (
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-semibold text-gray-600 mb-3">💵 رد الأموال للعميل</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">طريقة رد الأموال</label>
                <select className="input-field" value={refundMethod}
                  onChange={e => { setRefundMethod(e.target.value); setRefundCashAmount(''); setRefundBankAmount(''); }}>
                  <option value="none">آجل — مش فيه رد نقدي</option>
                  <option value="cash">نقدي — من خزنة الأدمن</option>
                  <option value="bank">بنكي / انستاباي</option>
                  <option value="mixed">مختلط (نقدي + بنكي)</option>
                </select>
              </div>
              {(refundMethod === 'cash' || refundMethod === 'mixed') && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">المبلغ النقدي</label>
                  <input type="number" min="0" step="0.01" className="input-field"
                    placeholder="0.00 ج.م" value={refundCashAmount} onChange={e => setRefundCashAmount(e.target.value)} />
                  <p className="text-xs text-amber-600 mt-1">⚠️ سيُخصم من خزنة الأدمن الذي يوافق</p>
                </div>
              )}
              {(refundMethod === 'bank' || refundMethod === 'mixed') && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">المبلغ البنكي</label>
                  <input type="number" min="0" step="0.01" className="input-field"
                    placeholder="0.00 ج.م" value={refundBankAmount} onChange={e => setRefundBankAmount(e.target.value)} />
                  <p className="text-xs text-blue-600 mt-1">سيُخصم من خزنة البنك</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ✅ الكومبونانت المشترك */}
      <div className="card mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          الأصناف {savedRows.length > 0 && `(${savedRows.length})`}
        </h2>
        <InvoiceItemsForm
          rows={rows}
          totalWeightInput={totalWeightInput}
          showPrice={true}
          qtyRefs={qtyRefs}
          wtRefs={wtRefs}
          prRefs={prRefs}
          twRefs={twRefs}
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

      {/* الإجمالي */}
      {savedRows.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-start">
            <div className="text-sm text-gray-500 space-y-1">
              <p>عدد الأصناف: <span className="font-medium text-gray-700">{savedRows.length}</span></p>
              <p>إجمالي الوزن: <span className="font-medium text-gray-700">{cleanNum(totalWeightAll, 3)} كيلو</span></p>
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-500 mb-1">الإجمالي الكلي</p>
              <p className="text-3xl font-bold text-orange-600">{cleanNum(totalAmount, 2)}</p>
              <p className="text-sm text-gray-400">جنيه مصري</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
