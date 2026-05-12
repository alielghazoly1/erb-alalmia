// ─── components/PrintDocuments.jsx ───────────────────────────────────────────
//  وثيقتان للطباعة (مخفيتان في الشاشة):
//  1. PrintSummaryDoc — منتجات + خامات فقط
//  2. PrintFullDoc    — + جدول الأوامر
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

const fmt     = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtDate = (d)         => d ? new Date(d).toLocaleDateString('ar-EG') : '—';
const WH_LABEL = { ramses: 'رمسيس', october: 'أكتوبر', both: 'الاثنين' };

// ─── Shared pieces ────────────────────────────────────────────────────────────
function PrintHeader({ worker, title, seasonLabel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '10px', borderBottom: '2px solid #1f2937', marginBottom: '14px' }}>
      <div>
        <h1 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>
          الشركة العالمية للاستيراد والتصدير
        </h1>
        <p style={{ fontSize: '10px', color: '#666', margin: '3px 0 0' }}>
          {title} — {seasonLabel}
        </p>
      </div>
      <div style={{ textAlign: 'left', fontSize: '9px', color: '#555' }}>
        <p style={{ margin: 0 }}>طُبع في: {new Date().toLocaleString('ar-EG')}</p>
        {worker?.name && <p style={{ margin: '2px 0 0' }}>المعلم: {worker.name}</p>}
      </div>
    </div>
  );
}

function WorkerBlock({ worker }) {
  return (
    <div style={{ display: 'flex', gap: '14px', marginBottom: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '9px 13px' }}>
      {[
        { label: 'اسم المعلم', value: worker?.name,                        bold: true, size: '13px' },
        { label: 'الكود',      value: worker?.code },
        { label: 'العنبر',     value: WH_LABEL[worker?.warehouse] || worker?.warehouse },
      ].filter(f => f.value).map((f, i) => (
        <div key={i} style={i > 0 ? { borderRight: '1px solid #ddd', paddingRight: '13px' } : {}}>
          <p style={{ color: '#888', margin: '0 0 2px', fontSize: '9px' }}>{f.label}</p>
          <p style={{ fontWeight: f.bold ? 'bold' : '600', fontSize: f.size || '11px', margin: 0 }}>{f.value}</p>
        </div>
      ))}
    </div>
  );
}

function StatsRow({ summary }) {
  const items = [
    { label: 'أوامر معتمدة',   value: summary.totalOrders,                       color: '#1d4ed8' },
    { label: 'خامات مستهلكة',  value: `${fmt(summary.totalRawWeight, 2)} ك`,      color: '#c2410c' },
    { label: 'منتجات تمت',     value: `${fmt(summary.totalOutputWeight, 2)} ك`,   color: '#15803d' },
    { label: 'هالك',           value: `${fmt(summary.wasteWeight, 2)} ك`,          color: summary.wasteWeight > 0 ? '#dc2626' : '#64748b' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '7px', marginBottom: '12px' }}>
      {items.map((s, i) => (
        <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '7px', textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '8px', margin: '0 0 3px' }}>{s.label}</p>
          <p style={{ fontWeight: 'bold', fontSize: '12px', color: s.color, margin: 0 }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function ItemsTable({ title, rows, headerColor, rowBg, totalWeight, textColor }) {
  if (!rows?.length) return null;
  return (
    <div style={{ marginBottom: '11px' }}>
      <p style={{ fontWeight: 'bold', fontSize: '10px', color: textColor, borderBottom: `1px solid ${rowBg}`, paddingBottom: '3px', marginBottom: '5px' }}>{title}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
        <thead>
          <tr style={{ background: headerColor, color: 'white' }}>
            {['#', 'الصنف', 'الكراتين', 'الوزن الكلي'].map((h, i) => (
              <th key={i} style={{ padding: '4px 6px', textAlign: i > 0 ? 'center' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? rowBg : 'white', borderBottom: `1px solid ${rowBg}` }}>
              <td style={{ padding: '3px 6px', textAlign: 'center', color: '#888' }}>{i + 1}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>{r.itemName}</td>
              <td style={{ padding: '3px 6px', textAlign: 'center' }}>{r.totalQty}</td>
              <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 'bold', color: textColor }}>{fmt(r.totalWeight, 3)} ك</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: headerColor, color: 'white', fontWeight: 'bold' }}>
            <td colSpan={3} style={{ padding: '4px 6px', textAlign: 'right' }}>الإجمالي</td>
            <td style={{ padding: '4px 6px', textAlign: 'center' }}>{fmt(totalWeight, 3)} ك</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OrdersTable({ orders, summary }) {
  if (!orders?.length) return null;
  const approved = orders.filter(o => o.status === 'approved');
  return (
    <div style={{ marginTop: '12px' }}>
      <p style={{ fontWeight: 'bold', fontSize: '10px', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '3px', marginBottom: '6px' }}>
        📋 أوامر التصنيع المعتمدة ({approved.length})
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
        <thead>
          <tr style={{ background: '#374151', color: 'white' }}>
            {['#', 'رقم المستند', 'التاريخ', 'العنبر', 'الموسم', 'خامات (ك)', 'منتجات (ك)'].map((h, i) => (
              <th key={i} style={{ padding: '4px 5px', textAlign: 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {approved.map((o, i) => {
            const rawWt = o.rawMaterials?.reduce((s, r) => s + (r.totalWeight || 0), 0) || 0;
            const outWt = o.outputProducts?.reduce((s, p) => s + (p.totalWeight || 0), 0) || 0;
            return (
              <tr key={o._id} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white', borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '2px 5px', color: '#888' }}>{i + 1}</td>
                <td style={{ padding: '2px 5px', fontFamily: 'monospace', fontWeight: 'bold', color: '#b45309' }}>
                  {o.docNumber ? `#${o.docNumber}` : '—'}
                </td>
                <td style={{ padding: '2px 5px' }}>{fmtDate(o.date)}</td>
                <td style={{ padding: '2px 5px' }}>{WH_LABEL[o.warehouse] || o.warehouse}</td>
                <td style={{ padding: '2px 5px', color: '#7c3aed' }}>{o.season?.name || '—'}</td>
                <td style={{ padding: '2px 5px', color: '#c2410c', fontWeight: 'bold' }}>{fmt(rawWt, 2)}</td>
                <td style={{ padding: '2px 5px', color: '#15803d', fontWeight: 'bold' }}>{fmt(outWt, 2)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#374151', color: 'white', fontWeight: 'bold' }}>
            <td colSpan={5} style={{ padding: '4px 5px', textAlign: 'right' }}>الإجمالي</td>
            <td style={{ padding: '4px 5px', color: '#fca5a5' }}>{fmt(summary?.totalRawWeight, 2)}</td>
            <td style={{ padding: '4px 5px', color: '#86efac' }}>{fmt(summary?.totalOutputWeight, 2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PrintFooter() {
  return (
    <div style={{ textAlign: 'center', marginTop: '18px', paddingTop: '7px', borderTop: '1px solid #e5e7eb', fontSize: '8px', color: '#9ca3af' }}>
      الشركة العالمية للاستيراد والتصدير — طُبع في {new Date().toLocaleString('ar-EG')}
    </div>
  );
}

const PRINT_BASE = { padding: '16px', fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '10px', color: '#111', background: 'white', direction: 'rtl' };

// ─── 1. ملخص فقط ─────────────────────────────────────────────────────────────
export const PrintSummaryDoc = React.forwardRef(({ worker, summary, seasonLabel }, ref) => {
  if (!summary) return null;
  return (
    <div ref={ref} style={PRINT_BASE}>
      <PrintHeader worker={worker} title="كشف ملخص معلم" seasonLabel={seasonLabel} />
      <WorkerBlock worker={worker} />
      <StatsRow summary={summary} />
      <ItemsTable title="📦 المنتجات الناتجة"   rows={summary.products}     headerColor="#14532d" rowBg="#f0fdf4" totalWeight={summary.totalOutputWeight} textColor="#15803d" />
      <ItemsTable title="📤 الخامات المستهلكة" rows={summary.rawMaterials} headerColor="#7c2d12" rowBg="#fff7ed" totalWeight={summary.totalRawWeight}    textColor="#c2410c" />
      <PrintFooter />
    </div>
  );
});
PrintSummaryDoc.displayName = 'PrintSummaryDoc';

// ─── 2. كامل مع الأوامر ──────────────────────────────────────────────────────
export const PrintFullDoc = React.forwardRef(({ worker, summary, orders, seasonLabel }, ref) => {
  if (!summary) return null;
  return (
    <div ref={ref} style={PRINT_BASE}>
      <PrintHeader worker={worker} title="كشف حساب معلم تفصيلي" seasonLabel={seasonLabel} />
      <WorkerBlock worker={worker} />
      <StatsRow summary={summary} />
      <ItemsTable title="📦 المنتجات الناتجة"   rows={summary.products}     headerColor="#14532d" rowBg="#f0fdf4" totalWeight={summary.totalOutputWeight} textColor="#15803d" />
      <ItemsTable title="📤 الخامات المستهلكة" rows={summary.rawMaterials} headerColor="#7c2d12" rowBg="#fff7ed" totalWeight={summary.totalRawWeight}    textColor="#c2410c" />
      <OrdersTable orders={orders} summary={summary} />
      <PrintFooter />
    </div>
  );
});
PrintFullDoc.displayName = 'PrintFullDoc';
