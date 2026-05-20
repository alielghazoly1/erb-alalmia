// ─── PrintHeader.jsx ─────────────────────────────────────────────────────────
// هيدر كشف حساب العميل — يظهر في الطباعة فقط
// ─────────────────────────────────────────────────────────────────────────────
import { COMPANY_NAME } from '../../../components/constants/printStyles';

export default function PrintHeader({ customer, seasonName, totals }) {
  const balance = totals?.balance ?? 0;
  const isDebt  = balance > 0; // مستحق على العميل

  return (
    <div className="hidden print:block print-header-block" style={{ marginBottom: '10px' }}>

      {/* ── شريط العنوان ── */}
      <div style={{
        background: '#1e293b',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px 4px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.5px' }}>
            {COMPANY_NAME}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            كشف حساب عميل
          </div>
        </div>
        <div style={{ textAlign: 'left', fontSize: '10px', color: '#94a3b8' }}>
          <div>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
          <div>الوقت: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* ── بيانات العميل + الرصيد ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '12px',
        padding: '6px 4px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '8px',
        marginBottom: '6px',
      }}>
        {/* بيانات العميل */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          <InfoCell label="العميل"  value={customer?.name} bold />
          <InfoCell label="الكود"   value={customer?.code} />
          {customer?.phone && <InfoCell label="التليفون" value={customer.phone} />}
          <InfoCell label="الموسم" value={seasonName || 'الموسم النشط'} />
          {customer?.type && <InfoCell label="النوع" value={customer.type} />}
          {customer?.address && <InfoCell label="العنوان" value={customer.address} />}
        </div>

        {/* بطاقة الرصيد */}
        {totals && (
          <div style={{
            border: `2px solid ${isDebt ? '#fca5a5' : '#86efac'}`,
            borderRadius: '6px',
            padding: '8px 14px',
            textAlign: 'center',
            background: isDebt ? '#fef2f2' : '#f0fdf4',
            minWidth: '130px',
          }}>
            <div style={{ fontSize: '9px', color: isDebt ? '#dc2626' : '#15803d', fontWeight: 700, marginBottom: '4px' }}>
              {isDebt ? '⚠️ مستحق على العميل' : '✅ لا يوجد رصيد'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: isDebt ? '#dc2626' : '#15803d' }}>
              {Math.abs(balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>جنيه مصري</div>
          </div>
        )}
      </div>

      {/* ── ملخص الأرقام ── */}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
          <SummaryMini label="إجمالي المبيعات"   value={totals.totalSales}   color="#1d4ed8" />
          <SummaryMini label="المرتجعات"          value={totals.totalReturns} color="#ea580c" />
          <SummaryMini label="إجمالي المدفوع"     value={totals.totalPaid}    color="#15803d" />
          <SummaryMini
            label={isDebt ? 'مستحق على العميل (عليه)' : 'رصيد لصالح العميل (له)'}
            value={Math.abs(balance)}
            color={isDebt ? '#dc2626' : '#15803d'}
            bold
          />
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value, bold = false }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: '9.5px', color: '#374151' }}>
      <span style={{ color: '#6b7280', fontWeight: 600 }}>{label}: </span>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

function SummaryMini({ label, value, color, bold = false }) {
  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: '4px',
      padding: '4px 6px', textAlign: 'center', background: '#f8fafc',
    }}>
      <div style={{ fontSize: '8.5px', color: '#6b7280', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: bold ? '11px' : '10px', fontWeight: 700, color }}>
        {Number(value || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
      </div>
    </div>
  );
}
