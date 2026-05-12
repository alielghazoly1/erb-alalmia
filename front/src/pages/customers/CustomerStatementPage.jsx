// ─── CustomerStatementPage.jsx ───────────────────────────────────────────────
// صفحة كشف الحساب الكامل لعميل
// • جدول واحد موحد — كل الحركات مرتبة بالتاريخ (فواتير + مرتجعات + مدفوعات)
// • Lazy Loading بـ Intersection Observer — يجيب الداتا كل ما تسكرول للآخر
// • الـ totals محسوبة من الباك بـ aggregate مرة واحدة (دقيقة حتى مع الـ lazy loading)
// ────────────────────────────────────────────────────────────────────────────
import { useRef, useState, useCallback, useEffect } from 'react';
import { Link, useSearchParams }  from 'react-router-dom';
import { useSelector }            from 'react-redux';
import { useReactToPrint }        from 'react-to-print';
import toast                      from 'react-hot-toast';

import { useTimelineStatement }  from './hooks/useTimelineStatement';
import CustomerSearch            from '../../components/common/CustomerSearch';
import PaymentModal              from '../../components/common/PaymentModal';
import StatementHeader           from './components/StatementHeader';
import PrintHeader               from './components/PrintHeader';
import StatementSummaryCards     from './components/StatementSummaryCards';
import LazyStatementTable        from './components/LazyStatementTable';

const EMPTY_FORM = {
  receiptNumber: '', amount: '', paymentMethod: 'cash',
  cashAmount: '', instapayAmount: '',
  date: new Date().toISOString().split('T')[0],
  reference: '', notes: '',
};

export default function CustomerStatementPage() {
  const { user } = useSelector((s) => s.auth);
  const isAdmin  = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();

  const stmt = useTimelineStatement();

  // تحميل العميل من URL عند الدخول الأول
  useEffect(() => {
    const urlCustomerId = searchParams.get('customerId');
    const urlSeasonId   = searchParams.get('seasonId') || '';
    if (!urlCustomerId) return;
    import('../../services/api').then(({ default: api }) => {
      api.get(`/customers/${urlCustomerId}/statement`, {
        params: { ...(urlSeasonId ? { seasonId: urlSeasonId } : {}) },
      })
        .then(({ data }) => {
          if (data.customer) {
            stmt.selectCustomer(data.customer);
            if (urlSeasonId) stmt.changeSeason(urlSeasonId);
          }
        })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateURL = (c, sid) => {
    const params = {};
    if (c?._id)  params.customerId   = c._id;
    if (c?.name) params.customerName = c.name;
    if (sid)     params.seasonId     = sid;
    setSearchParams(params, { replace: true });
  };

  const backToStatement = stmt.customer
    ? `/customers/statement?customerId=${stmt.customer._id}&customerName=${encodeURIComponent(stmt.customer.name)}${stmt.seasonId ? `&seasonId=${stmt.seasonId}` : ''}`
    : '/customers/statement';

  const handleSelectCustomer = (c)   => { stmt.selectCustomer(c);   updateURL(c, stmt.seasonId); };
  const handleChangeSeason   = (sid) => { stmt.changeSeason(sid);   updateURL(stmt.customer, sid); };

  // ── موديل الدفع ──────────────────────────────────────────────────────────
  const [payModalOpen,  setPayModalOpen]  = useState(false);
  const [payForm,       setPayForm]       = useState(EMPTY_FORM);
  const [payError,      setPayError]      = useState('');
  const [payChecking,   setPayChecking]   = useState(false);
  const [editingPayId,  setEditingPayId]  = useState(null);

  const openAddPayment = () => {
    setPayForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setPayError(''); setEditingPayId(null); setPayModalOpen(true);
  };

  const openEditPayment = useCallback((payment) => {
    setPayForm({
      receiptNumber:  payment.receiptNumber  || '',
      amount:         payment.amount         || '',
      paymentMethod:  payment.paymentMethod  || 'cash',
      cashAmount:     payment.cashAmount     || '',
      instapayAmount: payment.instapayAmount || '',
      date: payment.date
        ? new Date(payment.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      reference: payment.reference || '',
      notes:     payment.notes     || '',
    });
    setPayError(''); setEditingPayId(payment._id); setPayModalOpen(true);
  }, []);

  const closePayModal = () => { setPayModalOpen(false); setPayError(''); };

  const handleReceiptChange = async (val) => {
    setPayForm((f) => ({ ...f, receiptNumber: val }));
    if (!val.trim()) { setPayError(''); return; }
    setPayChecking(true);
    try {
      const { default: api } = await import('../../services/api');
      const { data } = await api.get('/payments/check-receipt', {
        params: { receiptNumber: val, excludeId: editingPayId || undefined },
      });
      setPayError(data.exists ? 'رقم الوصل موجود بالفعل' : '');
    } catch { setPayError(''); }
    finally  { setPayChecking(false); }
  };

  const handlePaySubmit = async () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error('أدخل مبلغ صحيح');
    if (payError) return toast.error('صلح رقم الوصل الأول');
    if (!stmt.customer) return;
    try {
      const { default: api } = await import('../../services/api');
      const activeSeason = stmt.seasonId
        ? stmt.seasons.find((s) => s._id === stmt.seasonId)
        : stmt.seasons.find((s) => s.isActive) || stmt.seasons[0];
      const payload = {
        ...payForm, amount: Number(payForm.amount),
        customerId:   stmt.customer._id,
        customerCode: stmt.customer.code,
        customerName: stmt.customer.name,
        type:         'customer_payment',
        seasonId:     activeSeason?._id,
      };
      if (editingPayId) {
        await api.put(`/payments/${editingPayId}`, payload);
        toast.success('تم تعديل الدفعة');
      } else {
        await api.post('/payments', payload);
        toast.success('تم تسجيل الدفعة');
      }
      closePayModal();
      stmt.reload();
    } catch (err) { toast.error(err.response?.data?.message || 'حدث خطأ'); }
  };

  // ── الطباعة ───────────────────────────────────────────────────────────────
  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `كشف حساب — ${stmt.customer?.name || ''}`,
    pageStyle: `
      @page { size: A4; margin: 12mm 10mm; }
      @media print { body { font-size: 11px; direction: rtl; } }
    `,
  });

  const selectedSeasonName = stmt.seasonId
    ? stmt.seasons.find((s) => s._id === stmt.seasonId)?.name
    : null;

  return (
    <div>

      {/* ── هيدر الصفحة ── */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/customers" className="text-gray-400 hover:text-gray-600">← العملاء</Link>
        <h1 className="text-2xl font-bold text-gray-800">كشف حساب</h1>
      </div>

      {/* ── اختيار العميل ── */}
      <div className="card mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">اختر العميل</label>
        <CustomerSearch value={stmt.customer} onSelect={handleSelectCustomer} />
      </div>

      {stmt.customer && (
        <>
          <StatementHeader
            customer={stmt.customer}
            seasons={stmt.seasons}
            seasonId={stmt.seasonId}
            onSeasonChange={handleChangeSeason}
            onPrint={handlePrint}
            onAddPayment={openAddPayment}
            isAdmin={isAdmin}
          />

          <div ref={printRef}>
            {/* رأس الطباعة */}
            <PrintHeader customer={stmt.customer} seasonName={selectedSeasonName} />

            {/* الكروت — مخفية في الطباعة */}
            {stmt.totals && (
              <StatementSummaryCards statement={{
                totalSales:   stmt.totals.totalSales,
                totalPaid:    stmt.totals.totalPaid,
                totalReturns: stmt.totals.totalReturns,
                balance:      stmt.totals.balance,
                netSales:     stmt.totals.netSales,
              }} />
            )}

            {/* الجدول الموحد بـ Lazy Loading */}
            <LazyStatementTable
              rows={stmt.rows}
              totals={stmt.totals}
              counts={stmt.counts}
              loading={stmt.loading}
              loadingMore={stmt.loadingMore}
              hasMore={stmt.hasMore}
              onLoadMore={stmt.loadMore}
              initialBalance={stmt.customer?.initialBalance || 0}
              backToStatement={backToStatement}
              onEditPayment={isAdmin ? openEditPayment : null}
            />

            <div className="hidden print:block mt-6 pt-4 border-t text-center text-xs text-gray-400">
              تم الطباعة بتاريخ {new Date().toLocaleDateString('ar-EG')}
            </div>
          </div>
        </>
      )}

      {payModalOpen && (
        <PaymentModal
          title={editingPayId ? '✏️ تعديل دفعة' : '💰 إضافة دفعة'}
          form={payForm}
          setForm={setPayForm}
          error={payError}
          checking={payChecking}
          balance={stmt.totals?.balance ?? 0}
          isEdit={!!editingPayId}
          onReceiptChange={handleReceiptChange}
          onSubmit={handlePaySubmit}
          onClose={closePayModal}
        />
      )}
    </div>
  );
}
