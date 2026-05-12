import React from 'react';
import { STATUS } from '../manufacturingConfig';

function PrintTable({ title, headerColor, rows, rowBg }) {
  const total = rows.reduce((s, r) => s + (r.totalWeight || 0), 0);
  return (
    <>
      <p style={{ fontWeight: 'bold', fontSize: '12px', borderBottom: `1px solid ${headerColor}`, paddingBottom: '4px', marginBottom: '6px', color: headerColor }}>
        {title}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '12px' }}>
        <thead>
          <tr style={{ background: headerColor, color: 'white' }}>
            {['#', 'الكود', 'الصنف', 'الكراتين', 'وزن/كرتون', 'الوزن الكلي'].map((h, i) => (
              <th key={i} style={{ padding: '4px 6px', textAlign: i > 2 ? 'center' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? rowBg : 'white', borderBottom: `1px solid ${rowBg}` }}>
              <td style={{ padding: '3px 6px', textAlign: 'center' }}>{i + 1}</td>
              <td style={{ padding: '3px 6px', fontFamily: 'monospace', color: '#2563eb' }}>{r.itemCode}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>{r.itemName}</td>
              <td style={{ padding: '3px 6px', textAlign: 'center' }}>{r.quantity}</td>
              <td style={{ padding: '3px 6px', textAlign: 'center' }}>{Number(r.weight).toFixed(3)}</td>
              <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 'bold', color: headerColor }}>
                {Number(r.totalWeight).toFixed(3)} ك
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: headerColor, color: 'white', fontWeight: 'bold' }}>
            <td colSpan={5} style={{ padding: '4px 6px', textAlign: 'right' }}>الإجمالي</td>
            <td style={{ padding: '4px 6px', textAlign: 'center' }}>{total.toFixed(3)} ك</td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

const PrintView = React.forwardRef(({ order }, ref) => {
  if (!order) return null;
  const st = STATUS[order.status];
  return (
    <div ref={ref} dir="rtl" style={{ padding: '16px', background: 'white', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #333' }}>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>الشركة العالمية للاستيراد والتصدير</h1>
          <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0' }}>أمر تصنيع</p>
        </div>
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>رقم الأمر</p>
          <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#b45309', margin: '2px 0 0' }}>{order.orderNumber}</p>
          {order.docNumber && <p style={{ fontSize: '11px', color: '#666' }}>مستند: {order.docNumber}</p>}
          {order.season?.name && <p style={{ fontSize: '10px', color: '#888' }}>الموسم: {order.season.name}</p>}
        </div>
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px', fontSize: '11px' }}>
        {[
          { label: 'التاريخ', value: new Date(order.date).toLocaleDateString('ar-EG') },
          { label: 'العنبر',  value: order.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر' },
          { label: 'المعلم',  value: order.workerName || '—' },
          { label: 'الحالة',  value: st?.text },
        ].map((x, i) => (
          <div key={i} style={{ background: '#f8f9fa', padding: '6px 8px', borderRadius: '4px' }}>
            <p style={{ color: '#888', margin: '0 0 2px' }}>{x.label}</p>
            <p style={{ fontWeight: 'bold', margin: 0 }}>{x.value}</p>
          </div>
        ))}
      </div>

      <PrintTable title="📤 الخامات المصروفة"  headerColor="#7c2d12" rowBg="#fff7ed" rows={order.rawMaterials   || []} />
      <PrintTable title="📦 المنتجات الناتجة"  headerColor="#14532d" rowBg="#f0fdf4" rows={order.outputProducts || []} />

      {order.notes && <p style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>ملاحظات: {order.notes}</p>}
      <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #ddd', fontSize: '9px', color: '#999' }}>
        الشركة العالمية للاستيراد والتصدير — {new Date().toLocaleDateString('ar-EG')}
      </div>
    </div>
  );
});
PrintView.displayName = 'PrintView';
export default PrintView;
