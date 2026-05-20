// ─── pages/suppliers/SupplierStatementPage.jsx ───────────────────────────────
// كشف حساب المورد
// • جدول واحد موحد — كل الحركات مرتبة بالتاريخ (فواتير + مرتجعات + مدفوعات)
// • أعمدة: التاريخ | رقم المستند | نوع الحركة | مسحوبات | مدفوعات | له | عليه
// • الكروت الـ 4 مخفية في الطباعة
// • طباعة + إضافة/تعديل دفعة
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState, useCallback, useEffect } from 'react';
import { useSearchParams, Link }  from 'react-router-dom';
import { useSelector }            from 'react-redux';
import { useReactToPrint }        from 'react-to-print';
import toast                      from 'react-hot-toast';

import api                          from '../../services/api';
import SupplierSearch               from '../../components/common/SupplierSearch';
import PaymentModal                 from '../../components/common/PaymentModal';
import { STATEMENT_PRINT_STYLE, COMPANY_NAME } from '../../components/constants/printStyles';

import { useSupplierTimelineData }        from './hooks/useSupplierTimelineData';
import SupplierSummaryCards               from './components/SupplierSummaryCards';
import SupplierPrintHeader                from './components/SupplierPrintHeader';
import LazySupplierStatementTable         from './components/LazySupplierStatementTable';

const EMPTY_FORM = {
  receiptNumber: '', amount: '', paymentMethod: 'cash',
  cashAmount: '', instapayAmount: '',
  date: new Date().toISOString().split('T')[0],
  reference: '', notes: '',
};

export default function SupplierStatementPage() {
  const { user }  = useSelector((s) => s.auth);
  const isAdmin   = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();

  const stmt     = useSupplierTimelineData();
  const printRef = useRef(null);

  useEffect(() => {
    const urlSupplierId = searchParams.get('supplierId');
    const urlSeasonId   = searchParams.get('seasonId') || '';
    if (!urlSupplierId) return;

    api.get(`/suppliers/${urlSupplierId}`)
      .then(({ data }) => {
        stmt.selectSupplier(data);
        if (urlSeasonId) stmt.changeSeason(urlSeasonId);
      })
      .catch(() => {
        api.get('/suppliers').then(({ data }) => {
          const found = data.find((s) => s._id === urlSupplierId || s.id === urlSupplierId);
          if (found) {
            stmt.selectSupplier(found);
            if (urlSeasonId) stmt.changeSeason(urlSeasonId);
          }
        }).catch(() => {});
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateURL = (sup, sid) => {
    const params = {};
    if (sup?._id || sup?.id) params.supplierId   = sup._id || sup.id;
    if (sup?.name)           params.supplierName = sup.name;
    if (sid)                 params.seasonId     = sid;
    setSearchParams(params, { replace: true });
  };

  const handleSupplierSelect = (s)   => { stmt.selectSupplier(s);   updateURL(s, stmt.seasonId); };
  const handleSeasonChange   = (sid) => { stmt.changeSeason(sid);   updateURL(stmt.supplier, sid); };

  const backToStatement = stmt.supplier
    ? `/suppliers/statement?supplierId=${stmt.supplier._id || stmt.supplier.id}&supplierName=${encodeURIComponent(stmt.supplier.name)}${stmt.seasonId ? `&seasonId=${stmt.seasonId}` : ''}`
    : '/suppliers/statement';

  // ── موديل الدفع ──────────────────────────────────────────────────────────
  const [payOpen,      setPayOpen]      = useState(false);
  const [payForm,      setPayForm]      = useState(EMPTY_FORM);
  const [payError,     setPayError]     = useState('');
  const [payChecking,  setPayChecking]  = useState(false);
  const [editingPayId, setEditingPayId] = useState(null);

  const openAdd = () => {
    setPayForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setPayError(''); setEditingPayId(null); setPayOpen(true);
  };

  const openEdit = useCallback((p) => {
    setPayForm({
      receiptNumber:  p.receiptNumber  || '',
      amount:         p.amount         || '',
      paymentMethod:  p.paymentMethod  || 'cash',
      cashAmount:     p.cashAmount     || '',
      instapayAmount: p.instapayAmount || '',
      date: p.date ? new Date(p.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      reference: p.reference || '',
      notes:     p.notes     || '',
    });
    setPayError(''); setEditingPayId(p._id || p.id); setPayOpen(true);
  }, []);

  const closePayModal = () => { setPayOpen(false); setPayError(''); };

  const handleReceiptChange = async (val) => {
    setPayForm((f) => ({ ...f, receiptNumber: val }));
    if (!val.trim()) { setPayError(''); return; }
    setPayChecking(true);
    try {
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
    if (!stmt.supplier) return;

    const activeSeason = stmt.seasonId
      ? stmt.seasons.find((s) => s._id === stmt.seasonId || s.id === stmt.seasonId)
      : stmt.seasons.find((s) => s.isActive) || stmt.seasons[0];

    const payload = {
      ...payForm, amount: Number(payForm.amount),
      supplierId:   stmt.supplier._id || stmt.supplier.id,
      supplierCode: stmt.supplier.code,
      supplierName: stmt.supplier.name,
      type:         'supplier_payment',
      seasonId:     activeSeason?._id || activeSeason?.id,
    };

    try {
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

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `كشف حساب مورد - ${stmt.supplier?.name || ''}`,
    pageStyle: STATEMENT_PRINT_STYLE,
  });

  const balance    = stmt.totals?.balance || 0;
  const seasonName = stmt.seasons?.find(s => s._id === stmt.seasonId || s.id === stmt.seasonId)?.name;

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── هيدر الصفحة ── */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/suppliers" className="text-gray-400 hover:text-gray-600 text-sm">← الموردين</Link>
          <h1 className="text-2xl font-bold text-gray-800">كشف حساب مورد</h1>
        </div>
        {(stmt.totals || stmt.rows.length > 0) && (
          <div className="flex gap-2">
            {isAdmin && <button className="btn-primary" onClick={openAdd}>💰 تسجيل دفعة</button>}
            <button className="btn-secondary" onClick={handlePrint}>🖨️ طباعة</button>
          </div>
        )}
      </div>

      {/* ── اختيار المورد والموسم ── */}
      <div className="card mb-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">المورد</label>
            <SupplierSearch value={stmt.supplier} onSelect={handleSupplierSelect} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">الموسم</label>
            <select
              className="input-field"
              value={stmt.seasonId}
              onChange={(e) => handleSeasonChange(e.target.value)}
              disabled={!stmt.supplier}
            >
              <option value="">الموسم النشط</option>
              {stmt.seasons.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.name} {s.isActive ? '✅' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {stmt.supplier && (
        <div ref={printRef}>

          <SupplierPrintHeader supplier={stmt.supplier} seasonName={seasonName} totals={stmt.totals} />

          {/* معلومات المورد + الرصيد — مخفية في الطباعة */}
          {stmt.totals && (
            <div className="card mb-4 print:hidden">
              <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{stmt.supplier?.name}</h2>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-gray-500">
                    <span>كود: <b className="text-gray-700">{stmt.supplier?.code}</b></span>
                    {stmt.supplier?.phone && <span>📞 {stmt.supplier.phone}</span>}
                    {seasonName && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                        {seasonName}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`text-center px-6 py-3 rounded-xl border-2 ${balance > 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
                  <p className={`text-xs font-medium mb-1 ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {balance > 0 ? '⚠️ مستحق للمورد' : '✅ لا يوجد رصيد'}
                  </p>
                  <p className={`text-3xl font-bold ${balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {Math.abs(balance).toFixed(2)}
                  </p>
                  <p className={`text-xs ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>ج.م</p>
                </div>
              </div>
              <div className="mt-4">
                <SupplierSummaryCards statement={{
                  totalPurchases: stmt.totals.totalPurchases,
                  totalReturns:   stmt.totals.totalReturns,
                  totalPaid:      stmt.totals.totalPaid,
                  balance:        stmt.totals.balance,
                  netPurchases:   stmt.totals.netPurchases,
                }} />
              </div>
            </div>
          )}

          {/* الجدول الموحد بـ Lazy Loading */}
          <LazySupplierStatementTable
            rows={stmt.rows}
            totals={stmt.totals}
            counts={stmt.counts}
            loading={stmt.loading}
            loadingMore={stmt.loadingMore}
            hasMore={stmt.hasMore}
            onLoadMore={stmt.loadMore}
            initialBalance={stmt.supplier?.initialBalance || 0}
            backToStatement={backToStatement}
            onEditPayment={isAdmin ? openEdit : null}
          />

          {/* تذييل الطباعة الاحترافي */}
          <div className="hidden print:block print-footer-block" style={{ marginTop: '16px', borderTop: '2px solid #1e293b', paddingTop: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'center', fontSize: '10px', color: '#6b7280' }}>
              <div>
                <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '8px', marginTop: '28px', fontSize: '10px' }}>
                  توقيع المورد
                </div>
                <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>{stmt.supplier?.name}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>{COMPANY_NAME}</div>
                <div style={{ fontSize: '9px', marginBottom: '2px' }}>تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</div>
                <div style={{ fontSize: '9px', color: '#9ca3af' }}>
                  {seasonName || 'الموسم النشط'} — {stmt.counts?.total ?? 0} حركة
                </div>
                <div style={{
                  marginTop: '6px', fontSize: '9px', fontWeight: 700,
                  color: (stmt.totals?.balance ?? 0) > 0 ? '#dc2626' : '#15803d',
                  background: (stmt.totals?.balance ?? 0) > 0 ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${(stmt.totals?.balance ?? 0) > 0 ? '#fca5a5' : '#86efac'}`,
                  borderRadius: '4px', padding: '2px 6px',
                }}>
                  الرصيد: {Math.abs(stmt.totals?.balance ?? 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                  {(stmt.totals?.balance ?? 0) > 0 ? ' (مستحق للمورد)' : ' (دائن)'}
                </div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '8px', marginTop: '28px', fontSize: '10px' }}>
                  توقيع المحاسب
                </div>
                <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>المسؤول</div>
              </div>
            </div>
            <div style={{ height: '3px', background: 'linear-gradient(90deg,#1e293b 0%,#3b82f6 50%,#93c5fd 100%)', borderRadius: '2px', marginTop: '10px' }} />
          </div>

        </div>
      )}

      {payOpen && (
        <PaymentModal
          title={editingPayId ? '✏️ تعديل دفعة' : `💰 دفعة — ${stmt.supplier?.name}`}
          form={payForm}
          setForm={setPayForm}
          error={payError}
          checking={payChecking}
          balance={balance}
          balanceLabel="مستحق للمورد"
          isEdit={!!editingPayId}
          onReceiptChange={handleReceiptChange}
          onSubmit={handlePaySubmit}
          onClose={closePayModal}
        />
      )}
    </div>
  );
}
