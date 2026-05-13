// ─── pages/sales/SaleListPage.jsx ────────────────────────────────────────────
// ✅ Lazy Loading: 100 فاتورة كل مرة — يحمل التالية لما يوصل 80%
// ✅ فتح الفاتورة في Modal بنفس الصفحة بدون خروج
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  fetchSaleInvoices,
  fetchMoreSaleInvoices,
  approveSaleInvoice,
  suspendSaleInvoice,
  cancelSaleInvoice,
} from '../../store/slices/saleSlice';
import { useSelectedSeason } from '../../hook/Useselectedseason';
import { useSaleFilters }    from './hooks/useSaleFilters';
import SaleFilters           from './components/SaleFilters';
import SaleTable             from './components/SaleTable';
import api                   from '../../services/api';
import InvoicePrintView      from './components/InvoicePrintView';

// ── Inline Confirm Dialog ─────────────────────────────────────────────────────
function ConfirmDialog({ open, message, onConfirm, onCancel, withInput, inputLabel, inputValue, onInputChange }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <p className="text-gray-800 font-medium text-center mb-4">{message}</p>
        {withInput && (
          <input className="input-field mb-4" placeholder={inputLabel}
            value={inputValue} onChange={e => onInputChange(e.target.value)} autoFocus />
        )}
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 btn-primary">تأكيد</button>
          <button onClick={onCancel}  className="flex-1 btn-secondary">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Detail Modal (نفس الصفحة) ────────────────────────────────────────
function InvoiceModal({ invoiceId, onClose }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    api.get(`/sales/${invoiceId}`)
      .then(({ data }) => setInvoice(data))
      .catch(() => toast.error('خطأ في تحميل الفاتورة'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (!invoiceId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-auto py-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden">
        {/* شريط العنوان */}
        <div className="flex items-center justify-between px-5 py-3 bg-blue-600 text-white">
          <h2 className="font-bold text-lg">تفاصيل الفاتورة</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-500 transition-colors text-xl font-bold">
            ×
          </button>
        </div>
        <div className="overflow-auto max-h-[85vh]">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-blue-500">
              <svg className="animate-spin w-10 h-10 mr-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              جاري التحميل...
            </div>
          ) : invoice ? (
            <InvoicePrintView
              invoice={{
                ...invoice,
                customerName: invoice.customerName || invoice.customer?.name,
                customerCode: invoice.customerCode || invoice.customer?.code,
              }}
              onBack={onClose}
              backLabel="إغلاق"
              embedded
            />
          ) : (
            <div className="py-20 text-center text-gray-400">تعذّر تحميل الفاتورة</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SaleListPage() {
  const dispatch = useDispatch();
  const { list, loading, loadingMore, hasMore, total, lastParams } = useSelector(s => s.sales);
  const { user } = useSelector(s => s.auth);
  const isAdmin  = user?.role === 'admin';
  const seasonId = useSelectedSeason();

  const { filters, setFilters, apiParams } = useSaleFilters();

  // Infinite scroll sentinel ref
  const sentinelRef = useRef(null);

  // Modal state
  const [viewInvoiceId, setViewInvoiceId] = useState(null);

  // Confirm dialog state
  const [dialog, setDialog]         = useState({ open: false, type: null, id: null });
  const [suspendReason, setSuspendReason] = useState('');

  const closeDialog = useCallback(() => {
    setDialog({ open: false, type: null, id: null });
    setSuspendReason('');
  }, []);

  // جلب أول 100 عند تغيير الفلاتر
  useEffect(() => {
    if (!seasonId) return;
    dispatch(fetchSaleInvoices({ ...apiParams, seasonId }));
  }, [dispatch, seasonId, apiParams]);

  // ✅ Intersection Observer للـ lazy loading — يحمل عند 80%
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          dispatch(fetchMoreSaleInvoices({ ...apiParams, seasonId }));
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, dispatch, apiParams, seasonId]);

  // فلترة محلية بالبحث النصي
  const filtered = list.filter(inv =>
    !filters.search ||
    inv.invoiceNumber?.includes(filters.search) ||
    inv.customerName?.includes(filters.search) ||
    inv.docNumber?.includes(filters.search),
  );

  const handleFiltersChange = (next) => setFilters(next);

  // Actions
  const handleApprove = (id) => setDialog({ open: true, type: 'approve', id });
  const handleSuspend = (id) => { setSuspendReason(''); setDialog({ open: true, type: 'suspend', id }); };
  const handleCancel  = (id) => setDialog({ open: true, type: 'cancel', id });
  const handleView    = (id) => setViewInvoiceId(id);

  const handleConfirm = async () => {
    const { type, id } = dialog;
    closeDialog();
    if (type === 'approve') {
      const res = await dispatch(approveSaleInvoice(id));
      if (!res.error) toast.success('تم الموافقة وخصم المخزون ✅');
      else toast.error(res.payload);
    }
    if (type === 'suspend') {
      const res = await dispatch(suspendSaleInvoice({ id, reason: suspendReason }));
      if (!res.error) toast.success('تم التعليق');
      else toast.error(res.payload);
    }
    if (type === 'cancel') {
      const res = await dispatch(cancelSaleInvoice(id));
      if (!res.error) toast.success('تم الإلغاء');
      else toast.error(res.payload);
    }
  };

  const dialogConfig = {
    approve: { message: 'هتوافق على الفاتورة وتخصم من المخزن؟' },
    suspend: { message: 'تعليق الفاتورة؟', withInput: true, inputLabel: 'سبب التعليق (اختياري)' },
    cancel:  { message: 'هتلغي الفاتورة دي نهائياً؟' },
  };
  const cfg = dialogConfig[dialog.type] || {};

  const loadedCount = list.length;
  const pct         = total > 0 ? Math.round((loadedCount / total) * 100) : 100;

  return (
    <div>
      {/* Invoice Modal */}
      <InvoiceModal invoiceId={viewInvoiceId} onClose={() => setViewInvoiceId(null)} />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={dialog.open} message={cfg.message} withInput={cfg.withInput}
        inputLabel={cfg.inputLabel} inputValue={suspendReason}
        onInputChange={setSuspendReason} onConfirm={handleConfirm} onCancel={closeDialog}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">فواتير المبيعات</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-sm text-gray-400">
              {filtered.length.toLocaleString()} / {total.toLocaleString()} فاتورة
              {!filters.showAllDates && (
                ` • ${filters.dateFrom === filters.dateTo
                  ? filters.dateFrom
                  : `${filters.dateFrom} → ${filters.dateTo}`}`
              )}
            </p>
            {/* Progress bar */}
            {total > 100 && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span>{pct}% محمّل</span>
              </div>
            )}
          </div>
        </div>
        <Link to="/sales/new" className="btn-primary">+ فاتورة جديدة</Link>
      </div>

      {/* Filters */}
      <SaleFilters filters={filters} onChange={handleFiltersChange} />

      {/* Table */}
      <SaleTable
        invoices={filtered}
        loading={loading}
        showAllDates={filters.showAllDates}
        isAdmin={isAdmin}
        onApprove={handleApprove}
        onSuspend={handleSuspend}
        onCancel={handleCancel}
        onView={handleView}
      />

      {/* ✅ Lazy Load Sentinel */}
      <div ref={sentinelRef} className="h-8 flex items-center justify-center mt-2">
        {loadingMore && (
          <div className="flex items-center gap-2 text-blue-500 text-sm py-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            جاري تحميل المزيد... ({loadedCount.toLocaleString()} / {total.toLocaleString()})
          </div>
        )}
        {!hasMore && list.length > 0 && !loading && (
          <p className="text-xs text-gray-400 py-2">
            ✓ تم تحميل جميع الفواتير ({list.length.toLocaleString()})
          </p>
        )}
      </div>
    </div>
  );
}
