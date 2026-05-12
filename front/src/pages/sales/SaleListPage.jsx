// SaleListPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  fetchSaleInvoices,
  approveSaleInvoice,
  suspendSaleInvoice,
  cancelSaleInvoice,
} from '../../store/slices/saleSlice';
import { useSelectedSeason } from '../../hook/Useselectedseason';
import { useSaleFilters }    from './hooks/useSaleFilters';
import SaleFilters           from './components/SaleFilters';
import SaleTable             from './components/SaleTable';

// ── Inline Confirm Dialog — بديل window.confirm/prompt بدون focus-loss ────────
function ConfirmDialog({ open, message, onConfirm, onCancel, withInput, inputLabel, inputValue, onInputChange }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-gray-800 font-medium text-center mb-4">{message}</p>
        {withInput && (
          <input
            className="input-field mb-4"
            placeholder={inputLabel}
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            autoFocus
          />
        )}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 btn-primary"
          >
            تأكيد
          </button>
          <button
            onClick={onCancel}
            className="flex-1 btn-secondary"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SaleListPage() {
  const dispatch          = useDispatch();
  const { list, loading } = useSelector(s => s.sales);
  const { user }          = useSelector(s => s.auth);
  const isAdmin           = user?.role === 'admin';
  const seasonId          = useSelectedSeason();

  const { filters, setFilters, apiParams } = useSaleFilters();
  const [page, setPage] = useState(1);

  // ── dialog state ─────────────────────────────────────────────────────────
  const [dialog, setDialog] = useState({ open: false, type: null, id: null });
  const [suspendReason, setSuspendReason] = useState('');

  const closeDialog = useCallback(() => {
    setDialog({ open: false, type: null, id: null });
    setSuspendReason('');
  }, []);

  // ── جلب البيانات عند تغيير الفلتر أو الموسم ──────────────────────────────
  // apiParams مُحفوظ بـ useMemo → هيتغير بس لما القيم الفعلية تتغير فعلاً
  useEffect(() => {
    if (!seasonId) return;
    setPage(1);
    dispatch(fetchSaleInvoices({ ...apiParams, seasonId }));
  }, [dispatch, seasonId, apiParams]);

  // ── فلترة محلية بالبحث النصي ─────────────────────────────────────────────
  const filtered = list
    .filter(inv =>
      !filters.search ||
      inv.invoiceNumber?.includes(filters.search) ||
      inv.customerName?.includes(filters.search) ||
      inv.docNumber?.includes(filters.search),
    )
    .slice()
    .sort((a, b) => {
      const na = parseInt(a.invoiceNumber?.replace(/\D/g, '') || '0', 10);
      const nb = parseInt(b.invoiceNumber?.replace(/\D/g, '') || '0', 10);
      return nb - na;
    });

  const handleFiltersChange = (next) => {
    if (next.search !== filters.search) setPage(1);
    setFilters(next);
  };

  // ── actions — بدون window.confirm/prompt ─────────────────────────────────
  const handleApprove = (id) => {
    setDialog({ open: true, type: 'approve', id });
  };

  const handleSuspend = (id) => {
    setSuspendReason('');
    setDialog({ open: true, type: 'suspend', id });
  };

  const handleCancel = (id) => {
    setDialog({ open: true, type: 'cancel', id });
  };

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

  return (
    <div>
      {/* Inline Confirm Dialog */}
      <ConfirmDialog
        open={dialog.open}
        message={cfg.message}
        withInput={cfg.withInput}
        inputLabel={cfg.inputLabel}
        inputValue={suspendReason}
        onInputChange={setSuspendReason}
        onConfirm={handleConfirm}
        onCancel={closeDialog}
      />

      {/* هيدر */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">فواتير المبيعات</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {filtered.length} فاتورة
            {!filters.showAllDates && (
              ` • ${filters.dateFrom === filters.dateTo
                ? filters.dateFrom
                : `${filters.dateFrom} → ${filters.dateTo}`}`
            )}
          </p>
        </div>
        <Link to="/sales/new" className="btn-primary">+ فاتورة جديدة</Link>
      </div>

      {/* فلاتر */}
      <SaleFilters filters={filters} onChange={handleFiltersChange} />

      {/* الجدول */}
      <SaleTable
        invoices={filtered}
        loading={loading}
        showAllDates={filters.showAllDates}
        isAdmin={isAdmin}
        onApprove={handleApprove}
        onSuspend={handleSuspend}
        onCancel={handleCancel}
        page={page}
        onPageChange={setPage}
      />
    </div>
  );
}
