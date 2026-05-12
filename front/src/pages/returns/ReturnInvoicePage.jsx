import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { createReturn } from '../../store/slices/returnSlice';
import CustomerSearch from '../../components/common/CustomerSearch';
import SupplierSearch from '../../components/common/SupplierSearch';
import ItemSearch from '../../components/common/ItemSearch';
import api from '../../services/api';
import toast from 'react-hot-toast';

const calcTotal = (q, w, p) =>
  (parseFloat(q) || 0) * (parseFloat(w) || 0) * (parseFloat(p) || 0);
const calcTotalWeight = (q, w) => (parseFloat(q) || 0) * (parseFloat(w) || 0);

const newRow = () => ({
  id: Date.now() + Math.random(),
  item: null,
  itemCode: '',
  itemName: '',
  unit: '',
  unitWeight: 0,
  quantity: '',
  weight: '',
  price: '',
  saved: false,
  editing: false,
});

export default function ReturnInvoicePage({ type = 'customer_return' }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const isCustomer = type === 'customer_return';

  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';

  // state
  const [party, setParty] = useState(null);
  const [partyError, setPartyError] = useState(false);
  const [docNumber, setDocNumber] = useState('');
  const [originalInvoice, setOriginalInvoice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [warehouse, setWarehouse] = useState('ramses');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([newRow()]);
  const [saving, setSaving] = useState(false);
  const [totalWeightInput, setTotalWeightInput] = useState({});
  const [loadingEdit, setLoadingEdit] = useState(isEditMode);
  const [existingReturn, setExistingReturn] = useState(null);
  const [refundMethod, setRefundMethod] = useState('none');
  const [refundCashAmount, setRefundCashAmount] = useState('');
  const [refundBankAmount, setRefundBankAmount] = useState('');

  const qtyRefs = useRef({});
  const wtRefs  = useRef({});
  const prRefs  = useRef({});

  // تحميل المرتجع للتعديل
  useEffect(() => {
    if (!isEditMode) return;
    api
      .get(`/returns/${id}`)
      .then(({ data }) => {
        // مرتجع مرفوض → لا يمكن تعديله أبداً
        if (data.status === 'rejected') {
          toast.error('لا يمكن تعديل مرتجع مرفوض');
          navigate(-1);
          return;
        }
        // مرتجع معتمد → الأدمن فقط
        if (data.status === 'approved' && !isAdmin) {
          toast.error('فقط الأدمن يمكنه تعديل مرتجع معتمد');
          navigate(-1);
          return;
        }

        setExistingReturn(data);
        setDocNumber(data.docNumber || '');
        setOriginalInvoice(data.originalInvoice || '');
        setDate(
          data.date
            ? data.date.split('T')[0]
            : new Date().toISOString().split('T')[0],
        );
        setWarehouse(data.warehouse || 'ramses');
        setNotes(data.notes || '');
        setRefundMethod(data.refundMethod || 'none');
        setRefundCashAmount(
          data.refundCashAmount ? String(data.refundCashAmount) : '',
        );
        setRefundBankAmount(
          data.refundBankAmount ? String(data.refundBankAmount) : '',
        );

        if (isCustomer && data.customerCode) {
          setParty({
            _id: data.customer?._id || data.customer,
            code: data.customerCode,
            name: data.customerName,
          });
        } else if (!isCustomer && data.supplierCode) {
          setParty({
            _id: data.supplier?._id || data.supplier,
            code: data.supplierCode,
            name: data.supplierName,
          });
        }

        const loaded = data.items.map((item) => ({
          id: Date.now() + Math.random(),
          item: item.item?._id || item.item,
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit || '',
          unitWeight: item.weight,
          quantity: String(item.quantity),
          weight: String(item.weight),
          price: String(item.price),
          saved: true,
          editing: false,
        }));
        setRows([...loaded, newRow()]);
        setLoadingEdit(false);
      })
      .catch(() => {
        toast.error('خطأ في تحميل المرتجع');
        navigate(-1);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  // item handlers
  const handleItemSelect = (rowId, item) => {
    if (!item) return;
    const unitWeight = item.defaultWeight || 0;
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              item: item._id,
              itemCode: item.code,
              itemName: item.name,
              unit: item.unit,
              unitWeight,
              weight: unitWeight ? String(unitWeight) : r.weight,
            }
          : r,
      ),
    );
    setTimeout(() => qtyRefs.current[rowId]?.focus(), 50);
  };

  const updateRow = (rowId, field, val) =>
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: val } : r)),
    );

  const handleTotalWeightChange = (rowId, totalWt) => {
    setTotalWeightInput((prev) => ({ ...prev, [rowId]: totalWt }));
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const uw = parseFloat(r.weight) || r.unitWeight;
        if (!uw) return r;
        const qty = (parseFloat(totalWt) || 0) / uw;
        return {
          ...r,
          quantity: qty > 0 ? String(parseFloat(qty.toFixed(4))) : '',
        };
      }),
    );
  };

  const handleKeyDown = (e, rowId, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (field === 'quantity') { wtRefs.current[rowId]?.focus(); return; }
    if (field === 'weight')   { prRefs.current[rowId]?.focus(); return; }
    if (field === 'price')    { handleSaveRow(rowId); }
  };

  const handleSaveRow = (rowId) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row?.item)                              { toast.error('اختار الصنف أولاً'); return; }
    if (!row.quantity || !row.weight || !row.price) { toast.error('اكمل بيانات الصنف'); return; }
    setRows((prev) => {
      const upd = prev.map((r) =>
        r.id === rowId ? { ...r, saved: true, editing: false } : r,
      );
      return [...upd, newRow()];
    });
    setTotalWeightInput((prev) => { const n = { ...prev }; delete n[rowId]; return n; });
  };

  const handleEditRow = (rowId) =>
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, saved: false, editing: true } : r)),
    );

  const handleDeleteRow = (rowId) => {
    setRows((prev) => {
      const f = prev.filter((r) => r.id !== rowId);
      return f.length ? f : [newRow()];
    });
  };

  const savedRows    = rows.filter((r) => r.saved);
  const totalAmount  = savedRows.reduce((s, r) => s + calcTotal(r.quantity, r.weight, r.price), 0);
  const totalWeightAll = savedRows.reduce((s, r) => s + calcTotalWeight(r.quantity, r.weight), 0);

  const handleSubmit = async () => {
    if (!party) {
      setPartyError(true);
      toast.error(isCustomer ? 'اختار العميل' : 'اختار المورد');
      return;
    }
    if (!docNumber.trim()) { toast.error('أدخل رقم المستند'); return; }
    if (savedRows.length === 0) { toast.error('أضف صنف واحد على الأقل'); return; }

    // تأكيد إضافي عند تعديل مرتجع معتمد
    if (isEditMode && existingReturn?.status === 'approved') {
      const ok = window.confirm(
        '⚠️ هتعدل على مرتجع معتمد!\nده هيعكس أثر المخزن والخزنة القديم ويطبق الجديد تلقائياً.\nمتأكد؟'
      );
      if (!ok) return;
    }

    setSaving(true);
    const itemsPayload = savedRows.map((r) => ({
      item:     r.item,
      itemCode: r.itemCode,
      itemName: r.itemName,
      quantity: Number(r.quantity),
      weight:   Number(r.weight),
      price:    Number(r.price),
      total:    calcTotal(r.quantity, r.weight, r.price),
    }));
    const partyFields = isCustomer
      ? { customerId: party._id, customerCode: party.code, customerName: party.name }
      : { supplierId: party._id, supplierCode: party.code, supplierName: party.name };
    const refundFields = isCustomer
      ? { refundMethod, refundCashAmount: Number(refundCashAmount) || 0, refundBankAmount: Number(refundBankAmount) || 0 }
      : {};

    const payload = {
      type, docNumber: docNumber.trim(), date, warehouse, notes, originalInvoice,
      ...partyFields, ...refundFields, items: itemsPayload,
    };

    try {
      if (isEditMode) {
        await api.put(`/returns/${id}`, payload);
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
        } else {
          toast.error(res.payload || 'خطأ في الحفظ');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الحفظ');
    }
    setSaving(false);
  };

  if (loadingEdit)
    return <div className="text-center py-20 text-gray-400">جاري تحميل المرتجع...</div>;

  const isApprovedEdit = isEditMode && existingReturn?.status === 'approved';

  return (
    <div className="max-w-5xl mx-auto">
      {/* هيدر */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditMode
              ? `✏️ تعديل — ${existingReturn?.invoiceNumber}`
              : isCustomer
                ? 'مرتجع عميل جديد'
                : 'مرتجع مورد جديد'}
          </h1>
          <p className={`text-sm px-3 py-1 rounded-full mt-1 inline-block ${
            isApprovedEdit
              ? 'text-red-700 bg-red-50 border border-red-200'
              : 'text-amber-600 bg-amber-50'
          }`}>
            {isApprovedEdit
              ? '⚠️ تعديل على مرتجع معتمد — سيُعاد حساب المخزن والخزنة'
              : isEditMode
                ? '✏️ تعديل على مرتجع معلق'
                : '⏳ في انتظار موافقة الأدمن بعد الحفظ'}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditMode && (
            <button className="btn-secondary" onClick={() => navigate(-1)}>
              ← رجوع
            </button>
          )}
          <button
            className={`${isApprovedEdit ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleSubmit}
            disabled={saving || savedRows.length === 0}
          >
            {saving
              ? 'جاري الحفظ...'
              : isEditMode
                ? `💾 حفظ التعديل (${savedRows.length} صنف)`
                : `💾 حفظ (${savedRows.length} صنف)`}
          </button>
        </div>
      </div>

      {/* تحذير للمرتجع المعتمد */}
      {isApprovedEdit && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-2">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold mb-1">تنبيه: تعديل مرتجع معتمد</p>
            <p>عند الحفظ سيتم تلقائياً:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-red-600">
              <li>عكس حركات المخزن القديمة</li>
              <li>عكس أثر الخزنة القديم</li>
              <li>تطبيق البيانات الجديدة على المخزن والخزنة</li>
            </ul>
          </div>
        </div>
      )}

      {/* رأس المرتجع */}
      <div className="card mb-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          بيانات المرتجع
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">رقم المستند *</label>
            <input
              className="input-field"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="رقم المستند"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">التاريخ</label>
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">المخزن</label>
            <select
              className="input-field"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
            >
              <option value="ramses">رمسيس</option>
              <option value="october">أكتوبر</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              {isCustomer ? 'العميل *' : 'المورد *'}
              {isEditMode && (
                <span className="text-xs text-blue-500 mr-1">(يمكن التغيير)</span>
              )}
            </label>
            {isCustomer ? (
              <CustomerSearch
                key={existingReturn?._id || 'new'}
                onSelect={(c) => { setParty(c); setPartyError(false); }}
                error={partyError}
                defaultValue={party?.name || ''}
              />
            ) : (
              <SupplierSearch
                key={existingReturn?._id || 'new'}
                onSelect={(s) => { setParty(s); setPartyError(false); }}
                error={partyError}
                defaultValue={party?.name || ''}
              />
            )}
            {party && (
              <p className="text-xs text-green-600 mt-0.5 font-medium">✓ {party.name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">رقم الفاتورة الأصلية</label>
            <input
              className="input-field"
              value={originalInvoice}
              onChange={(e) => setOriginalInvoice(e.target.value)}
              placeholder="اختياري"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ملاحظات</label>
            <input
              className="input-field"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اختياري"
            />
          </div>
        </div>

        {/* رد الأموال — مرتجع عميل فقط */}
        {isCustomer && (
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-semibold text-gray-600 mb-3">💵 رد الأموال للعميل</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">طريقة رد الأموال</label>
                <select
                  className="input-field"
                  value={refundMethod}
                  onChange={(e) => {
                    setRefundMethod(e.target.value);
                    setRefundCashAmount('');
                    setRefundBankAmount('');
                  }}
                >
                  <option value="none">آجل — مش فيه رد نقدي</option>
                  <option value="cash">نقدي — من خزنة الأدمن</option>
                  <option value="bank">بنكي / انستاباي</option>
                  <option value="mixed">مختلط (نقدي + بنكي)</option>
                </select>
              </div>
              {(refundMethod === 'cash' || refundMethod === 'mixed') && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">المبلغ النقدي</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="input-field"
                    placeholder="0.00 ج.م"
                    value={refundCashAmount}
                    onChange={(e) => setRefundCashAmount(e.target.value)}
                  />
                  <p className="text-xs text-amber-600 mt-1">⚠️ سيُخصم من خزنة الأدمن الذي يوافق</p>
                </div>
              )}
              {(refundMethod === 'bank' || refundMethod === 'mixed') && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">المبلغ البنكي</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="input-field"
                    placeholder="0.00 ج.م"
                    value={refundBankAmount}
                    onChange={(e) => setRefundBankAmount(e.target.value)}
                  />
                  <p className="text-xs text-blue-600 mt-1">سيُخصم من خزنة البنك</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* الأصناف المحفوظة */}
      {savedRows.length > 0 && (
        <div className="card mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            الأصناف ({savedRows.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-right px-3 py-2">#</th>
                  <th className="text-right px-3 py-2">الكود</th>
                  <th className="text-right px-3 py-2">الصنف</th>
                  <th className="text-center px-3 py-2">العدد</th>
                  <th className="text-center px-3 py-2">وزن/وحدة</th>
                  <th className="text-center px-3 py-2">وزن كلي</th>
                  <th className="text-center px-3 py-2">السعر/ك</th>
                  <th className="text-center px-3 py-2">الإجمالي</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {savedRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-center text-xs">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-blue-600 text-xs">{row.itemCode}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{row.itemName}</td>
                    <td className="px-3 py-2.5 text-center">{row.quantity}</td>
                    <td className="px-3 py-2.5 text-center text-gray-400 text-xs">
                      {parseFloat(row.weight).toFixed(3)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium">
                      {calcTotalWeight(row.quantity, row.weight).toFixed(3)} ك
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {parseFloat(row.price).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-orange-600">
                      {calcTotal(row.quantity, row.weight, row.price).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => handleEditRow(row.id)}
                        className="text-blue-500 text-xs p-1 rounded hover:bg-blue-50"
                      >✏️</button>
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="text-red-400 text-xs p-1 rounded hover:bg-red-50"
                      >🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-orange-50 font-semibold text-xs">
                  <td colSpan={5} className="px-3 py-2 text-right text-gray-600">الإجمالي</td>
                  <td className="px-3 py-2 text-center text-orange-700">
                    {totalWeightAll.toFixed(3)} ك
                  </td>
                  <td></td>
                  <td className="px-3 py-2 text-center text-orange-700">
                    {totalAmount.toFixed(2)} ج.م
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* صفوف الإدخال */}
      {rows
        .filter((r) => !r.saved)
        .map((row) => (
          <div
            key={row.id}
            className={`card mb-3 border-2 ${row.editing ? 'border-amber-400 bg-amber-50/30' : 'border-orange-200'}`}
          >
            <p className="text-sm font-medium text-gray-600 mb-3">
              {row.editing ? '✏️ تعديل صنف' : '➕ إضافة صنف'}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">الصنف *</label>
                <ItemSearch
                  onSelect={(item) => handleItemSelect(row.id, item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); qtyRefs.current[row.id]?.focus(); }
                  }}
                  placeholder="ابحث بالكود أو الاسم..."
                />
                {row.itemName && (
                  <p className="text-xs text-green-600 mt-1 font-medium">✓ {row.itemName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">وزن الكرتونة (كيلو)</label>
                <input
                  ref={(el) => (wtRefs.current[row.id] = el)}
                  type="number" min="0" step="0.001"
                  className="input-field text-center"
                  placeholder="22.680"
                  value={row.weight}
                  onChange={(e) => updateRow(row.id, 'weight', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, row.id, 'weight')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">السعر / كيلو</label>
                <input
                  ref={(el) => (prRefs.current[row.id] = el)}
                  type="number" min="0" step="0.01"
                  className="input-field text-center"
                  placeholder="0.00"
                  value={row.price}
                  onChange={(e) => updateRow(row.id, 'price', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, row.id, 'price')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  العدد (كراتين)
                  {row.weight && <span className="text-blue-400 mr-1">× {row.weight} ك</span>}
                </label>
                <input
                  ref={(el) => (qtyRefs.current[row.id] = el)}
                  type="number" min="0" step="0.001"
                  className="input-field text-center font-bold text-lg"
                  placeholder="0"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, row.id, 'quantity')}
                />
                {row.quantity && row.weight && (
                  <p className="text-xs text-blue-500 mt-0.5 text-center">
                    = {calcTotalWeight(row.quantity, row.weight).toFixed(3)} كيلو
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  أو أدخل الوزن الكلي <span className="text-gray-400">(يحسب العدد)</span>
                </label>
                <input
                  type="number" min="0" step="0.001"
                  className="input-field text-center bg-blue-50"
                  placeholder="10.000 كيلو"
                  value={totalWeightInput[row.id] || ''}
                  onChange={(e) => handleTotalWeightChange(row.id, e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <div className="w-full bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200">
                  <p className="text-xs text-gray-400 mb-0.5">الإجمالي</p>
                  <p className="text-xl font-bold text-orange-600">
                    {calcTotal(row.quantity, row.weight, row.price).toFixed(2)} ج.م
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveRow(row.id)}
                className="btn-primary px-6 py-2"
                disabled={!row.item || !row.quantity || !row.weight || !row.price}
              >
                {row.editing ? 'تحديث' : '✓ إضافة'}
              </button>
              {row.editing && (
                <button onClick={() => handleDeleteRow(row.id)} className="btn-secondary px-4 py-2">
                  إلغاء
                </button>
              )}
            </div>
          </div>
        ))}

      {/* الإجمالي */}
      {savedRows.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-start">
            <div className="text-sm text-gray-500 space-y-1">
              <p>عدد الأصناف: <span className="font-medium text-gray-700">{savedRows.length}</span></p>
              <p>إجمالي الوزن: <span className="font-medium text-gray-700">{totalWeightAll.toFixed(3)} كيلو</span></p>
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-500 mb-1">الإجمالي الكلي</p>
              <p className="text-3xl font-bold text-orange-600">{totalAmount.toFixed(2)}</p>
              <p className="text-sm text-gray-400">جنيه مصري</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}