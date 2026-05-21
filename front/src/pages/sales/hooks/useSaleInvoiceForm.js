// ─── hooks/useSaleInvoiceForm.js ──────────────────────────────────────────────
// ✅ FIX: تحديث stock الصنف لما المخزن يتغير
import { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createSaleInvoice } from '../../../store/slices/saleSlice';
import api from '../../../services/api';
import toast from 'react-hot-toast';

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
  availableQty: undefined,
  availableWeight: undefined,
  saved: false,
  editing: false,
});

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

export const calcTotal = (q, w, p) =>
  r2((parseFloat(q) || 0) * (parseFloat(w) || 0) * (parseFloat(p) || 0));

export const calcTotalWeight = (q, w) =>
  r3((parseFloat(q) || 0) * (parseFloat(w) || 0));

/**
 * calcTotalFromWeight — يحسب الإجمالي من الوزن الكلي مباشرة
 * بيتجنب أخطاء الفاصلة العائمة من (totalWt / unitWt) * unitWt * price
 */
export const calcTotalFromWeight = (totalWt, p) =>
  r2((parseFloat(totalWt) || 0) * (parseFloat(p) || 0));

export const PAYMENT_METHODS = [
  { value: 'cash',      label: 'نقدي' },
  { value: 'instapay',  label: 'انستاباي' },
  { value: 'transfer',  label: 'تحويل بنكي' },
  { value: 'check',     label: 'شيك' },
  { value: 'mixed',     label: 'نقدي + انستاباي' },
];

export function useSaleInvoiceForm() {
  const reduxDispatch   = useDispatch();
  const { user }        = useSelector(s => s.auth);
  const { activeSeason } = useSelector(s => s.season);
  const isAdmin         = user?.role === 'admin';

  const userHasNegativePerm = Array.isArray(user?.permissions)
    ? user.permissions.some(p => p.permission === 'sale_allow_negative' && p.granted === true)
    : false;
  const canNegativeSale     = userHasNegativePerm;
  const canEditInvoice      = isAdmin;

  // ── header state ──────────────────────────────────────────────────────────
  const [customer,        setCustomer]        = useState(null);
  const [customerError,   setCustomerError]   = useState(false);
  const [docNumber,       setDocNumber]       = useState('');
  const [docError,        setDocError]        = useState('');
  const [docChecking,     setDocChecking]     = useState(false);
  const [date,            setDate]            = useState(new Date().toISOString().split('T')[0]);
  const [warehouse,       setWarehouse]       = useState(
    user?.scope === 'october' ? 'october' : 'ramses',
  );
  const [notes,           setNotes]           = useState('');
  const [paymentMethod,   setPaymentMethod]   = useState('credit');
  const [cashAmount,      setCashAmount]      = useState('');
  const [instapayAmount,  setInstapayAmount]  = useState('');
  const [rows,            setRows]            = useState([newRow()]);
  const [saving,          setSaving]          = useState(false);
  const [customerBalance, setCustomerBalance] = useState(null);
  const [totalWeightInput,setTotalWeightInput]= useState({});

  // ── edit mode state ───────────────────────────────────────────────────────
  const [editingInvoice,  setEditingInvoice]  = useState(null);
  const [editNotes,       setEditNotes]       = useState('');
  const [showAdminSearch, setShowAdminSearch] = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchResults,   setSearchResults]   = useState([]);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const [showPrint,       setShowPrint]       = useState(false);

  // ── refs ──────────────────────────────────────────────────────────────────
  const docRef      = useRef(null);
  const customerRef = useRef(null);
  const itemRefs    = useRef({});
  const qtyRefs     = useRef({});
  const wtRefs      = useRef({});
  const prRefs      = useRef({});
  const docTimer    = useRef(null);
  const srchTimer   = useRef(null);
  const customerKey = useRef(0);

  // ── computed ──────────────────────────────────────────────────────────────
  const savedRows      = rows.filter(r => r.saved);
  const activeRowId    = rows.find(r => !r.saved)?.id;
  const totalAmount = r2(savedRows.reduce((s, r) => {
    // لو المستخدم دخل الوزن الكلي يدوياً، نحسب من الوزن الكلي × السعر مباشرة
    const tw = r._totalWeight ?? r3((parseFloat(r.quantity) || 0) * (parseFloat(r.weight) || 0));
    return s + r2((parseFloat(tw) || 0) * (parseFloat(r.price) || 0));
  }, 0));
  const totalWeightAll = r3(savedRows.reduce((s, r) => {
    const tw = r._totalWeight ?? r3((parseFloat(r.quantity) || 0) * (parseFloat(r.weight) || 0));
    return s + r3(parseFloat(tw) || 0);
  }, 0));
  const isCash         = customer?.type === 'cash';
  const isMixed        = paymentMethod === 'mixed';
  const paidAmount     = isMixed
    ? (parseFloat(cashAmount) || 0) + (parseFloat(instapayAmount) || 0)
    : paymentMethod !== 'credit' ? (parseFloat(cashAmount) || 0) : 0;
  const remaining      = totalAmount - paidAmount;

  useEffect(() => { setTimeout(() => docRef.current?.focus(), 100); }, []);

  useEffect(() => {
    if (!customer || customer.type === 'cash') { setCustomerBalance(null); return; }
    // ✅ FIX-CREDIT-001: نجيب الرصيد مع الموسم الحالي لضمان دقة الرصيد المعروض
    const params = activeSeason?._id ? { seasonId: activeSeason._id } : {};
    api.get(`/customers/${customer._id}/statement`, { params })
      .then(({ data }) => {
        // الـ API يرجع { customer, totals: { balance, totalSales, ... }, rows, ... }
        // CustomerBalanceCard تحتاج الـ totals مباشرة
        setCustomerBalance(data.totals ?? data);
      })
      .catch(() => setCustomerBalance(null));
  }, [customer, activeSeason]);

  useEffect(() => {
    if (!customer) return;
    setPaymentMethod(customer.type === 'cash' ? 'cash' : 'credit');
    setCashAmount('');
    setInstapayAmount('');
  }, [customer]);

  useEffect(() => {
    if (!isCash || isMixed) return;
    if (paymentMethod !== 'credit') {
      setCashAmount(totalAmount > 0 ? totalAmount.toFixed(2) : '');
    }
  }, [totalAmount, isCash, isMixed, paymentMethod]);

  // ✅ FIX: لما المخزن يتغير، حدّث كل صنف محفوظ بالمخزون الجديد
  const handleWarehouseChange = useCallback(async (newWarehouse) => {
    setWarehouse(newWarehouse);
    // إعادة جلب المخزون المتاح لكل صنف في الـ rows
    setRows(prev => prev.map(r => {
      if (!r.item) return r;
      return r; // سيتحدث عبر useEffect التالي
    }));

    // جيب stock محدّث لكل صنف فيه item
    const itemIds = [...new Set(rows.filter(r => r.item).map(r => r.item))];
    if (itemIds.length === 0) return;

    // جلب موازي
    const updates = await Promise.allSettled(
      itemIds.map(id => api.get(`/items/${id}/stock`))
    );

    const stockByItem = {};
    updates.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        const data = res.value.data;
        stockByItem[itemIds[i]] = data.stock;
      }
    });

    setRows(prev => prev.map(r => {
      if (!r.item || !stockByItem[r.item]) return r;
      const wStock = stockByItem[r.item]?.[newWarehouse] || { quantity: 0, weight: 0 };
      return { ...r, availableQty: wStock.quantity, availableWeight: wStock.weight };
    }));
  }, [rows]);

  // ── checkDocNumber ────────────────────────────────────────────────────────
  const checkDocNumber = useCallback(async (val, excludeId = null) => {
    if (!val.trim()) { setDocError(''); return; }
    setDocChecking(true);
    try {
      const params = { docNumber: val, seasonId: activeSeason?._id };
      if (excludeId) params.excludeId = excludeId;
      const { data } = await api.get('/sales/check-doc', { params });
      setDocError(data.exists ? `⚠️ رقم المستند "${val}" موجود في هذا الموسم` : '');
    } catch {
      setDocError('');
    } finally {
      setDocChecking(false);
    }
  }, [activeSeason]);

  const handleDocChange = (val) => {
    setDocNumber(val);
    setDocError('');
    clearTimeout(docTimer.current);
    docTimer.current = setTimeout(() => checkDocNumber(val, editingInvoice?._id), 600);
  };

  const handleDocKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); customerRef.current?.focus(); }
  };

  const handleCustomerSelect = (c) => {
    setCustomer(c);
    setCustomerError(false);
    setTimeout(() => focusItemSearch(), 80);
  };

  const focusItemSearch = () => {
    if (activeRowId && itemRefs.current[activeRowId]) itemRefs.current[activeRowId]();
  };

  // ── admin search ──────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const { data } = await api.get('/sales/search', { params: { q } });
      setSearchResults(data);
    } catch {
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    clearTimeout(srchTimer.current);
    srchTimer.current = setTimeout(() => doSearch(val), 400);
  };

  const loadForEdit = async (inv) => {
    const { data } = await api.get(`/sales/${inv._id}`);
    setEditingInvoice(data);
    setSearchResults([]);
    setSearchQuery('');
    setShowAdminSearch(false);
    setDocNumber(data.docNumber);
    setDate(data.date?.split('T')[0] || new Date().toISOString().split('T')[0]);
    setWarehouse(data.warehouse);
    setPaymentMethod(data.paymentMethod || 'credit');
    setCashAmount(String(data.cashAmount || ''));
    setInstapayAmount(String(data.instapayAmount || ''));
    setEditNotes('');
    const c = data.customer || {
      _id: data.customerId, code: data.customerCode,
      name: data.customerName, type: data.paymentMethod === 'credit' ? 'credit' : 'cash',
    };
    setCustomer(c);
    setCustomerError(false);
    const loaded = data.items.map(item => {
      // itemId: نستخدم itemId مباشرة من السطر (هو الـ UUID الصح)
      // item.item موجود بس لو الـ include جاب الـ relation — آمن نفال على itemId
      const resolvedItemId = item.itemId || item.item?._id || item.item?.id || item.item;
      // totalWeight: نحسبه من total ÷ price لو السعر > 0 (أدق من qty × wt)
      // لأن total مخزّن في DB بدقة عالية بينما qty × wt ممكن يطلع floating point
      const pr = parseFloat(item.price) || 0;
      const storedTW = pr > 0
        ? Math.round((parseFloat(item.total) / pr) * 1000) / 1000
        : Math.round((parseFloat(item.quantity) * parseFloat(item.weight)) * 1000) / 1000;
      return {
        id: Date.now() + Math.random(),
        item: resolvedItemId,
        itemCode: item.itemCode, itemName: item.itemName,
        unit: item.unit || '', unitWeight: parseFloat(item.weight),
        quantity: String(item.quantity), weight: String(item.weight),
        price: String(item.price),
        _totalWeight: storedTW,   // ← نحفظه عشان الحسابات تكون صح عند التعديل
        saved: true, editing: false,
      };
    });
    setRows([...loaded, newRow()]);
    setTotalWeightInput({});
    customerKey.current += 1;
    toast.success(`تم تحميل ${data.invoiceNumber} للتعديل`);
  };

  const cancelEdit = () => {
    setEditingInvoice(null);
    setEditNotes('');
    setCustomer(null);
    setDocNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    setRows([newRow()]);
    setCashAmount('');
    setInstapayAmount('');
    setDocError('');
    setCustomerBalance(null);
    setTotalWeightInput({});
    customerKey.current += 1;
    setTimeout(() => docRef.current?.focus(), 80);
  };

  // ── item handlers ─────────────────────────────────────────────────────────
  const handleItemSelect = async (rowId, item) => {
    if (!item) return;
    let defaultPrice = '';
    const unitWeight = item.defaultWeight || 0;
    // ✅ يستخدم المخزن الحالي المختار
    const stockQty   = item.stock?.[warehouse]?.quantity ?? 0;
    const stockWt    = item.stock?.[warehouse]?.weight   ?? 0;
    try {
      const { data } = await api.get(`/price-list/item/${item._id}`);
      if (data?.defaultPrice) defaultPrice = String(data.defaultPrice);
    } catch {}
    setRows(prev => prev.map(r =>
      r.id === rowId ? {
        ...r, item: item._id, itemCode: item.code, itemName: item.name,
        unit: item.unit, unitWeight,
        weight: unitWeight ? String(unitWeight) : r.weight,
        price: defaultPrice || r.price,
        availableQty: stockQty, availableWeight: stockWt,
      } : r,
    ));
    setTimeout(() => qtyRefs.current[rowId]?.focus(), 50);
  };

  const updateRow = (rowId, field, value) =>
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));

  const handleTotalWeightChange = (rowId, totalWt) => {
    setTotalWeightInput(prev => ({ ...prev, [rowId]: totalWt }));
    const tw = parseFloat(totalWt) || 0;
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const uw = parseFloat(r.weight) || parseFloat(r.unitWeight) || 0;
      if (!uw) return r;
      // نحسب العدد من الوزن الكلي — نحتفظ بالوزن الكلي للحساب الدقيق
      const qty = tw / uw;
      return {
        ...r,
        quantity:    qty > 0 ? String(Math.round(qty * 10000) / 10000) : '',
        _totalWeight: tw,   // نحفظ الوزن الكلي الأصلي
      };
    }));
  };

  const handleKeyDown = (e, rowId, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (field === 'quantity') { wtRefs.current[rowId]?.focus(); return; }
    if (field === 'weight')   { prRefs.current[rowId]?.focus(); return; }
    if (field === 'price')    { handleSaveRow(rowId); }
  };

  const handleSaveRow = (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row?.item)                               return toast.error('اختار الصنف أولاً');
    if (!row.quantity || !row.weight || !row.price) return toast.error('اكمل بيانات الصنف');
    const duplicate = rows.find(r => r.id !== rowId && r.saved && r.item === row.item);
    if (duplicate) return toast.error(`الصنف "${row.itemName}" موجود بالفعل في الفاتورة`);

    if (row.editing) {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r));
    } else {
      const newR = newRow();
      setRows(prev => [
        ...prev.map(r => r.id === rowId ? { ...r, saved: true, editing: false } : r),
        newR,
      ]);
      setTotalWeightInput(prev => { const n = { ...prev }; delete n[rowId]; return n; });
      setTimeout(() => { if (itemRefs.current[newR.id]) itemRefs.current[newR.id](); }, 80);
    }
  };

  const handleEditRow   = (rowId) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: false, editing: true  } : r));
  const handleCancelRow = (rowId) => setRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: true,  editing: false } : r));
  const handleDeleteRow = (rowId) => setRows(prev => prev.filter(r => r.id !== rowId));

  const resetForm = () => {
    setCustomer(null);
    setDocNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    setCashAmount('');
    setInstapayAmount('');
    setRows([newRow()]);
    setDocError('');
    setCustomerBalance(null);
    setTotalWeightInput({});
    customerKey.current += 1;
    setTimeout(() => docRef.current?.focus(), 80);
  };

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!customer)          { setCustomerError(true); toast.error('اختار العميل'); return; }
    if (!docNumber.trim())  { toast.error('أدخل رقم المستند'); return; }
    if (docError)           { toast.error(docError); return; }
    if (savedRows.length === 0) { toast.error('أضف صنف واحد على الأقل'); return; }

    // ✅ FIX-PAY-001: التحقق من المبلغ المدفوع للعملاء النقديين قبل الإرسال
    // عميل نقدي: المبلغ المدفوع لازم = الإجمالي بدقة 0.01 جنيه
    const finalPaymentMethodCheck = customer.type === 'cash' ? paymentMethod : 'credit';
    if (finalPaymentMethodCheck !== 'credit' && savedRows.length > 0) {
      const eps = 0.01; // tolerance
      if (finalPaymentMethodCheck === 'mixed') {
        const mixedTotal = r2((parseFloat(cashAmount) || 0) + (parseFloat(instapayAmount) || 0));
        if (Math.abs(mixedTotal - totalAmount) > eps) {
          toast.error(
            `المبلغ المدفوع (${mixedTotal.toFixed(2)}) لا يساوي إجمالي الفاتورة (${totalAmount.toFixed(2)}) ج.م\nيرجى مراجعة المبالغ`,
            { duration: 5000 }
          );
          return;
        }
      } else {
        const paid = parseFloat(cashAmount) || parseFloat(instapayAmount) || 0;
        if (Math.abs(paid - totalAmount) > eps) {
          toast.error(
            `المبلغ المدفوع (${paid.toFixed(2)}) لا يساوي إجمالي الفاتورة (${totalAmount.toFixed(2)}) ج.م\nالفاتورة النقدية تحتاج دفع كامل`,
            { duration: 5000 }
          );
          return;
        }
      }
    }

    setSaving(true);

    const itemsPayload = savedRows.map(r => {
      const qty = parseFloat(r.quantity) || 0;
      const uw  = parseFloat(r.weight)   || 0;
      const pr  = parseFloat(r.price)    || 0;
      // الوزن الكلي: نستخدم ما أدخله المستخدم مباشرة إن وُجد، وإلا qty × unitWeight
      const tw  = r._totalWeight != null ? r3(parseFloat(r._totalWeight)) : r3(qty * uw);
      return {
        item: r.item, itemCode: r.itemCode, itemName: r.itemName,
        quantity: qty, weight: uw, price: pr,
        totalWeight: tw,          // ← مهم: الـ backend يستخدمه بدل qty × wt
        total: r2(tw * pr),
      };
    });

    const finalPaymentMethod = customer.type === 'cash' ? paymentMethod : 'credit';
    let finalCashAmount = 0, finalInstapayAmount = 0, finalPaidAmount = 0;

    if (finalPaymentMethod === 'mixed') {
      finalCashAmount     = parseFloat(cashAmount)     || 0;
      finalInstapayAmount = parseFloat(instapayAmount) || 0;
      finalPaidAmount     = finalCashAmount + finalInstapayAmount;
    } else if (finalPaymentMethod === 'instapay') {
      finalInstapayAmount = parseFloat(cashAmount) || 0;
      finalPaidAmount     = finalInstapayAmount;
    } else if (finalPaymentMethod !== 'credit') {
      finalCashAmount = parseFloat(cashAmount) || 0;
      finalPaidAmount = finalCashAmount;
    }

    const shouldAllowNegative = userHasNegativePerm;

    const base = {
      docNumber: docNumber.trim(), date,
      customerId: customer._id || customer,
      customerCode: customer.code, customerName: customer.name,
      warehouse, notes: notes.trim(),
      paymentMethod: finalPaymentMethod,
      paidAmount: finalPaidAmount, cashAmount: finalCashAmount,
      instapayAmount: finalInstapayAmount, items: itemsPayload,
      ...(shouldAllowNegative ? { allowNegativeSale: true } : {}),
    };

    try {
      if (editingInvoice) {
        const endpoint = isAdmin
          ? `/sales/${editingInvoice._id}/force-edit`
          : `/sales/${editingInvoice._id}`;
        const { data } = await api.put(endpoint, { ...base, editNotes });
        const invoice  = data.invoice || data;
        toast.success(`تم تعديل ${invoice.invoiceNumber} ✅`);
        cancelEdit();
      } else {
        const res = await reduxDispatch(createSaleInvoice(base));
        if (!res.error) {
          toast.success(`تم حفظ الفاتورة ${res.payload.invoiceNumber} ✅`);
          resetForm();
        } else {
          toast.error(res.payload || 'خطأ في الحفظ');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ');
    }
    setSaving(false);
  };

  return {
    user, isAdmin, canNegativeSale, userHasNegativePerm, canEditInvoice,
    customer, customerError, setCustomerError,
    docNumber, docError, docChecking,
    date, setDate,
    warehouse, setWarehouse: handleWarehouseChange,
    notes, setNotes,
    paymentMethod, setPaymentMethod,
    cashAmount, setCashAmount,
    instapayAmount, setInstapayAmount,
    rows, setRows, savedRows, activeRowId,
    saving, showPrint, setShowPrint,
    customerBalance,
    totalWeightInput,
    editingInvoice, editNotes, setEditNotes,
    showAdminSearch, setShowAdminSearch,
    searchQuery, searchResults, searchLoading,
    totalAmount, totalWeightAll, isCash, isMixed, paidAmount, remaining,
    docRef, customerRef, itemRefs, qtyRefs, wtRefs, prRefs, customerKey,
    handleDocChange, handleDocKeyDown,
    handleCustomerSelect, focusItemSearch,
    handleSearchChange, loadForEdit, cancelEdit,
    handleItemSelect, updateRow, handleTotalWeightChange,
    handleKeyDown, handleSaveRow,
    handleEditRow, handleCancelRow, handleDeleteRow,
    handleSubmit,
  };
}
