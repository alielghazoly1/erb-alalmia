// ─── LazyStatementTable.jsx ───────────────────────────────────────────────────
// جدول كشف الحساب الموحد بـ Lazy Loading — مشترك بين العملاء والموردين
// • running balance محسوب في الباك ودقيق
// • الرصيد الابتدائي يظهر كأول صف مستقل
// • كل الأرقام تمر عبر toNum() لتجنب Prisma Decimal bugs
import { useRef, useEffect, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toNum } from '../../../utils/fmt';

const PREFETCH_BEFORE = 20;

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt  = (v) => toNum(v).toLocaleString('ar-EG', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const fmtD = (d) => d ? new Date(d).toLocaleDateString('ar-EG') : '—';

// ── row type config ───────────────────────────────────────────────────────────
const TYPE_CFG = {
  invoice: { label: 'فاتورة بيع',    bg: '#eff6ff', badge: '#2563eb', text: '#1e40af', link: (id) => `/sales/${id}`   },
  return:  { label: 'مرتجع',         bg: '#fff7ed', badge: '#ea580c', text: '#9a3412', link: (id) => `/returns/${id}` },
  payment: { label: 'سداد',           bg: '#f0fdf4', badge: '#16a34a', text: '#14532d', link: null                     },
  opening: { label: 'رصيد ابتدائي',  bg: '#fefce8', badge: '#ca8a04', text: '#713f12', link: null                     },

  // للموردين
  purchase:         { label: 'فاتورة توريد', bg: '#eff6ff', badge: '#2563eb', text: '#1e40af', link: (id) => `/purchase/${id}` },
  supplier_return:  { label: 'مرتجع',        bg: '#fff7ed', badge: '#ea580c', text: '#9a3412', link: (id) => `/returns/${id}`  },
  supplier_payment: { label: 'دفع',           bg: '#f0fdf4', badge: '#16a34a', text: '#14532d', link: null                      },
};

// ── StatementRow ──────────────────────────────────────────────────────────────
const StatementRow = memo(function StatementRow({
  row, idx, onEditPayment, backToStatement, sentinelRef,
}) {
  const cfg      = TYPE_CFG[row.rowType] || TYPE_CFG.invoice;
  const amount   = toNum(row.amount);
  const balance  = toNum(row.runningBalance);
  const isDebit  = ['invoice', 'purchase', 'opening'].includes(row.rowType);
  const isNeg    = balance < 0;
  const docNum   = row.docNumber || row.invoiceNumber || row.receiptNumber || '—';
  const link     = cfg.link ? cfg.link(row._id) : null;
  const isOpening = row.rowType === 'opening';

  return (
    <tr
      ref={sentinelRef || null}
      style={{
        background:   isOpening ? '#fefce8' : idx % 2 === 0 ? cfg.bg : 'white',
        borderBottom: '1px solid #e2e8f0',
        fontStyle:    isOpening ? 'italic' : 'normal',
      }}
    >
      <td style={{ padding: '7px 6px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
        {isOpening ? '—' : idx}
      </td>
      <td style={{ padding: '7px 6px', textAlign: 'right', color: '#475569', fontSize: '11px' }}>
        {isOpening ? '—' : fmtD(row.date)}
      </td>
      <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '11px' }}>
        {link ? (
          <Link
            to={link}
            state={{ backTo: backToStatement, backLabel: 'كشف الحساب' }}
            style={{ color: cfg.text, textDecoration: 'none' }}
          >
            {docNum}
          </Link>
        ) : (
          <span style={{ color: isOpening ? '#92400e' : '#374151', fontWeight: isOpening ? 600 : 400 }}>{docNum}</span>
        )}
      </td>
      <td style={{ padding: '7px 6px', textAlign: 'center' }}>
        <span style={{
          background:   cfg.badge,
          color:        'white',
          borderRadius: '4px',
          padding:      '2px 7px',
          fontSize:     '10px',
          fontWeight:   600,
        }}>
          {cfg.label}
        </span>
      </td>

      {/* مسحوبات (مدين) */}
      <td style={{ padding: '7px 6px', textAlign: 'center', color: '#1d4ed8', fontWeight: isDebit ? 600 : 400, fontSize: '11px' }}>
        {isDebit ? fmt(amount) : <span style={{ color: '#cbd5e1' }}>—</span>}
      </td>

      {/* مدفوعات (دائن) */}
      <td style={{ padding: '7px 6px', textAlign: 'center', color: '#15803d', fontWeight: !isDebit ? 600 : 400, fontSize: '11px' }}>
        {!isDebit ? fmt(amount) : <span style={{ color: '#cbd5e1' }}>—</span>}
      </td>

      {/* له (balance سالب = دائن) */}
      <td style={{ padding: '7px 6px', textAlign: 'center', color: '#15803d', fontWeight: isNeg ? 600 : 400, fontSize: '11px' }}>
        {isNeg ? fmt(Math.abs(balance)) : <span style={{ color: '#cbd5e1' }}>—</span>}
      </td>

      {/* عليه (balance موجب = مدين) */}
      <td style={{ padding: '7px 6px', textAlign: 'center', color: '#dc2626', fontWeight: !isNeg ? 600 : 400, fontSize: '11px' }}>
        {!isNeg ? fmt(balance) : <span style={{ color: '#cbd5e1' }}>—</span>}
      </td>

      <td style={{ padding: '7px 6px', textAlign: 'center' }} className="print:hidden">
        {row.rowType === 'payment' && onEditPayment ? (
          <button
            onClick={() => onEditPayment(row)}
            style={{ color: '#3b82f6', fontSize: '11px', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            ✏️
          </button>
        ) : link ? (
          <Link
            to={link}
            state={{ backTo: backToStatement, backLabel: 'كشف الحساب' }}
            style={{ color: '#64748b', fontSize: '13px' }}
          >
            ←
          </Link>
        ) : null}
      </td>
    </tr>
  );
});

// ── LazyStatementTable ────────────────────────────────────────────────────────
export default function LazyStatementTable({
  rows = [], totals = null, counts = null,
  loading = false, loadingMore = false, hasMore = false,
  onLoadMore, backToStatement, onEditPayment,
  entityType = 'customer',   // 'customer' | 'supplier'
}) {
  const sentinelRef = useRef(null);
  const observerRef = useRef(null);
  const sentinelIdx = Math.max(0, rows.length - PREFETCH_BEFORE);

  const setupObserver = useCallback(() => {
    observerRef.current?.disconnect();
    if (!sentinelRef.current || !onLoadMore || !hasMore) return;
    observerRef.current = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loadingMore) onLoadMore(); },
      { threshold: 0.1 },
    );
    observerRef.current.observe(sentinelRef.current);
  }, [hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    setupObserver();
    return () => observerRef.current?.disconnect();
  }, [setupObserver, rows.length]);

  if (loading) return (
    <div className="card" style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
      <div style={{ fontSize: '14px' }}>جاري تحميل الكشف...</div>
    </div>
  );

  if (!rows.length) return (
    <div className="card" style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
      لا يوجد حركات
    </div>
  );

  // حساب الإجماليات
  const debitRows   = rows.filter(r => ['invoice', 'purchase', 'opening'].includes(r.rowType));
  const creditRows  = rows.filter(r => !['invoice', 'purchase', 'opening'].includes(r.rowType));
  const totalDebit  = toNum(totals?.[entityType === 'supplier' ? 'totalPurchases' : 'totalSales']) ||
                      debitRows.reduce((s, r) => s + toNum(r.amount), 0);
  const totalCredit = creditRows.reduce((s, r) => s + toNum(r.amount), 0);
  const balance     = toNum(totals?.balance);

  const COLS = [
    { label: '#',           w: '3%',  align: 'center'  },
    { label: 'التاريخ',     w: '10%', align: 'right'   },
    { label: 'رقم المستند', w: '13%', align: 'right'   },
    { label: 'نوع الحركة', w: '12%', align: 'center'  },
    { label: 'مسحوبات',     w: '13%', align: 'center'  },
    { label: 'مدفوعات',     w: '13%', align: 'center'  },
    { label: 'له',          w: '13%', align: 'center'  },
    { label: 'عليه',        w: '13%', align: 'center'  },
    { label: '',            w: '6%',  align: 'center', printHide: true },
  ];

  return (
    <div className="card mb-4 print:shadow-none print:border">
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: 0 }}>📋 حركات الحساب</h3>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b' }}>
          {counts && (
            <>
              <span>🧾 {counts.invoices} فاتورة</span>
              <span>↩️ {counts.returns} مرتجع</span>
              <span>💰 {counts.payments} دفعة</span>
            </>
          )}
          <span style={{ color: '#94a3b8' }}>
            {rows.filter(r => r.rowType !== 'opening').length}{hasMore ? ` من ${counts?.total ?? '...'}` : ''} معروض
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: '2px solid #1e293b', borderBottom: '2px solid #1e293b', background: '#f1f5f9' }}>
              {COLS.map((col, i) => (
                <th key={i}
                  style={{ width: col.w, padding: '8px 6px', textAlign: col.align, fontSize: '11px', fontWeight: 700, color: '#1e293b' }}
                  className={col.printHide ? 'print:hidden' : ''}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => (
              <StatementRow
                key={row._id}
                row={row}
                idx={row.rowType === 'opening' ? 0 : idx}
                onEditPayment={onEditPayment}
                backToStatement={backToStatement}
                sentinelRef={idx === sentinelIdx ? sentinelRef : null}
              />
            ))}
          </tbody>

          <tfoot>
            <tr style={{ borderTop: '2px solid #1e293b', background: '#f8fafc', fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: '9px 6px', textAlign: 'right', fontSize: '12px', color: '#1e293b' }}>الإجمالي الكلي</td>
              <td style={{ padding: '9px 6px', textAlign: 'center', color: '#1d4ed8', fontSize: '12px' }}>{fmt(totalDebit)}</td>
              <td style={{ padding: '9px 6px', textAlign: 'center', color: '#15803d', fontSize: '12px' }}>{fmt(totalCredit)}</td>
              <td style={{ padding: '9px 6px', textAlign: 'center', color: '#15803d', fontSize: '12px' }}>
                {balance < 0 ? fmt(Math.abs(balance)) : '—'}
              </td>
              <td style={{ padding: '9px 6px', textAlign: 'center', color: '#dc2626', fontSize: '12px' }}>
                {balance >= 0 ? fmt(balance) : '—'}
              </td>
              <td className="print:hidden" />
            </tr>

            {totals && (
              <tr style={{ borderTop: '1px solid #e2e8f0', background: balance > 0 ? '#fef2f2' : '#f0fdf4' }}>
                <td colSpan={6} style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                  {balance > 0 ? '⚠️ الرصيد المستحق (عليه)' : balance < 0 ? '✅ الرصيد (له)' : '✅ حساب متوازن'}
                </td>
                <td colSpan={2} style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: '16px', color: balance > 0 ? '#dc2626' : '#15803d' }}>
                  {fmt(Math.abs(balance))} ج.م
                </td>
                <td className="print:hidden" />
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {loadingMore && (
        <div style={{ textAlign: 'center', padding: '14px', color: '#6b7280', fontSize: '12px' }}>⏳ جاري تحميل المزيد...</div>
      )}
      {!hasMore && rows.length > 0 && (
        <div style={{ textAlign: 'center', padding: '10px', color: '#9ca3af', fontSize: '11px' }}>
          ✅ تم عرض كل الحركات ({rows.filter(r => r.rowType !== 'opening').length})
        </div>
      )}
    </div>
  );
}
