// ─── LazyStatementTable.jsx ───────────────────────────────────────────────────
// جدول كشف الحساب الموحد بـ Lazy Loading — مشترك بين العملاء والموردين
//
// ┌─ منطق الأعمدة ─────────────────────────────────────────────────────────────┐
// │  للعميل:                                                                   │
// │    مسحوبات = فواتير بيع  (العميل مدين للشركة → عليه)                      │
// │    مدفوعات = سداد + مرتجع (يُقلّل ما على العميل → له)                     │
// │    رصيد موجب = عليه (العميل مدين)  | رصيد سالب = له (الشركة مدينة)       │
// │                                                                             │
// │  للمورد:                                                                   │
// │    مسحوبات = فواتير توريد (الشركة مدينة للمورد → عليه للشركة)             │
// │    مدفوعات = سداد + مرتجع (يُقلّل ما على الشركة)                          │
// │    رصيد موجب = عليه (الشركة مدينة للمورد ← المورد له المال)               │
// └─────────────────────────────────────────────────────────────────────────────┘
//
// ✅ الرصيد الجاري محسوب في الباك‑إند بدقة — نعرضه مباشرة
// ✅ Intersection Observer للـ Lazy Loading
// ✅ Virtualization-safe: sentinel قبل آخر 20 صف

import { useRef, useEffect, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toNum } from '../../../utils/fmt';

const PREFETCH_BEFORE = 20;

// ── Number Formatter ──────────────────────────────────────────────────────────
/** فورمات رقم بفواصل ألاف + خانتين عشريتين */
const fmtN = (v) =>
  toNum(v).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** فورمات تاريخ */
const fmtD = (d) =>
  d ? new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ── Row Type Config ───────────────────────────────────────────────────────────
const TYPE_CFG = {
  // ── عميل ──
  invoice: {
    label: 'فاتورة بيع',
    bg: '#eff6ff',
    evenBg: '#dbeafe',
    badge: '#1d4ed8',
    text: '#1e40af',
    link: (id) => `/sales/${id}`,
    isDebit: true,   // مسحوبات
  },
  return: {
    label: 'مرتجع بيع',
    bg: '#fff7ed',
    evenBg: '#fed7aa',
    badge: '#ea580c',
    text: '#9a3412',
    link: (id) => `/returns/${id}`,
    isDebit: false,  // مدفوعات
  },
  payment: {
    label: 'سداد',
    bg: '#f0fdf4',
    evenBg: '#bbf7d0',
    badge: '#16a34a',
    text: '#14532d',
    link: null,
    isDebit: false,  // مدفوعات
  },
  opening: {
    label: 'رصيد أول المدة',
    bg: '#fefce8',
    evenBg: '#fef08a',
    badge: '#b45309',
    text: '#78350f',
    link: null,
    isDebit: null,   // يُعامَل بشكل خاص
  },

  // ── مورد ──
  purchase: {
    label: 'فاتورة توريد',
    bg: '#eff6ff',
    evenBg: '#dbeafe',
    badge: '#1d4ed8',
    text: '#1e40af',
    link: (id) => `/purchase/${id}`,
    isDebit: true,   // مسحوبات (الشركة مدينة للمورد)
  },
  supplier_return: {
    label: 'مرتجع توريد',
    bg: '#fff7ed',
    evenBg: '#fed7aa',
    badge: '#ea580c',
    text: '#9a3412',
    link: (id) => `/returns/${id}`,
    isDebit: false,  // مدفوعات
  },
  supplier_payment: {
    label: 'دفع للمورد',
    bg: '#f0fdf4',
    evenBg: '#bbf7d0',
    badge: '#16a34a',
    text: '#14532d',
    link: null,
    isDebit: false,  // مدفوعات
  },
};

// ── StatementRow ──────────────────────────────────────────────────────────────
const StatementRow = memo(function StatementRow({
  row, idx, onEditPayment, backToStatement, sentinelRef,
}) {
  const cfg     = TYPE_CFG[row.rowType] || TYPE_CFG.invoice;
  const amount  = toNum(row.amount);
  const balance = toNum(row.runningBalance);

  const isOpening = row.rowType === 'opening';
  const isDebit   = cfg.isDebit;

  // ── منطق له/عليه حسب نوع الكيان ──────────────────────────────────────────
  // للعميل:  رصيد موجب = عليه (العميل مدين للشركة)  | سالب = له
  // للمورد:  رصيد موجب = له   (المورد دائن = الشركة مدينة له) | سالب = عليه
  // الفرق: isSupplierRow يعكس اتجاه له/عليه
  const isSupplierRow = ['purchase', 'supplier_return', 'supplier_payment'].includes(row.rowType);
  const balancePos = isSupplierRow ? balance > 0 : balance > 0;
  // للمورد: موجب = له | للعميل: موجب = عليه
  const balanceLahu  = isSupplierRow ? balance > 0 : balance < 0;  // له
  const balanceAlayh = isSupplierRow ? balance < 0 : balance > 0;  // عليه
  const balancedZero = balance === 0;

  const docNum = row.docNumber || row.invoiceNumber || row.receiptNumber || '—';
  const link   = cfg.link ? cfg.link(row._id) : null;

  const rowBg = isOpening
    ? (idx % 2 === 0 ? '#fef9c3' : '#fefce8')
    : (idx % 2 === 0 ? cfg.evenBg : cfg.bg);

  return (
    <tr
      ref={sentinelRef || null}
      style={{
        background:   rowBg,
        borderBottom: '1px solid #e2e8f0',
        fontStyle:    isOpening ? 'italic' : 'normal',
      }}
    >
      {/* # */}
      <td style={{ padding: '7px 6px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', whiteSpace: 'nowrap' }}>
        {isOpening ? '—' : idx}
      </td>

      {/* التاريخ */}
      <td style={{ padding: '7px 6px', textAlign: 'right', color: '#475569', fontSize: '11px', whiteSpace: 'nowrap' }}>
        {isOpening ? '—' : fmtD(row.date)}
      </td>

      {/* رقم المستند */}
      <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '11px' }}>
        {link ? (
          <Link
            to={link}
            state={{ backTo: backToStatement, backLabel: 'كشف الحساب' }}
            style={{ color: cfg.text, textDecoration: 'none', fontWeight: 600 }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            {docNum}
          </Link>
        ) : (
          <span style={{ color: isOpening ? '#92400e' : '#374151', fontWeight: isOpening ? 700 : 400 }}>
            {docNum}
          </span>
        )}
      </td>

      {/* نوع الحركة */}
      <td style={{ padding: '7px 6px', textAlign: 'center' }}>
        <span style={{
          background:   cfg.badge,
          color:        'white',
          borderRadius: '5px',
          padding:      '3px 8px',
          fontSize:     '10px',
          fontWeight:   700,
          whiteSpace:   'nowrap',
          display:      'inline-block',
        }}>
          {cfg.label}
        </span>
      </td>

      {/* مسحوبات (مدين) */}
      <td style={{
        padding: '7px 8px', textAlign: 'center',
        color: '#1d4ed8', fontWeight: isDebit ? 700 : 400, fontSize: '11px',
      }}>
        {isOpening
          ? <span style={{ color: '#cbd5e1' }}>—</span>
          : isDebit
            ? <span style={{ letterSpacing: '0.3px' }}>{fmtN(amount)}</span>
            : <span style={{ color: '#cbd5e1' }}>—</span>
        }
      </td>

      {/* مدفوعات (دائن) */}
      <td style={{
        padding: '7px 8px', textAlign: 'center',
        color: '#15803d', fontWeight: !isDebit && !isOpening ? 700 : 400, fontSize: '11px',
      }}>
        {isOpening
          ? <span style={{ color: '#cbd5e1' }}>—</span>
          : !isDebit
            ? <span style={{ letterSpacing: '0.3px' }}>{fmtN(amount)}</span>
            : <span style={{ color: '#cbd5e1' }}>—</span>
        }
      </td>

      {/* رصيد أول المدة — عمود مستقل */}
      <td style={{
        padding: '7px 8px', textAlign: 'center',
        color: '#b45309', fontWeight: isOpening ? 700 : 400, fontSize: '11px',
      }}>
        {isOpening
          ? <span style={{ letterSpacing: '0.3px' }}>{fmtN(amount)}</span>
          : <span style={{ color: '#cbd5e1' }}>—</span>
        }
      </td>

      {/* له */}
      <td style={{
        padding: '7px 8px', textAlign: 'center',
        color: '#15803d', fontWeight: balanceLahu ? 700 : 400, fontSize: '11px',
      }}>
        {balanceLahu
          ? <span style={{ letterSpacing: '0.3px' }}>{fmtN(Math.abs(balance))}</span>
          : <span style={{ color: '#cbd5e1' }}>—</span>
        }
      </td>

      {/* عليه */}
      <td style={{
        padding: '7px 8px', textAlign: 'center',
        color: '#dc2626', fontWeight: balanceAlayh ? 700 : 400, fontSize: '11px',
      }}>
        {balanceAlayh
          ? <span style={{ letterSpacing: '0.3px' }}>{fmtN(Math.abs(balance))}</span>
          : balancedZero && !isOpening
            ? <span style={{ color: '#10b981', fontSize: '10px' }}>متوازن</span>
            : <span style={{ color: '#cbd5e1' }}>—</span>
        }
      </td>

      {/* أكشن — مخفي في الطباعة */}
      <td style={{ padding: '7px 6px', textAlign: 'center' }} className="print:hidden">
        {row.rowType === 'payment' || row.rowType === 'supplier_payment'
          ? onEditPayment
            ? (
              <button
                onClick={() => onEditPayment(row)}
                style={{ color: '#3b82f6', fontSize: '13px', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                title="تعديل الدفعة"
              >
                ✏️
              </button>
            )
            : null
          : link
            ? (
              <Link
                to={link}
                state={{ backTo: backToStatement, backLabel: 'كشف الحساب' }}
                style={{ color: '#64748b', fontSize: '14px' }}
                title="فتح المستند"
              >
                ←
              </Link>
            )
            : null
        }
      </td>
    </tr>
  );
});

// ── PrintSummaryRow — ملخص يظهر في الطباعة فقط ───────────────────────────────
function PrintSummaryRow({ label, value, color = '#1e293b', bg = '#f8fafc', colSpan = 5 }) {
  return (
    <tr style={{ background: bg, borderTop: '1px solid #e2e8f0' }}>
      <td colSpan={colSpan} style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', color: '#1e293b' }}>
        {label}
      </td>
      <td colSpan={4} style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 800, fontSize: '12px', color }}>
        {fmtN(value)} ج.م
      </td>
      <td className="print:hidden" />
    </tr>
  );
}

// ── LazyStatementTable ────────────────────────────────────────────────────────
export default function LazyStatementTable({
  rows        = [],
  totals      = null,
  counts      = null,
  loading     = false,
  loadingMore = false,
  hasMore     = false,
  onLoadMore,
  backToStatement,
  onEditPayment,
  entityType  = 'customer',   // 'customer' | 'supplier'
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

  // ── Loading States ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{
      background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
      textAlign: 'center', padding: '64px 0', color: '#9ca3af',
    }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
      <div style={{ fontSize: '14px', fontWeight: 500 }}>جاري تحميل الكشف...</div>
    </div>
  );

  if (!rows.length) return (
    <div style={{
      background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
      textAlign: 'center', padding: '48px 0', color: '#9ca3af',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
      <div style={{ fontSize: '14px' }}>لا يوجد حركات في هذا الموسم</div>
    </div>
  );

  // ── Totals ──────────────────────────────────────────────────────────────────
  const isSupplier   = entityType === 'supplier';
  const totalDebit   = toNum(totals?.[isSupplier ? 'totalPurchases' : 'totalSales']);
  const totalReturns = toNum(totals?.totalReturns);
  const totalPaid    = toNum(totals?.totalPaid);
  const openingBal   = toNum(totals?.openingBalance);
  const balance      = toNum(totals?.balance);

  // للعميل: balance > 0 = العميل مدين (عليه) | balance < 0 = العميل دائن (له)
  // للمورد: balance > 0 = الشركة مدينة للمورد (له للمورد) | balance < 0 = المورد دائن للشركة (عليه)
  // نعكس اتجاه له/عليه للمورد في التوتال
  const balanceIsDebit  = isSupplier ? balance < 0 : balance > 0;  // عليه
  const balanceIsCredit = isSupplier ? balance > 0 : balance < 0;  // له
  const balanceIsZero   = balance === 0;

  const displayedRows = rows.filter((r) => r.rowType !== 'opening').length;

  // ── Column Definitions ──────────────────────────────────────────────────────
  const COLS = [
    { label: '#',              w: '3%',  align: 'center'  },
    { label: 'التاريخ',        w: '9%',  align: 'right'   },
    { label: 'رقم المستند',    w: '12%', align: 'right'   },
    { label: 'نوع الحركة',    w: '11%', align: 'center'  },
    { label: 'مسحوبات',        w: '11%', align: 'center'  },
    { label: 'مدفوعات',        w: '11%', align: 'center'  },
    { label: 'رصيد أول المدة', w: '11%', align: 'center'  },
    { label: 'له',              w: '11%', align: 'center'  },
    { label: 'عليه',            w: '11%', align: 'center'  },
    { label: '',                w: '5%',  align: 'center', printHide: true },
  ];

  return (
    <div style={{
      background: 'white', borderRadius: '12px',
      border: '1px solid #e2e8f0', marginBottom: '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}
      className="print:shadow-none print:border"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px', flexWrap: 'wrap', gap: '8px',
        borderBottom: '1px solid #f1f5f9',
      }}
        className="print:hidden"
      >
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
          📋 حركات الحساب
        </h3>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#64748b', flexWrap: 'wrap' }}>
          {counts && (
            <>
              <span>🧾 {counts.invoices} {isSupplier ? 'فاتورة توريد' : 'فاتورة بيع'}</span>
              <span>↩️ {counts.returns} مرتجع</span>
              <span>💰 {counts.payments} دفعة</span>
            </>
          )}
          <span style={{ color: '#94a3b8' }}>
            {displayedRows}{hasMore ? ` من ${counts?.total ?? '...'}` : ''} معروض
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }} className="overflow-x-auto">
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', minWidth: '760px' }}>

          {/* ── thead ── */}
          <thead>
            <tr style={{
              background:    '#1e293b',
              borderTop:    '2px solid #0f172a',
              borderBottom: '2px solid #0f172a',
            }}>
              {COLS.map((col, i) => (
                <th
                  key={i}
                  style={{
                    width:      col.w,
                    padding:    '10px 8px',
                    textAlign:  col.align,
                    fontSize:   '10.5px',
                    fontWeight: 700,
                    color:      'white',
                    letterSpacing: '0.3px',
                  }}
                  className={col.printHide ? 'print:hidden' : ''}
                >
                  {col.label}
                </th>
              ))}
            </tr>

            {/* ── صف رصيد أول المدة في thead (يظهر فوق الحركات) ── */}
            {openingBal !== 0 && !rows.some((r) => r.rowType === 'opening') && (
              <tr style={{ background: '#fefce8', borderBottom: '1px solid #fde68a' }}>
                <td style={{ padding: '6px 6px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>—</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', color: '#92400e', fontSize: '11px' }}>—</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontStyle: 'italic', color: '#92400e', fontSize: '11px', fontWeight: 700 }}>
                  رصيد ابتدائي
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                  <span style={{ background: '#b45309', color: 'white', borderRadius: '5px', padding: '2px 7px', fontSize: '10px', fontWeight: 700 }}>
                    رصيد أول المدة
                  </span>
                </td>
                <td colSpan={2} style={{ padding: '6px 6px', textAlign: 'center', color: '#92400e', fontSize: '11px' }}>—</td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: '#b45309', fontWeight: 700, fontSize: '11px' }}>
                  {fmtN(openingBal)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: openingBal < 0 ? '#15803d' : '#cbd5e1', fontSize: '11px' }}>
                  {openingBal < 0 ? fmtN(Math.abs(openingBal)) : '—'}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: openingBal > 0 ? '#dc2626' : '#cbd5e1', fontSize: '11px' }}>
                  {openingBal > 0 ? fmtN(openingBal) : '—'}
                </td>
                <td className="print:hidden" />
              </tr>
            )}
          </thead>

          {/* ── tbody ── */}
          <tbody>
            {rows.map((row, idx) => {
              // نتجاهل opening هنا — اتعرض في thead
              if (row.rowType === 'opening') {
                return (
                  <StatementRow
                    key={row._id}
                    row={row}
                    idx={0}
                    onEditPayment={onEditPayment}
                    backToStatement={backToStatement}
                    sentinelRef={idx === sentinelIdx ? sentinelRef : null}
                  />
                );
              }
              const displayIdx = rows
                .filter((r) => r.rowType !== 'opening')
                .findIndex((r) => r._id === row._id) + 1;
              return (
                <StatementRow
                  key={row._id}
                  row={row}
                  idx={displayIdx}
                  onEditPayment={onEditPayment}
                  backToStatement={backToStatement}
                  sentinelRef={idx === sentinelIdx ? sentinelRef : null}
                />
              );
            })}
          </tbody>

          {/* ── tfoot ── */}
          {totals && (
            <tfoot>
              {/* إجمالي الأعمدة */}
              <tr style={{ borderTop: '2px solid #1e293b', background: '#1e293b', fontWeight: 700 }}>
                <td colSpan={4} style={{ padding: '10px 8px', textAlign: 'right', fontSize: '11px', color: 'white', fontWeight: 700 }}>
                  الإجمالي الكلي
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: '#93c5fd', fontSize: '11px', fontWeight: 700 }}>
                  {fmtN(totalDebit)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: '#86efac', fontSize: '11px', fontWeight: 700 }}>
                  {fmtN(totalPaid + totalReturns)}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: '#fde68a', fontSize: '11px', fontWeight: 700 }}>
                  {openingBal !== 0 ? fmtN(openingBal) : '—'}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: balanceIsCredit ? '#86efac' : '#6b7280', fontSize: '11px' }}>
                  {balanceIsCredit ? fmtN(Math.abs(balance)) : '—'}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: balanceIsDebit ? '#fca5a5' : '#6b7280', fontSize: '11px' }}>
                  {balanceIsDebit ? fmtN(Math.abs(balance)) : '—'}
                </td>
                <td className="print:hidden" />
              </tr>

              {/* صف الرصيد النهائي */}
              <tr style={{
                borderTop: '1px solid #e2e8f0',
                background: balanceIsDebit ? '#fef2f2' : balanceIsCredit ? '#f0fdf4' : '#f8fafc',
              }}>
                <td colSpan={6} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontSize: '12px', color: '#1e293b' }}>
                  {balanceIsDebit
                    ? (isSupplier ? '⚠️ مستحق للمورد — الشركة مدينة' : '⚠️ مستحق على العميل')
                    : balanceIsCredit
                      ? (isSupplier ? '✅ رصيد للشركة (دائن)' : '✅ رصيد لصالح العميل (دائن)')
                      : '✅ الحساب متوازن'
                  }
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#b45309' }}>
                  {openingBal !== 0 ? fmtN(openingBal) : '—'}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, fontSize: '14px', color: balanceIsCredit ? '#15803d' : '#9ca3af' }}>
                  {balanceIsCredit ? fmtN(Math.abs(balance)) : '—'}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800, fontSize: '14px', color: balanceIsDebit ? '#dc2626' : '#9ca3af' }}>
                  {balanceIsDebit ? fmtN(Math.abs(balance)) : balanceIsZero ? '—' : '—'}
                </td>
                <td className="print:hidden" />
              </tr>

              {/* ── ملخص الطباعة (يظهر في الطباعة فقط) ── */}
              <tr className="hidden print:table-row" style={{ borderTop: '2px solid #1e293b' }}>
                <td colSpan={10} style={{ padding: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f8fafc' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: '11px', color: '#1e293b', width: '50%', borderRight: '1px solid #e2e8f0' }}>
                          رصيد أول المدة: <span style={{ color: '#b45309' }}>{fmtN(openingBal)} ج.م</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: '11px', color: '#1e293b', width: '50%' }}>
                          إجمالي {isSupplier ? 'التوريد' : 'المبيعات'}: <span style={{ color: '#1d4ed8' }}>{fmtN(totalDebit)} ج.م</span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: '11px', color: '#1e293b', borderRight: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}>
                          إجمالي المرتجعات: <span style={{ color: '#ea580c' }}>{fmtN(totalReturns)} ج.م</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: '11px', color: '#1e293b', borderTop: '1px solid #e2e8f0' }}>
                          إجمالي المدفوع: <span style={{ color: '#15803d' }}>{fmtN(totalPaid)} ج.م</span>
                        </td>
                      </tr>
                      <tr style={{ background: balanceIsDebit ? '#fef2f2' : '#f0fdf4', borderTop: '2px solid #1e293b' }}>
                        <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 800, fontSize: '13px', textAlign: 'center', color: balanceIsDebit ? '#dc2626' : '#15803d' }}>
                          {balanceIsDebit
                            ? `الرصيد المستحق ${isSupplier ? 'للمورد' : 'على العميل'} (عليه): ${fmtN(balance)} ج.م`
                            : balanceIsCredit
                              ? `رصيد ${isSupplier ? 'الشركة' : 'العميل'} (له): ${fmtN(Math.abs(balance))} ج.م`
                              : '✅ الحساب متوازن — لا يوجد رصيد'
                          }
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Load More State ─────────────────────────────────────────────────── */}
      {loadingMore && (
        <div style={{ textAlign: 'center', padding: '14px', color: '#6b7280', fontSize: '12px', borderTop: '1px solid #f1f5f9' }}>
          ⏳ جاري تحميل المزيد...
        </div>
      )}
      {!hasMore && displayedRows > 0 && (
        <div style={{ textAlign: 'center', padding: '10px', color: '#9ca3af', fontSize: '11px', borderTop: '1px solid #f1f5f9' }}>
          ✅ تم عرض كل الحركات ({displayedRows} حركة)
        </div>
      )}
    </div>
  );
}
