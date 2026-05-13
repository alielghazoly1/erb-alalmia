// ─── pages/items/ItemMovementsPage.jsx ───────────────────────────────────────
// ✅ FIX: فتح الفاتورة في Modal نفس الصفحة بدل target="_blank"
// ✅ FIX: تأمين NaN في quantity/weight بـ safeNum
import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import ItemSearch from '../../components/common/ItemSearch';
import { useInfiniteScroll } from '../../hook/useInfiniteScroll';
import toast from 'react-hot-toast';

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  purchase_in:       { text: 'توريد',         cls: 'bg-blue-100 text-blue-700',     sign: '+' },
  purchase:          { text: 'توريد',         cls: 'bg-blue-100 text-blue-700',     sign: '+' },
  sale_out:          { text: 'مبيعات',        cls: 'bg-green-100 text-green-700',   sign: '-' },
  sale:              { text: 'مبيعات',        cls: 'bg-green-100 text-green-700',   sign: '-' },
  return_in:         { text: 'مرتجع وارد',   cls: 'bg-orange-100 text-orange-700', sign: '+' },
  return_out:        { text: 'مرتجع صادر',   cls: 'bg-red-100 text-red-700',       sign: '-' },
  transfer_in:       { text: 'إذن إضافة',    cls: 'bg-purple-100 text-purple-700', sign: '+' },
  transfer_out:      { text: 'إذن صرف',      cls: 'bg-purple-100 text-purple-700', sign: '-' },
  manufacturing_in:  { text: 'إضافة تصنيع',  cls: 'bg-amber-100 text-amber-700',   sign: '+' },
  manufacturing_out: { text: 'صرف تصنيع',    cls: 'bg-amber-100 text-amber-700',   sign: '-' },
  adjustment_add:    { text: 'تسوية +',      cls: 'bg-teal-100 text-teal-700',     sign: '+' },
  adjustment_sub:    { text: 'تسوية -',      cls: 'bg-rose-100 text-rose-700',     sign: '-' },
  opening_stock:     { text: 'رصيد افتتاحي', cls: 'bg-gray-100 text-gray-600',     sign: '+' },
};

// ✅ FIX: safeNum تحذف NaN/null
const safeNum = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

const getInvoicePath = (m) => {
  if (!m.referenceId) return null;
  const t = m.type;
  if (t === 'sale_out' || t === 'sale' || t === 'return_in')          return { type: 'sale',     id: m.referenceId };
  if (t === 'purchase_in' || t === 'purchase' || t === 'return_out')  return { type: 'purchase', id: m.referenceId };
  if (t === 'transfer_in' || t === 'transfer_out')                     return { type: 'transfer', id: m.referenceId };
  return null;
};

const today   = () => new Date().toISOString().slice(0, 10);
const fmt     = (n) => safeNum(n).toLocaleString('eg-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG') : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';

// ── Inline Invoice Modal ───────────────────────────────────────────────────────
function InvoiceModal({ path, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    if (!path) return;
    setLoading(true); setError(false); setData(null);
    const url = path.type === 'sale'     ? `/sales/${path.id}`
              : path.type === 'purchase' ? `/purchase/${path.id}`
              : `/transfers/${path.id}`;
    api.get(url)
      .then(({ data: d }) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [path]);

  if (!path) return null;

  const renderItems = (items = []) => (
    <table className="w-full text-xs border-collapse mt-3">
      <thead>
        <tr className="bg-blue-50 text-gray-600">
          <th className="px-3 py-2 text-right border border-gray-200">الصنف</th>
          <th className="px-3 py-2 text-center border border-gray-200">الكراتين</th>
          <th className="px-3 py-2 text-center border border-gray-200">الوزن/وحدة</th>
          <th className="px-3 py-2 text-center border border-gray-200">السعر</th>
          <th className="px-3 py-2 text-center border border-gray-200">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            <td className="px-3 py-2 border border-gray-200">
              <span className="font-mono text-blue-600 font-bold">{it.itemCode}</span>
              <span className="text-gray-700 mr-2">{it.itemName}</span>
            </td>
            <td className="px-3 py-2 text-center border border-gray-200 font-bold">{safeNum(it.quantity).toLocaleString()}</td>
            <td className="px-3 py-2 text-center border border-gray-200">{fmt(it.weight)}</td>
            <td className="px-3 py-2 text-center border border-gray-200">{fmt(it.price)}</td>
            <td className="px-3 py-2 text-center border border-gray-200 font-bold text-green-700">
              {fmt(safeNum(it.quantity) * safeNum(it.weight) * safeNum(it.price))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-auto py-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 bg-blue-700 text-white">
          <h2 className="font-bold text-lg">
            {path.type === 'sale' ? '🧾 فاتورة مبيعات'
           : path.type === 'purchase' ? '📦 فاتورة مشتريات'
           : '🔄 إذن نقل'}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-600 transition-colors text-xl font-bold">
            ×
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 text-blue-500 gap-3">
              <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              جاري التحميل...
            </div>
          )}
          {error && <div className="py-16 text-center text-red-400">تعذر تحميل المستند</div>}
          {data && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { l: 'رقم الفاتورة', v: data.invoiceNumber },
                  { l: 'رقم المستند',  v: data.docNumber },
                  { l: 'التاريخ',       v: fmtDate(data.date) },
                  { l: 'المخزن',        v: data.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر' },
                  { l: path.type === 'sale' ? 'العميل' : 'المورد', v: data.customerName || data.supplierName || '—' },
                  { l: 'الحالة',        v: data.status },
                  { l: 'الإجمالي',      v: `${fmt(data.totalAmount)} ج.م` },
                  { l: 'بواسطة',        v: data.createdBy?.name || '—' },
                ].map(({ l, v }) => (
                  <div key={l} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{l}</p>
                    <p className="font-bold text-gray-800 text-sm">{v}</p>
                  </div>
                ))}
              </div>
              <h3 className="font-semibold text-gray-700 text-sm mb-1">الأصناف</h3>
              {renderItems(data.items || [])}
              {data.notes && (
                <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-600">
                  <strong>ملاحظات:</strong> {data.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Print ─────────────────────────────────────────────────────────────────────
function printMovements({ item, movements, warehouse, startDate, endDate }) {
  const wLabel  = warehouse === 'ramses' ? 'رمسيس' : warehouse === 'october' ? 'أكتوبر' : 'الكل';
  const now     = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const totalInQty  = movements.filter(m => safeNum(m.quantityIn)  > 0).reduce((s, m) => s + safeNum(m.quantityIn),  0);
  const totalOutQty = movements.filter(m => safeNum(m.quantityOut) > 0).reduce((s, m) => s + safeNum(m.quantityOut), 0);
  const totalInWgt  = movements.filter(m => safeNum(m.weightIn)    > 0).reduce((s, m) => s + safeNum(m.weightIn),    0);
  const totalOutWgt = movements.filter(m => safeNum(m.weightOut)   > 0).reduce((s, m) => s + safeNum(m.weightOut),   0);

  const rows = movements.map((m, idx) => {
    const tp    = TYPE_LABELS[m.type] || { text: m.type, sign: '' };
    const isIn  = safeNum(m.quantityIn) > 0;
    const color = isIn ? '#16a34a' : '#dc2626';
    const qty   = isIn ? safeNum(m.quantityIn)  : safeNum(m.quantityOut);
    const wgt   = isIn ? safeNum(m.weightIn)     : safeNum(m.weightOut);
    return `<tr class="${idx % 2 === 0 ? 'even' : ''}">
      <td class="cen">${idx + 1}</td>
      <td>${fmtDate(m.date)}</td>
      <td>${fmtTime(m.createdAt)}</td>
      <td><span class="badge">${tp.text}</span></td>
      <td class="mono">${m.reference || '—'}</td>
      <td>${m.season?.name ? `🌿 ${m.season.name}` : '—'}</td>
      <td>${m.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر'}</td>
      <td class="cen num" style="color:${color};font-weight:700">${tp.sign}${qty.toLocaleString()}</td>
      <td class="cen num" style="color:${color}">${tp.sign}${fmt(wgt)}</td>
      <td class="cen num">${fmt(safeNum(m.balanceQty))}</td>
      <td>${m.createdBy?.name || '—'}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
<title>كشف حركة — ${item.code}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;font-size:11px;color:#111;direction:rtl;background:#fff}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 18px 10px;border-bottom:3px solid #1e40af;margin-bottom:10px}
  .company{font-size:20px;font-weight:900;color:#1e40af}.subtitle{font-size:13px;color:#374151;margin-top:2px}
  .meta{text-align:left;font-size:11px;color:#6b7280}.meta strong{display:block;font-size:14px;color:#1e40af;font-weight:700}
  .info-bar{display:flex;gap:16px;padding:8px 18px;background:#f0f7ff;border-radius:6px;margin:0 0 10px;font-size:11px;flex-wrap:wrap}
  .info-bar span{color:#374151}.info-bar b{color:#1e40af}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 10px}
  .stat{border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;text-align:center}
  .stat .lbl{font-size:10px;color:#6b7280;margin-bottom:2px}.stat .val{font-size:15px;font-weight:800}
  .stat.in .val{color:#16a34a}.stat.out .val{color:#dc2626}.stat.net .val{color:#1e40af}
  table{width:100%;border-collapse:collapse;font-size:10.5px}
  thead tr{background:#1e40af;color:#fff}th{padding:7px 5px;text-align:center;font-weight:700;border:1px solid #1e3a8a}
  td{padding:6px 5px;border:1px solid #e5e7eb;vertical-align:middle}tr.even{background:#f9fafb}
  .cen{text-align:center}.mono{font-family:monospace;color:#1d4ed8;font-weight:700}
  .num{font-variant-numeric:tabular-nums}
  .badge{display:inline-block;padding:1px 7px;border-radius:999px;background:#dbeafe;color:#1e40af;font-size:9.5px;font-weight:600}
  tfoot td{background:#e0f2fe;font-weight:700;padding:7px 5px;border:1px solid #bfdbfe}
  .footer{margin-top:12px;display:flex;justify-content:space-between;padding:8px 18px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb}
  @media print{@page{size:A4 landscape;margin:8mm}body{font-size:10px}}
</style></head><body>
  <div class="header">
    <div><div class="company">🏭 كشف حركة صنف</div><div class="subtitle">${item.code} — ${item.name} (${item.unit})</div></div>
    <div class="meta"><strong>${dateStr}</strong><span>الوقت: ${timeStr}</span></div>
  </div>
  <div class="info-bar">
    <span>المخزن: <b>${wLabel}</b></span><span>من: <b>${startDate || '—'}</b></span>
    <span>إلى: <b>${endDate || '—'}</b></span><span>عدد الحركات: <b>${movements.length.toLocaleString()}</b></span>
  </div>
  <div class="stats">
    <div class="stat in"><div class="lbl">إجمالي الوارد</div><div class="val">${totalInQty.toLocaleString()} كرتون</div><div style="font-size:11px;color:#16a34a">${fmt(totalInWgt)} ك</div></div>
    <div class="stat out"><div class="lbl">إجمالي الصادر</div><div class="val">${totalOutQty.toLocaleString()} كرتون</div><div style="font-size:11px;color:#dc2626">${fmt(totalOutWgt)} ك</div></div>
    <div class="stat net"><div class="lbl">الصافي</div><div class="val">${(totalInQty - totalOutQty).toLocaleString()} كرتون</div><div style="font-size:11px;color:#1e40af">${fmt(totalInWgt - totalOutWgt)} ك</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>التاريخ</th><th>الوقت</th><th>النوع</th><th>المرجع</th><th>الموسم</th><th>المخزن</th><th>الكراتين</th><th>الوزن (ك)</th><th>الرصيد</th><th>بواسطة</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="7" style="text-align:center">الإجمالي الصافي</td>
      <td class="cen">${(totalInQty - totalOutQty).toLocaleString()}</td>
      <td class="cen">${fmt(totalInWgt - totalOutWgt)}</td>
      <td colspan="2"></td>
    </tr></tfoot>
  </table>
  <div class="footer"><span>طُبع بواسطة نظام الإدارة</span><span>${dateStr} — ${timeStr}</span></div>
  <script>window.onload=()=>{window.print();}</script>
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:-1;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 500);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ItemMovementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initWarehouse = searchParams.get('warehouse') || 'october';
  const initStartDate = searchParams.get('startDate') || today();
  const initEndDate   = searchParams.get('endDate')   || today();
  const initItemId    = searchParams.get('itemId')    || '';
  const initItemCode  = searchParams.get('itemCode')  || '';
  const initItemName  = searchParams.get('itemName')  || '';
  const initItemUnit  = searchParams.get('itemUnit')  || '';

  const [selectedItem, setSelectedItem] = useState(
    initItemId ? { _id: initItemId, code: initItemCode, name: initItemName, unit: initItemUnit } : null
  );
  const [movements,    setMovements]   = useState([]);
  const [total,        setTotal]       = useState(0);
  const [currentPage,  setCurrentPage] = useState(1);
  const [hasMore,      setHasMore]     = useState(false);
  const [loading,      setLoading]     = useState(false);
  const [loadingMore,  setLoadingMore] = useState(false);
  const [stockInfo,    setStockInfo]   = useState(null);
  const [warehouse,    setWarehouse]   = useState(initWarehouse);
  const [startDate,    setStartDate]   = useState(initStartDate);
  const [endDate,      setEndDate]     = useState(initEndDate);

  // ✅ Modal state لفتح الفاتورة في نفس الصفحة
  const [invoicePath, setInvoicePath] = useState(null);

  const filtersRef = useRef({ warehouse, startDate, endDate, currentPage, selectedItem });
  filtersRef.current = { warehouse, startDate, endDate, currentPage, selectedItem };

  const syncUrl = useCallback((overrides = {}) => {
    const f    = filtersRef.current;
    const item = overrides.selectedItem !== undefined ? overrides.selectedItem : f.selectedItem;
    const wh   = overrides.warehouse    !== undefined ? overrides.warehouse    : f.warehouse;
    const sd   = overrides.startDate    !== undefined ? overrides.startDate    : f.startDate;
    const ed   = overrides.endDate      !== undefined ? overrides.endDate      : f.endDate;
    const p    = {};
    if (item?._id) { p.itemId = item._id; p.itemCode = item.code; p.itemName = item.name; p.itemUnit = item.unit || ''; }
    p.warehouse = wh;
    if (sd) p.startDate = sd;
    if (ed) p.endDate   = ed;
    setSearchParams(p, { replace: true });
  }, [setSearchParams]);

  const loadMovements = async (itemId, overrides = {}) => {
    const wh = overrides.warehouse  !== undefined ? overrides.warehouse  : filtersRef.current.warehouse;
    const sd = overrides.startDate  !== undefined ? overrides.startDate  : filtersRef.current.startDate;
    const ed = overrides.endDate    !== undefined ? overrides.endDate    : filtersRef.current.endDate;

    setLoading(true); setMovements([]); setHasMore(false);
    try {
      const params = { page: 1 };
      if (wh) params.warehouse = wh;
      if (sd) params.startDate = sd;
      if (ed) params.endDate   = ed;
      const { data } = await api.get(`/purchase/movements/${itemId}`, { params });
      setMovements(data.movements);
      setTotal(data.total);
      setCurrentPage(data.page);
      setHasMore(data.hasMore);
    } catch {
      toast.error('خطأ في تحميل الحركات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initItemId) {
      api.get(`/items/${initItemId}/stock`).then(({ data }) => {
        setStockInfo({ ramses: data.stock?.ramses || { quantity: 0, weight: 0 }, october: data.stock?.october || { quantity: 0, weight: 0 } });
      }).catch(() => {});
      loadMovements(initItemId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    const { selectedItem: item, currentPage: cp, warehouse: wh, startDate: sd, endDate: ed } = filtersRef.current;
    if (!item) return;
    setLoadingMore(true);
    try {
      const params = { page: cp + 1 };
      if (wh) params.warehouse = wh;
      if (sd) params.startDate = sd;
      if (ed) params.endDate   = ed;
      const { data } = await api.get(`/purchase/movements/${item._id}`, { params });
      setMovements(prev => {
        const ids = new Set(prev.map(m => m._id));
        return [...prev, ...data.movements.filter(m => !ids.has(m._id))];
      });
      setCurrentPage(data.page);
      setHasMore(data.hasMore);
    } catch {
      toast.error('خطأ في تحميل المزيد');
    } finally {
      setLoadingMore(false);
    }
  }, []);

  const sentinelRef = useInfiniteScroll({ onLoadMore: loadMore, hasMore, loading: loadingMore, threshold: 0.8 });

  const handleItemSelect = async (item) => {
    if (!item) { setSelectedItem(null); setMovements([]); setStockInfo(null); setTotal(0); syncUrl({ selectedItem: null }); return; }
    setSelectedItem(item);
    syncUrl({ selectedItem: item });
    api.get(`/items/${item._id}/stock`).then(({ data }) => {
      setStockInfo({ ramses: data.stock?.ramses || { quantity: 0, weight: 0 }, october: data.stock?.october || { quantity: 0, weight: 0 } });
    }).catch(() => {});
    loadMovements(item._id);
  };

  const handleWarehouseChange = (val) => { setWarehouse(val); syncUrl({ warehouse: val }); if (selectedItem) loadMovements(selectedItem._id, { warehouse: val }); };
  const handleStartDateChange = (val) => { setStartDate(val); syncUrl({ startDate: val }); };
  const handleEndDateChange   = (val) => { setEndDate(val);   syncUrl({ endDate: val }); };
  const handleFilter = () => { if (selectedItem) loadMovements(selectedItem._id); };

  // ✅ حساب الإحصائيات من quantityIn/Out بدل quantity
  const totalInQty  = movements.reduce((s, m) => s + safeNum(m.quantityIn),  0);
  const totalOutQty = movements.reduce((s, m) => s + safeNum(m.quantityOut), 0);
  const totalInWgt  = movements.reduce((s, m) => s + safeNum(m.weightIn),    0);
  const totalOutWgt = movements.reduce((s, m) => s + safeNum(m.weightOut),   0);

  return (
    <div>
      {/* Invoice Modal */}
      <InvoiceModal path={invoicePath} onClose={() => setInvoicePath(null)} />

      {/* Header */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">حركات الأصناف</h1>
          <p className="text-gray-500 text-sm mt-0.5">تتبع حركة أي صنف في جميع المخازن</p>
        </div>
        {selectedItem && movements.length > 0 && (
          <button onClick={() => printMovements({ item: selectedItem, movements, warehouse, startDate, endDate })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
            🖨️ طباعة الكشف
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-600 mb-1">اختار الصنف</label>
            <ItemSearch onSelect={handleItemSelect} placeholder="ابحث بالكود أو الاسم..."
              defaultValue={initItemId ? `${initItemCode} — ${initItemName}` : ''} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">المخزن</label>
            <select className="input-field" value={warehouse} onChange={e => handleWarehouseChange(e.target.value)}>
              <option value="">الكل</option>
              <option value="ramses">رمسيس</option>
              <option value="october">أكتوبر</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">من تاريخ</label>
            <input type="date" className="input-field" value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">إلى تاريخ</label>
            <input type="date" className="input-field" value={endDate}   onChange={e => handleEndDateChange(e.target.value)} />
          </div>
        </div>
        {selectedItem && (
          <div className="mt-3 flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{selectedItem.code}</span>
              <span className="text-gray-700 font-medium">{selectedItem.name}</span>
              <span className="text-gray-400 text-sm">({selectedItem.unit})</span>
              {total > 0 && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{total.toLocaleString()} حركة إجمالاً</span>}
            </div>
            <button className="btn-secondary text-sm py-1.5 px-4" onClick={handleFilter}>🔍 تصفية</button>
          </div>
        )}
      </div>

      {/* Stock Cards */}
      {selectedItem && stockInfo && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="card bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-600 font-semibold mb-2">📦 مخزن رمسيس — المخزون الحالي</p>
            <div className="flex gap-8">
              <div>
                <p className={`text-3xl font-black ${stockInfo.ramses.quantity < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                  {stockInfo.ramses.quantity.toLocaleString()}
                </p>
                <p className="text-xs text-blue-400 mt-0.5">كرتون</p>
              </div>
              <div>
                <p className={`text-3xl font-black ${stockInfo.ramses.weight < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {fmt(stockInfo.ramses.weight)}
                </p>
                <p className="text-xs text-blue-400 mt-0.5">كيلو</p>
              </div>
            </div>
          </div>
          <div className="card bg-purple-50 border border-purple-200">
            <p className="text-xs text-purple-600 font-semibold mb-2">📦 مخزن أكتوبر — المخزون الحالي</p>
            <div className="flex gap-8">
              <div>
                <p className={`text-3xl font-black ${stockInfo.october.quantity < 0 ? 'text-red-600' : 'text-purple-700'}`}>
                  {stockInfo.october.quantity.toLocaleString()}
                </p>
                <p className="text-xs text-purple-400 mt-0.5">كرتون</p>
              </div>
              <div>
                <p className={`text-3xl font-black ${stockInfo.october.weight < 0 ? 'text-red-600' : 'text-purple-600'}`}>
                  {fmt(stockInfo.october.weight)}
                </p>
                <p className="text-xs text-purple-400 mt-0.5">كيلو</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {selectedItem && movements.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="card text-center bg-green-50 border border-green-200">
            <p className="text-xs text-green-600 font-medium mb-1">إجمالي الوارد</p>
            <p className="text-xl font-bold text-green-700">{totalInQty.toLocaleString()} كرتون</p>
            <p className="text-sm text-green-600">{fmt(totalInWgt)} ك</p>
          </div>
          <div className="card text-center bg-red-50 border border-red-200">
            <p className="text-xs text-red-600 font-medium mb-1">إجمالي الصادر</p>
            <p className="text-xl font-bold text-red-700">{totalOutQty.toLocaleString()} كرتون</p>
            <p className="text-sm text-red-600">{fmt(totalOutWgt)} ك</p>
          </div>
          <div className="card text-center bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-600 font-medium mb-1">الصافي</p>
            <p className={`text-xl font-bold ${(totalInQty - totalOutQty) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
              {(totalInQty - totalOutQty).toLocaleString()} كرتون
            </p>
            <p className="text-sm text-blue-600">{fmt(totalInWgt - totalOutWgt)} ك</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {!selectedItem ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">📦</p>
            <p className="text-gray-400 text-lg">اختار صنف لعرض حركاته</p>
            <p className="text-gray-300 text-sm mt-1">ابحث بالكود أو اسم الصنف في الأعلى</p>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <svg className="animate-spin w-10 h-10 mx-auto text-blue-500 mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-gray-400">جاري تحميل الحركات...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🔍</p>
            <p className="text-gray-400 text-lg">مفيش حركات في الفترة دي</p>
            <p className="text-gray-300 text-sm mt-1">جرب تغير التاريخ أو المخزن</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-l from-gray-50 to-blue-50/40 text-gray-600 border-b border-gray-200 text-xs">
                  <th className="text-center px-3 py-3.5 font-semibold">#</th>
                  <th className="text-right px-3 py-3.5 font-semibold">التاريخ</th>
                  <th className="text-right px-3 py-3.5 font-semibold">الوقت</th>
                  <th className="text-right px-3 py-3.5 font-semibold">النوع</th>
                  <th className="text-right px-3 py-3.5 font-semibold">المرجع</th>
                  <th className="text-right px-3 py-3.5 font-semibold">الموسم</th>
                  <th className="text-right px-3 py-3.5 font-semibold">المخزن</th>
                  <th className="text-center px-3 py-3.5 font-semibold">وارد (ك)</th>
                  <th className="text-center px-3 py-3.5 font-semibold">صادر (ك)</th>
                  <th className="text-center px-3 py-3.5 font-semibold">الرصيد</th>
                  <th className="text-right px-3 py-3.5 font-semibold">بواسطة</th>
                  <th className="text-center px-3 py-3.5 font-semibold">فتح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m, idx) => {
                  const tp       = TYPE_LABELS[m.type] || { text: m.type, cls: 'bg-gray-100 text-gray-600', sign: '' };
                  // ✅ استخدام quantityIn/Out بدل quantity لتفادي NaN
                  const qIn      = safeNum(m.quantityIn);
                  const qOut     = safeNum(m.quantityOut);
                  const wIn      = safeNum(m.weightIn);
                  const wOut     = safeNum(m.weightOut);
                  const balQty   = safeNum(m.balanceQty);
                  const inv      = getInvoicePath(m);

                  return (
                    <tr key={m._id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-3 py-2.5 text-gray-400 text-xs text-center">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{fmtDate(m.date)}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">{fmtTime(m.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tp.cls}`}>{tp.text}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-blue-600 text-xs">{m.reference || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {m.season?.name
                          ? <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-medium">🌿 {m.season.name}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {m.warehouse === 'ramses'
                          ? <span className="text-blue-600 font-medium">رمسيس</span>
                          : <span className="text-purple-600 font-medium">أكتوبر</span>}
                      </td>
                      {/* ✅ وارد */}
                      <td className="px-3 py-2.5 text-center text-xs">
                        {qIn > 0
                          ? <span className="font-bold text-green-600">+{qIn.toLocaleString()}<br/><span className="font-normal text-green-500">{fmt(wIn)}ك</span></span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                      {/* ✅ صادر */}
                      <td className="px-3 py-2.5 text-center text-xs">
                        {qOut > 0
                          ? <span className="font-bold text-red-500">-{qOut.toLocaleString()}<br/><span className="font-normal text-red-400">{fmt(wOut)}ك</span></span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                      {/* الرصيد */}
                      <td className="px-3 py-2.5 text-center text-xs">
                        <span className={`font-bold ${balQty < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                          {balQty.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">{m.createdBy?.name || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        {/* ✅ فتح في Modal نفس الصفحة */}
                        {inv
                          ? <button
                              onClick={() => setInvoicePath(inv)}
                              className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg font-medium transition-colors border border-blue-200">
                              فتح ←
                            </button>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div ref={sentinelRef} className="h-4" />
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 py-4 text-blue-600 text-sm border-t border-gray-100">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                جاري تحميل المزيد من الحركات...
              </div>
            )}
            {!hasMore && movements.length > 0 && (
              <div className="text-center py-3 text-xs text-gray-400 border-t border-gray-100">
                ✓ تم عرض جميع الحركات ({movements.length.toLocaleString()} من {total.toLocaleString()})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
