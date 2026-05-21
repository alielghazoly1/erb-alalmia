// ─── TransferPage.jsx ──────────────────────────────────────────────────────────
// إذن تحويل — فورم مطابق لفاتورة المبيعات بالضبط
// ✅ عرض المخزون المتاح عند اختيار الصنف (من الموسم النشط)
// ✅ تغيير المخزن يحدّث الكميات المتاحة لكل الأصناف
// ✅ الحفظ + تعديل
import { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { createTransfer, updateTransfer, fetchTransferById } from '../../store/slices/transferSlice';
import ItemSearch from '../../components/common/ItemSearch';
import api from '../../services/api';
import toast from 'react-hot-toast';

const newRow = () => ({
  id: Date.now() + Math.random(),
  item: null, itemCode: '', itemName: '', unit: '',
  quantity: '', weight: '',
  availableQty: undefined,
  saved: false, editing: false,
});

const calcTW = (qty, wt) => (parseFloat(qty) || 0) * (parseFloat(wt) || 0);

export default function TransferPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { id }    = useParams();
  const isEdit    = !!id;

  const { user }    = useSelector(s => s.auth);
  const { current } = useSelector(s => s.transfers);
  const { activeSeason } = useSelector(s => s.season);
  const isAdmin = user?.role === 'admin';

  const defaultFrom = user?.warehouse === 'october' ? 'october' : 'ramses';
  const [fromWarehouse, setFromWarehouse] = useState(defaultFrom);
  const [toWarehouse,   setToWarehouse]   = useState(defaultFrom === 'ramses' ? 'october' : 'ramses');
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0]);
  const [notes,   setNotes]   = useState('');
  const [rows,    setRows]    = useState([newRow()]);
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(isEdit);
  const [existingStatus, setExistingStatus] = useState('pending');

  const [docNumber,   setDocNumber]   = useState('');
  const [docError,    setDocError]    = useState('');
  const [docChecking, setDocChecking] = useState(false);
  const docTimer = useRef(null);

  const qtyRefs  = useRef({});
  const wtRefs   = useRef({});
  const itemRefs = useRef({});

  // ── تحميل بيانات التحويل للتعديل ───────────────────────────────────────
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

      const loaded = data.items.map(item => ({
        id:       Date.now() + Math.random(),
        item:     item.item?._id || item.item,
        itemCode: item.itemCode,
        itemName: item.itemName,
        unit:     item.unit || '',
        quantity: String(item.quantity),
        weight:   String(item.weight),
        availableQty: undefined,
        saved: true, editing: false,
      }));
      setRows([...loaded, newRow()]);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // ── تحديث stock المتاح لما المخزن يتغير ────────────────────────────────
  const refreshStockForWarehouse = useCallback(async (warehouse) => {
    const savedItemIds = rows.filter(r => r.saved && r.item).map(r => r.item);
    if (!savedItemIds.length) return;
    try {
      const seasonId = activeSeason?._id;
      const results = await Promise.all(
        savedItemIds.map(id => api.get(`/items/${id}/stock`, { params: seasonId ? { seasonId } : {} }))
      );
      const stockByItem = {};
      results.forEach(({ data }, i) => { stockByItem[savedItemIds[i]] = data.stock; });
      setRows(prev => prev.map(r => {
        if (!r.saved || !r.item || !stockByItem[r.item]) return r;
        return { ...r, availableQty: stockByItem[r.item]?.[warehouse]?.quantity ?? 0 };
      }));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeSeason]);

  // ── التحقق من رقم المستند ───────────────────────────────────────────────
  const checkDocNumber = useCallback(async (val) => {
    if (!val?.trim() || !fromWarehouse) { setDocError(''); return; }
    const direction = fromWarehouse === 'ramses' ? 'R2O' : 'O2R';
    setDocChecking(true);
    try {
      const params = { docNumber: val.trim(), direction };
      if (activeSeason?._id) params.seasonId = activeSeason._id;
      if (isEdit && id) params.excludeId = id;
      const { data } = await api.get('/transfers/check-doc', { params });
      setDocError(data.exists
        ? `⚠️ رقم المستند "${val}" موجود بالفعل (${data.transferNumber})`
        : '');
    } catch { setDocError(''); }
    finally { setDocChecking(false); }
  }, [fromWarehouse, activeSeason, isEdit, id]);

  const handleDocChange = (val) => {
    setDocNumber(val);
    setDocError('');
    clearTimeout(docTimer.current);
    docTimer.current = setTimeout(() => checkDocNumber(val), 500);
  };

  // ── اختيار صنف ──────────────────────────────────────────────────────────
  const handleItemSelect = async (rowId, item) => {
    if (!item) return;
    // جيب المخزون المتاح من الموسم النشط
    let availableQty = undefined;
    try {
      const seasonId = activeSeason?._id;
      const { data } = await api.get(`/items/${item._id}/stock`, {
        params: seasonId ? { seasonId } : {},
      });
      availableQty = data.stock?.[fromWarehouse]?.quantity ?? 0;
    } catch {}

    setRows(prev => prev.map(r =>
      r.id === rowId ? {
        ...r, item: item._id, itemCode: item.code, itemName: item.name, unit: item.unit || '',
        weight: item.defaultWeight ? String(item.defaultWeight) : r.weight,
        availableQty,
      } : r
    ));
    setTimeout(() => qtyRefs.current[rowId]?.focus(), 50);
  };

  const updateRow = (rowId, field, val) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: val } : r));

  const handleKeyDown = (e, rowId, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (field === 'quantity') { wtRefs.current[rowId]?.focus(); return; }
    if (field === 'weight')   { handleSaveRow(rowId); }
  };

  const handleSaveRow = (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row?.item)                   { toast.error('اختار الصنف أولاً'); return; }
    if (!row.quantity || !row.weight) { toast.error('اكمل بيانات الصنف'); return; }
    setRows(prev => {
      const upd = prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r);
      return [...upd, newRow()];
    });
  };

  const handleEditRow   = (rowId) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: false, editing: true } : r));
  const handleDeleteRow = (rowId) => setRows(prev => { const f = prev.filter(r => r.id !== rowId); return f.length ? f : [newRow()]; });

  const handleFromChange = async (val) => {
    setFromWarehouse(val);
    setToWarehouse(val === 'ramses' ? 'october' : 'ramses');
    await refreshStockForWarehouse(val);
  };

  const savedRows     = rows.filter(r => r.saved);
  const totalWeight   = savedRows.reduce((s, r) => s + calcTW(r.quantity, r.weight), 0);
  const totalQuantity = savedRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
  const isApprovedEdit = isEdit && existingStatus === 'approved';

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
      items: savedRows.map(r => ({
        item: r.item, itemCode: r.itemCode, itemName: r.itemName,
        quantity: Number(r.quantity), weight: Number(r.weight),
      })),
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

      {/* ── جدول الأصناف المحفوظة ── */}
      {savedRows.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
            الأصناف ({savedRows.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-right px-3 py-2">#</th>
                  <th className="text-right px-3 py-2">الكود</th>
                  <th className="text-right px-3 py-2">الصنف</th>
                  <th className="text-center px-3 py-2">متاح</th>
                  <th className="text-center px-3 py-2">العدد</th>
                  <th className="text-center px-3 py-2">وزن/وحدة</th>
                  <th className="text-center px-3 py-2">وزن كلي</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {savedRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-center text-xs">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-blue-600 text-xs">{row.itemCode}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{row.itemName}</td>
                    <td className="px-3 py-2.5 text-center">
                      {row.availableQty !== undefined ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          row.availableQty <= 0 ? 'bg-red-100 text-red-600' :
                          row.availableQty < 5  ? 'bg-amber-100 text-amber-700' :
                                                   'bg-green-100 text-green-700'
                        }`}>
                          {row.availableQty} ك
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold">{row.quantity}</td>
                    <td className="px-3 py-2.5 text-center text-gray-400 text-xs">
                      {parseFloat(row.weight).toFixed(3)} ك
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-blue-700">
                      {calcTW(row.quantity, row.weight).toFixed(3)} ك
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => handleEditRow(row.id)} className="text-blue-500 text-xs p-1 rounded hover:bg-blue-50">✏️</button>
                      <button onClick={() => handleDeleteRow(row.id)} className="text-red-400 text-xs p-1 rounded hover:bg-red-50">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 font-semibold text-xs">
                  <td colSpan={4} className="px-3 py-2 text-right text-gray-600">الإجمالي</td>
                  <td className="px-3 py-2 text-center text-blue-700">{totalQuantity} كرتونة</td>
                  <td></td>
                  <td className="px-3 py-2 text-center text-blue-700">{totalWeight.toFixed(3)} ك</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── صف إدخال الصنف (sticky مثل فاتورة المبيعات) ── */}
      {rows.filter(r => !r.saved).map(row => (
        <div
          key={row.id}
          className={`rounded-xl border-2 p-3 sticky bottom-0 z-10 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] ${
            row.editing ? 'border-amber-400 bg-amber-50/95' : 'border-blue-200 bg-blue-50/95'
          }`}
        >
          {/* info header */}
          {row.itemName && (
            <p className="text-xs text-green-600 mt-0.5 mb-1 font-medium truncate">✓ {row.itemName}</p>
          )}
          {row.availableQty !== undefined && (
            <p className={`text-xs mb-1 ${
              row.availableQty <= 0 ? 'text-red-500' : row.availableQty < 5 ? 'text-amber-600' : 'text-green-600'
            }`}>
              {row.availableQty <= 0 ? '⚠️ لا يوجد رصيد كافٍ' : `🟢 متاح في ${warehouseLabel(fromWarehouse)}: ${row.availableQty} كرتون`}
            </p>
          )}
          <p className="text-xs font-semibold text-gray-500 mb-2">
            {row.editing ? '✏️ تعديل صنف' : '➕ أضف صنف'}
          </p>

          <div className="grid grid-cols-12 gap-2 items-end">
            {/* الصنف */}
            <div className="col-span-5">
              <label className="block text-xs font-medium text-gray-500 mb-1">الصنف *</label>
              <ItemSearch
                onSelect={item => handleItemSelect(row.id, item)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); qtyRefs.current[row.id]?.focus(); } }}
                placeholder="ابحث بالكود أو الاسم..."
                getFocusTrigger={fn => { itemRefs.current[row.id] = fn; }}
                defaultValue={row.editing ? row.itemName : ''}
              />
            </div>

            {/* العدد */}
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                العدد (كراتين)
                {row.weight && <span className="text-blue-400 mr-1 text-xs">×{row.weight}ك</span>}
              </label>
              <input
                ref={el => (qtyRefs.current[row.id] = el)}
                type="number" min="0" step="1"
                className="input-field text-center font-bold text-lg"
                placeholder="0"
                value={row.quantity}
                onChange={e => updateRow(row.id, 'quantity', e.target.value)}
                onKeyDown={e => handleKeyDown(e, row.id, 'quantity')}
              />
              {row.quantity && row.weight && (
                <p className="text-xs text-blue-500 mt-0.5 text-center">
                  = {calcTW(row.quantity, row.weight).toFixed(3)} كيلو
                </p>
              )}
            </div>

            {/* الوزن */}
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">وزن الكرتونة (كيلو)</label>
              <input
                ref={el => (wtRefs.current[row.id] = el)}
                type="number" min="0" step="0.001"
                className="input-field text-center"
                placeholder="0.000"
                value={row.weight}
                onChange={e => updateRow(row.id, 'weight', e.target.value)}
                onKeyDown={e => handleKeyDown(e, row.id, 'weight')}
              />
            </div>

            {/* الوزن الكلي */}
            <div className="col-span-1 flex flex-col items-center gap-1">
              <p className="text-xs text-gray-400">الكلي</p>
              <p className="text-sm font-bold text-blue-700 leading-tight">
                {calcTW(row.quantity, row.weight).toFixed(2)}
              </p>
            </div>
          </div>

          {/* زر الإضافة */}
          <div className="flex gap-2 items-center mt-2">
            <button
              onClick={() => handleSaveRow(row.id)}
              className="btn-primary px-6 py-2"
              disabled={!row.item || !row.quantity || !row.weight}
            >
              {row.editing ? '✓ تحديث' : '✓ إضافة'}
            </button>
            {row.editing && (
              <button onClick={() => handleDeleteRow(row.id)} className="btn-secondary px-4 py-2">إلغاء</button>
            )}
          </div>
        </div>
      ))}

      {/* ── بطاقة الإجمالي ── */}
      {savedRows.length > 0 && (
        <div className="card bg-blue-50 border border-blue-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 space-y-1">
              <p>عدد الأصناف: <span className="font-bold text-gray-800">{savedRows.length}</span></p>
              <p>إجمالي الكراتين: <span className="font-bold text-gray-800">{totalQuantity}</span></p>
              <p className="text-xs text-gray-500">
                {warehouseLabel(fromWarehouse)} ← {warehouseLabel(toWarehouse)}
              </p>
              {activeSeason && (
                <p className="text-xs text-blue-600">🌿 الموسم: {activeSeason.name}</p>
              )}
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-500 mb-1">إجمالي الوزن المحوّل</p>
              <p className="text-3xl font-bold text-blue-700">{totalWeight.toFixed(2)}</p>
              <p className="text-sm text-gray-400">كيلو</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
