// ─── SupplierPrintHeader.jsx ─────────────────────────────────────────────────
// هيدر كشف حساب المورد — يظهر في الطباعة فقط
// ─────────────────────────────────────────────────────────────────────────────
import { COMPANY_NAME } from '../../../components/constants/printStyles';

export default function SupplierPrintHeader({ supplier, seasonName, totals }) {
  const balance = totals?.balance ?? 0;
  const isDebt  = balance > 0; // مستحق للمورد

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
            كشف حساب مورد
          </div>
        </div>
        <div style={{ textAlign: 'left', fontSize: '10px', color: '#94a3b8' }}>
          <div>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
          <div>الوقت: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* ── بيانات المورد + الرصيد ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '12px',
        padding: '6px 4px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '8px',
        marginBottom: '6px',
      }}>
        {/* بيانات المورد */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          <InfoCell label="المورد" value={supplier?.name} bold />
          <InfoCell label="الكود" value={supplier?.code} />
          {supplier?.phone && <InfoCell label="التليفون" value={supplier.phone} />}
          <InfoCell label="الموسم" value={seasonName || 'الموسم النشط'} />
          {supplier?.taxNumber && <InfoCell label="الرقم الضريبي" value={supplier.taxNumber} />}
          {supplier?.address && <InfoCell label="العنوان" value={supplier.address} />}
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
              {isDebt ? '⚠️ مستحق للمورد' : '✅ لا يوجد رصيد'}
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
          <SummaryMini label="إجمالي التوريد"  value={totals.totalPurchases} color="#1d4ed8" />
          <SummaryMini label="المرتجعات"        value={totals.totalReturns}   color="#ea580c" />
          <SummaryMini label="إجمالي المدفوع"   value={totals.totalPaid}      color="#15803d" />
          <SummaryMini
            label={isDebt ? 'مستحق للمورد (عليه)' : 'رصيد الشركة (له)'}
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
