// ─── pages/customers/components/CustomerStatementModal.jsx ───────────────────
// كشف الحساب السريع — totals كل موسم (مبيعات / مدفوع / رصيد)
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo }      from 'react';
import { Link }         from 'react-router-dom';
import { useSelector }  from 'react-redux';
import Modal            from '../../../components/common/Modal';

// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n != null
    ? Number(n).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

// ─────────────────────────────────────────────────────────────────────────────

export default function CustomerStatementModal({ isOpen, onClose, customer }) {
  const { allSeasons, statementLoading } = useSelector((s) => s.customers);

  // ── إجمالي كل المواسم ────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    sales:   (allSeasons || []).reduce((acc, r) => acc + (r.totalSales   || 0), 0),
    paid:    (allSeasons || []).reduce((acc, r) => acc + (r.totalPaid    || 0), 0),
    returns: (allSeasons || []).reduce((acc, r) => acc + (r.totalReturns || 0), 0),
    balance: (allSeasons || []).reduce((acc, r) => acc + (r.balance      || 0), 0),
  }), [allSeasons]);

  // ── المواسم اللي عندها أي نشاط أو رصيد ابتدائي ───────────────────────────
  const activeSeasons = (allSeasons || []).filter(
    (s) => s.totalSales || s.totalPaid || s.totalReturns || s.openingBalance,
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`كشف حساب — ${customer?.name || ''}`}>
      {statementLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          ⏳ جاري التحميل...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── إجمالي كل المواسم ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <TotalCard label="إجمالي المبيعات" value={totals.sales}                  color="blue"  />
            <TotalCard label="إجمالي المدفوع"  value={totals.paid + totals.returns}  color="green" />
            <TotalCard
              label={totals.balance > 0 ? '⚠️ عليه' : '✅ له'}
              value={Math.abs(totals.balance)}
              color={totals.balance > 0 ? 'red' : 'teal'}
            />
          </div>

          {/* ── تفاصيل كل موسم ── */}
          {activeSeasons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📭</div>
              <div>مفيش حركات مسجلة</div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                تفاصيل كل موسم
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {activeSeasons.map((s) => (
                  <SeasonRow key={s.season._id} data={s} />
                ))}
              </div>
            </div>
          )}

          {/* ── زر الكشف الكامل ── */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', textAlign: 'center' }}>
            <Link
              to="/customers/statement"
              onClick={onClose}
              style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
            >
              عرض الكشف الكامل مع كل الحركات ←
            </Link>
          </div>

        </div>
      )}
    </Modal>
  );
}

// ── كارت الإجمالي ─────────────────────────────────────────────────────────────
function TotalCard({ label, value, color }) {
  const palette = {
    blue:  { bg: '#eff6ff', text: '#1d4ed8', label: '#3b82f6' },
    green: { bg: '#f0fdf4', text: '#15803d', label: '#16a34a' },
    red:   { bg: '#fef2f2', text: '#dc2626', label: '#ef4444' },
    teal:  { bg: '#f0fdfa', text: '#0f766e', label: '#14b8a6' },
  };
  const c = palette[color] || palette.blue;

  return (
    <div style={{ background: c.bg, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
      <p style={{ fontSize: '11px', color: c.label, marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '17px', fontWeight: 700, color: c.text }}>{fmt(value)}</p>
      <p style={{ fontSize: '10px', color: '#9ca3af' }}>ج.م</p>
    </div>
  );
}

// ── صف موسم واحد ──────────────────────────────────────────────────────────────
function SeasonRow({ data: s }) {
  const isActive  = s.season.isActive;
  const hasDebt   = s.balance > 0;
  const hasCredit = s.balance < 0;

  return (
    <div style={{
      border:       `1px solid ${isActive ? '#93c5fd' : '#e2e8f0'}`,
      borderRadius: '8px',
      padding:      '10px 12px',
      background:   isActive ? '#eff6ff' : '#f8fafc',
    }}>

      {/* اسم الموسم + الرصيد */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#1d4ed8' : '#374151' }}>
            {s.season.name}
          </span>
          {isActive && (
            <span style={{ fontSize: '10px', background: '#2563eb', color: 'white', borderRadius: '999px', padding: '1px 7px' }}>
              نشط
            </span>
          )}
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: hasDebt ? '#dc2626' : hasCredit ? '#0f766e' : '#6b7280' }}>
          {hasDebt   && `عليه ${fmt(s.balance)}`}
          {hasCredit && `له ${fmt(Math.abs(s.balance))}`}
          {!hasDebt && !hasCredit && '—'}
          {(hasDebt || hasCredit) && ' ج.م'}
        </span>
      </div>

      {/* مبيعات / رصيد ابتدائي / مرتجعات / مدفوع */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#64748b', flexWrap: 'wrap' }}>
        {s.openingBalance !== 0 && (
          <span>رصيد أولي: <b style={{ color: '#7c3aed' }}>{fmt(s.openingBalance)}</b></span>
        )}
        <span>مبيعات: <b style={{ color: '#1d4ed8' }}>{fmt(s.totalSales)}</b></span>
        {s.totalReturns > 0 && (
          <span>مرتجع: <b style={{ color: '#ea580c' }}>{fmt(s.totalReturns)}</b></span>
        )}
        <span>مدفوع: <b style={{ color: '#15803d' }}>{fmt(s.totalPaid)}</b></span>
      </div>

    </div>
  );
}
