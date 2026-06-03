import { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { createPurchaseInvoice } from '../../store/slices/purchaseSlice';
import SupplierSearch from '../../components/common/SupplierSearch';
import api from '../../services/api';
import toast from 'react-hot-toast';
import InvoiceItemsForm from '../../components/common/InvoiceItemsForm';

const newRow = () => ({
  id: Date.now() + Math.random(),
  item: null, itemCode: '', itemName: '', unit: '',
  unitWeight: 0,    // وزن الوحدة الافتراضي (default من الصنف)
  quantity: '', price: '',
  availableQty: undefined, availableWeight: undefined,
  _totalWeight: null,
  saved: false, editing: false,
});

const r2 = (v) => Math.round((parseFloat(v)||0) * 100) / 100;
const r3 = (v) => Math.round((parseFloat(v)||0) * 1000) / 1000;
const calcTotalWeight = (q, w, tw = null) =>
  tw != null ? r3(parseFloat(tw)) : r3((parseFloat(q)||0) * (parseFloat(w)||0));
const calcTotal = (q, w, p, tw = null) =>
  r2(calcTotalWeight(q, w, tw) * (parseFloat(p)||0));

const statusLabel = {
  pending:   { text: 'معلق',   cls: 'bg-yellow-100 text-yellow-700' },
  approved:  { text: 'مُوافق', cls: 'bg-green-100 text-green-700'  },
  suspended: { text: 'موقوف', cls: 'bg-orange-100 text-orange-700' },
  cancelled: { text: 'ملغي',  cls: 'bg-red-100 text-red-700'      },
};

const fmt = (n) => Number(n||0).toFixed(2);

// ── View Mode ──────────────────────────────────────────────────────────────────
function PurchaseViewMode({ invoice, onBack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const backTo    = location.state?.backTo;
  const backLabel = location.state?.backLabel || 'رجوع';

  const qw = (q, w) => (q||0) * (w||0);
  const t  = (q, w, p) => (q||0) * (w||0) * (p||0);
  const st = statusLabel[invoice.status] || statusLabel.pending;

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (backTo)  { navigate(backTo); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/purchase');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex gap-2 mb-4 no-print">
        <button className="btn-primary" onClick={() => window.print()}>🖨️ طباعة</button>
        <button className="btn-secondary" onClick={handleBack}>← {backLabel}</button>
        {backTo && (
          <Link to={backTo} className="text-sm text-blue-500 hover:underline flex items-center">
            العودة للكشف
          </Link>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-8 print:border-none print:p-0">
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">الشركة العالمية للاستيراد والتصدير</h1>
            <p className="text-gray-500 text-sm mt-1">فاتورة توريد</p>
          </div>
          <div className="text-left">
            <p className="text-xs text-gray-400">رقم الفاتورة</p>
            <p className="text-xl font-bold text-blue-700">{invoice.invoiceNumber}</p>
            <p className="text-xs text-gray-400 mt-1">رقم المستند</p>
            <p className="font-bold text-gray-800">{invoice.docNumber}</p>
            <span className={`mt-1 text-xs px-2 py-0.5 rounded-full font-medium inline-block ${st.cls}`}>{st.text}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">بيانات المورد</p>
            <p className="font-bold text-gray-800 text-lg">{invoice.supplierName}</p>
            <p className="text-gray-500 text-sm">كود: {invoice.supplierCode}</p>
          </div>
          <div className="text-left">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: 'التاريخ', value: new Date(invoice.date).toLocaleDateString('ar-EG') },
                { label: 'الوقت',   value: new Date(invoice.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) },
                { label: 'المخزن',  value: invoice.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر' },
                { label: 'بواسطة',  value: invoice.createdBy?.name },
                { label: 'الموسم',  value: invoice.season?.name },
              ].filter(x => x.value).map((x, i) => (
                <div key={i}>
                  <p className="text-xs text-gray-400">{x.label}</p>
                  <p className="font-medium text-gray-700">{x.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#eee', fontWeight: 'bold', borderBottom: '2px solid #333' }}>
              {['#','الكود','الصنف','العدد','وزن/وحدة','وزن كلي','السعر/ك','الإجمالي'].map((h,i) => (
                <th key={i} className={`px-3 py-2 ${i>2?'text-center':'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, idx) => (
              <tr key={idx} style={{ background: idx%2===0?'#f8fafc':'white', borderBottom: '1px solid #e2e8f0' }}>
                <td className="px-3 py-2 text-gray-400 text-center text-xs">{idx+1}</td>
                <td className="px-3 py-2 font-mono text-blue-600 text-xs">{item.itemCode}</td>
                <td className="px-3 py-2 font-medium text-gray-800">{item.itemName}</td>
                <td className="px-3 py-2 text-center font-medium">{item.quantity}</td>
                <td className="px-3 py-2 text-center text-xs text-gray-400">{fmt(item.weight)}</td>
                <td className="px-3 py-2 text-center font-medium">{fmt(qw(item.quantity, item.weight))}</td>
                <td className="px-3 py-2 text-center">{fmt(item.price)}</td>
                <td className="px-3 py-2 text-center font-semibold">{fmt(t(item.quantity, item.weight, item.price))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#eee', fontWeight: 'bold', borderTop: '2px solid #333' }}>
              <td colSpan={5} className="px-3 py-2 text-right">الإجمالي</td>
              <td className="px-3 py-2 text-center">{fmt(invoice.totalWeight)} ك</td>
              <td></td>
              <td className="px-3 py-2 text-center text-lg">{fmt(invoice.totalAmount)} ج.م</td>
            </tr>
          </tfoot>
        </table>
        {invoice.notes && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">ملاحظات</p>
            <p className="text-sm text-gray-700">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PurchaseInvoicePage() {
  const dispatch  = useDispatch();
  const { id }    = useParams();
  const isViewMode = !!id;
  const { user }  = useSelector(s => s.auth);
  const isAdmin   = user?.role === 'admin';
  const { activeSeason } = useSelector(s => s.season);

  const [existingInvoice,  setExistingInvoice]  = useState(null);
  const [supplier,         setSupplier]         = useState(null);
  const [supplierError,    setSupplierError]    = useState(false);
  const [docNumber,        setDocNumber]        = useState('');
  const [docError,         setDocError]         = useState('');
  const [docChecking,      setDocChecking]      = useState(false);
  const [date,             setDate]             = useState(new Date().toISOString().split('T')[0]);
  const [warehouse,        setWarehouse]        = useState(user?.warehouse === 'october' ? 'october' : 'ramses');
  const [notes,            setNotes]            = useState('');
  const [rows,             setRows]             = useState([newRow()]);
  const [saving,           setSaving]           = useState(false);
  const [editingInvoice,   setEditingInvoice]   = useState(null);
  const [editNotes,        setEditNotes]        = useState('');
  const [showAdminSearch,  setShowAdminSearch]  = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [searchResults,    setSearchResults]    = useState([]);
  const [searchLoading,    setSearchLoading]    = useState(false);
  const [totalWeightInput, setTotalWeightInput] = useState({});

  const qtyRefs  = useRef({});
  const wtRefs   = useRef({});
  const twRefs   = useRef({});
  const prRefs   = useRef({});
  const itemRefs = useRef({});
  const docTimer = useRef(null);
  const srchTimer= useRef(null);

  useEffect(() => {
    if (isViewMode) {
      api.get(`/purchase/${id}`)
        .then(({ data }) => setExistingInvoice(data))
        .catch(() => toast.error('خطأ في تحميل الفاتورة'));
    }
  }, [isViewMode, id]);

  const checkDoc = useCallback(async (val, excludeId=null) => {
    if (!val.trim()) { setDocError(''); return; }
    setDocChecking(true);
    try {
      const params = { docNumber: val, seasonId: activeSeason?._id };
      if (excludeId) params.excludeId = excludeId;
      const { data } = await api.get('/purchase/check-doc', { params });
      setDocError(data.exists ? `⚠️ رقم المستند "${val}" موجود في هذا الموسم` : '');
    } catch { setDocError(''); }
    finally { setDocChecking(false); }
  }, [activeSeason]);

  const handleDocChange = (val) => {
    setDocNumber(val); setDocError('');
    clearTimeout(docTimer.current);
    docTimer.current = setTimeout(() => checkDoc(val, editingInvoice?._id), 600);
  };

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const { data } = await api.get('/purchase', { params: { search: q } });
      const results = Array.isArray(data) ? data : (data.invoices ?? data.data ?? []);
      setSearchResults(results.slice(0, 10));
    } catch {} finally { setSearchLoading(false); }
  }, []);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    clearTimeout(srchTimer.current);
    srchTimer.current = setTimeout(() => doSearch(val), 400);
  };

  const loadForEdit = async (inv) => {
    const { data } = await api.get(`/purchase/${inv._id}`);
    setEditingInvoice(data);
    setSearchResults([]); setSearchQuery(''); setShowAdminSearch(false);
    setDocNumber(data.docNumber);
    setDate(data.date?.split('T')[0] || new Date().toISOString().split('T')[0]);
    setWarehouse(data.warehouse);
    setNotes(data.notes || ''); setEditNotes('');
    const sup = data.supplier || { _id: data.supplierId, code: data.supplierCode, name: data.supplierName };
    setSupplier(sup); setSupplierError(false);
    const loaded = data.items.map(item => {
      const uw = parseFloat(item.weight) || 0;
      const tw = item.totalWeight != null
        ? parseFloat(item.totalWeight)
        : Math.round((parseFloat(item.quantity)||0) * uw * 1000) / 1000;
      const qty = uw > 0 && tw > 0 ? Math.round((tw / uw) * 10000) / 10000 : (parseFloat(item.quantity) || 0);
      return {
        id: Date.now() + Math.random(),
        item: item.itemId || item.item?._id || item.item,
        itemCode: item.itemCode, itemName: item.itemName, unit: item.unit || '',
        unitWeight: uw, quantity: String(qty), price: String(item.price),
        _totalWeight: tw,
        availableQty: undefined, availableWeight: undefined,
        saved: true, editing: false,
      };
    });
    const twMap = {};
    loaded.forEach(r => { if (r._totalWeight) twMap[r.id] = String(r._totalWeight); });
    setRows([...loaded, newRow()]);
    setTotalWeightInput(twMap);
    toast.success(`تم تحميل ${data.invoiceNumber} للتعديل`);
  };

  const cancelEdit = () => {
    setEditingInvoice(null); setEditNotes('');
    setSupplier(null); setDocNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes(''); setRows([newRow()]); setDocError('');
    setTotalWeightInput({});
  };

  // ── item handlers ──────────────────────────────────────────────────────────
  const handleItemSelect = (rowId, item) => {
    if (!item) return;
    const stockQty   = item.stock?.[warehouse]?.quantity ?? undefined;
    const stockWt    = item.stock?.[warehouse]?.weight   ?? undefined;
    const unitWeight = parseFloat(item.defaultWeight) || 0;
    setRows(prev => prev.map(r => r.id === rowId ? {
      ...r, item: item._id, itemCode: item.code, itemName: item.name, unit: item.unit || '',
      unitWeight,
      availableQty: stockQty, availableWeight: stockWt,
    } : r));
    setTimeout(() => qtyRefs.current[rowId]?.focus(), 50);
  };

  const updateRow = (rowId, field, value) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));

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
      const uw = parseFloat(r.unitWeight) || 0;
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
    if (!row?.item)       { toast.error('اختار الصنف أولاً');       return; }
    if (!row.unitWeight)  { toast.error('أدخل وزن/وحدة');            return; }
    const tw = row._totalWeight ?? Math.round((parseFloat(row.quantity)||0) * (parseFloat(row.unitWeight)||0) * 1000) / 1000;
    if (tw <= 0)          { toast.error('أدخل الوزن الكلي أو العدد'); return; }
    if (!row.price)       { toast.error('أدخل السعر');               return; }
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
  const handleDeleteRow = (rowId) => {
    setRows(prev => { const f = prev.filter(r => r.id !== rowId); return f.length === 0 ? [newRow()] : f; });
  };

  const savedRows   = rows.filter(r => r.saved);
  const totalAmount = r2(savedRows.reduce((s,r) => s + calcTotal(r.quantity,r.weight,r.price,r._totalWeight), 0));
  const totalWeight = r3(savedRows.reduce((s,r) => s + calcTotalWeight(r.quantity,r.weight,r._totalWeight), 0));
  const totalQty    = savedRows.reduce((s,r) => s + (parseFloat(r.quantity)||0), 0);

  const handleSubmit = async () => {
    if (!supplier) { setSupplierError(true); toast.error('اختار المورد'); return; }
    if (!docNumber.trim()) { toast.error('أدخل رقم المستند'); return; }
    if (docError) { toast.error(docError); return; }
    if (savedRows.length === 0) { toast.error('أضف صنف واحد على الأقل'); return; }
    setSaving(true);
    const itemsPayload = savedRows.map(r => {
      const uw  = parseFloat(r.unitWeight) || 0;
      const tw  = r._totalWeight ?? Math.round((parseFloat(r.quantity)||0) * uw * 1000) / 1000;
      const pr  = parseFloat(r.price) || 0;
      const qty = uw > 0 ? tw / uw : (parseFloat(r.quantity) || 0);
      return {
        item: r.item, itemCode: r.itemCode, itemName: r.itemName,
        quantity: qty, weight: uw,        // ✅ ARCH-001: weight = unitWeight
        price: pr, totalWeight: tw,       // ✅ المصدر الحقيقي
        total: Math.round(tw * pr * 100) / 100,
      };
    });
    const base = {
      docNumber: docNumber.trim(), date,
      supplierId: supplier._id || supplier, supplierCode: supplier.code, supplierName: supplier.name,
      warehouse, notes, items: itemsPayload,
    };
    try {
      if (editingInvoice) {
        const { data } = await api.put(`/purchase/${editingInvoice._id}/force-edit`, { ...base, editNotes });
        toast.success(`تم تعديل ${data.invoice.invoiceNumber} ✅`);
        cancelEdit();
      } else {
        const res = await dispatch(createPurchaseInvoice(base));
        if (!res.error) {
          toast.success(`تم حفظ الفاتورة ${res.payload.invoiceNumber} ✅`);
          setSupplier(null); setDocNumber(''); setDate(new Date().toISOString().split('T')[0]);
          setNotes(''); setRows([newRow()]); setDocError(''); setSupplierError(false);
          setTotalWeightInput({});
        } else { toast.error(res.payload || 'خطأ في الحفظ'); }
      }
    } catch (err) { toast.error(err.response?.data?.message || 'خطأ'); }
    setSaving(false);
  };

  if (isViewMode) {
    if (!existingInvoice) return <div className="text-center py-20 text-gray-400">جاري تحميل الفاتورة...</div>;
    return <PurchaseViewMode invoice={existingInvoice} />;
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── هيدر ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {editingInvoice ? `✏️ تعديل — ${editingInvoice.invoiceNumber}` : 'فاتورة توريد جديدة'}
          </h1>
          {editingInvoice && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel[editingInvoice.status]?.cls}`}>
                {statusLabel[editingInvoice.status]?.text}
              </span>
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                ⚠️ بعد الحفظ ستصبح معلقة وتحتاج موافقة جديدة
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {editingInvoice && <button onClick={cancelEdit} className="btn-secondary text-sm">× إلغاء</button>}
          <button className="btn-primary" onClick={handleSubmit}
            disabled={saving || savedRows.length === 0 || !!docError}>
            {saving ? 'جاري الحفظ...' : editingInvoice
              ? `💾 حفظ التعديل (${savedRows.length} صنف)`
              : `💾 حفظ (${savedRows.length} صنف)`}
          </button>
        </div>
      </div>

      {/* بحث أدمن */}
      {isAdmin && !editingInvoice && (
        <div className="card mb-4 border-2 border-purple-200 bg-purple-50">
          <button onClick={() => setShowAdminSearch(!showAdminSearch)}
            className="w-full flex items-center justify-between text-sm font-semibold text-purple-700">
            <span>🔍 بحث عن فاتورة توريد للتعديل (أدمن فقط)</span>
            <span>{showAdminSearch ? '▲' : '▼'}</span>
          </button>
          {showAdminSearch && (
            <div className="mt-3">
              <input className="input-field"
                placeholder="ابحث بـ: رقم الفاتورة أو رقم المستند أو اسم المورد..."
                value={searchQuery} onChange={e => handleSearchChange(e.target.value)} autoFocus />
              {searchLoading && <p className="text-xs text-gray-400 mt-1">جاري البحث...</p>}
              {searchResults.length > 0 && (
                <div className="border border-purple-200 rounded-xl overflow-hidden mt-2 bg-white">
                  {searchResults.map(inv => (
                    <button key={inv._id} onClick={() => loadForEdit(inv)}
                      className="w-full text-right px-4 py-3 hover:bg-purple-50 border-b border-purple-100 last:border-0 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-blue-600 text-sm">{inv.invoiceNumber}</span>
                          <span className="font-medium text-gray-800">{inv.supplierName}</span>
                          <span className="text-gray-400 text-xs">{inv.docNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{fmt(inv.totalAmount)} ج.م</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusLabel[inv.status]?.cls}`}>
                            {statusLabel[inv.status]?.text}
                          </span>
                          <span className="text-xs text-purple-600 font-medium">تعديل ←</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery && !searchLoading && searchResults.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">مفيش نتائج</p>
              )}
            </div>
          )}
        </div>
      )}

      {editingInvoice && (
        <div className="card mb-4 border-2 border-amber-200 bg-amber-50">
          <label className="block text-sm font-semibold text-amber-700 mb-1">📝 سبب التعديل (اختياري)</label>
          <input className="input-field" placeholder="مثلاً: تصحيح سعر..."
            value={editNotes} onChange={e => setEditNotes(e.target.value)} />
        </div>
      )}

      {/* رأس الفاتورة */}
      <div className="card mb-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4 pb-2 border-b">بيانات الفاتورة</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">رقم المستند *</label>
            <input className={`input-field ${docError ? 'border-red-500 ring-2 ring-red-100' : ''}`}
              placeholder="رقم المستند" value={docNumber} onChange={e => handleDocChange(e.target.value)} />
            {docChecking && <p className="text-xs text-gray-400 mt-1">جاري التحقق...</p>}
            {docError && <p className="text-xs text-red-500 mt-1">{docError}</p>}
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
            <label className="block text-sm font-medium text-gray-600 mb-1">المورد *</label>
            <SupplierSearch onSelect={s => { setSupplier(s); setSupplierError(false); }} error={supplierError} />
            {supplier && <p className="text-xs text-green-600 mt-0.5 font-medium">✓ {supplier.name}</p>}
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-600 mb-1">ملاحظات</label>
          <input className="input-field" placeholder="اختياري..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* ✅ الكومبونانت المشترك */}
      <div className="card mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
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
              <p>إجمالي الكراتين: <span className="font-medium text-gray-700">{totalQty.toFixed(3)}</span></p>
              <p>إجمالي الوزن: <span className="font-medium text-gray-700">{totalWeight.toFixed(3)} كيلو</span></p>
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-500 mb-1">الإجمالي الكلي</p>
              <p className="text-3xl font-bold text-blue-600">{totalAmount.toFixed(2)}</p>
              <p className="text-sm text-gray-400">جنيه مصري</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
