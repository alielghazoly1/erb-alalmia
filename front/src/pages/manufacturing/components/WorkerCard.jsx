// ─── components/WorkerCard.jsx ────────────────────────────────────────────────
//  ✅ زرارين طباعة: ملخص فقط / كامل مع الأوامر
//  ✅ فلتر الموسم — كل موسم كشف مختلف ومصفّر
//  ✅ initialSeasonId — بيفتح على نفس الموسم اللي في القائمة
//  ✅ docNumber بدل orderNumber في الكشف
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useReactToPrint }  from 'react-to-print';
import api                  from '../../../services/api';
import toast                from 'react-hot-toast';
import { fmt, STATUS, PRINT_STYLE } from '../manufacturingConfig';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const WH_LABEL = { ramses: 'رمسيس', october: 'أكتوبر' };

// ─────────────────────────────────────────────────────────────────────────────
// Print Doc — ملخص فقط (منتجات + خامات)
// ─────────────────────────────────────────────────────────────────────────────
const PrintSummaryDoc = React.forwardRef(({ worker, data, seasonLabel }, ref) => {
  if (!data) return null;
  const { summary } = data;

  return (
    <div ref={ref} dir="rtl" style={{ padding: '16px', fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '11px', color: '#111', background: 'white' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '10px', borderBottom: '2px solid #1f2937', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>الشركة العالمية للاستيراد والتصدير</h1>
          <p style={{ fontSize: '10px', color: '#666', margin: '3px 0 0' }}>كشف ملخص معلم — {seasonLabel}</p>
        </div>
        <div style={{ textAlign: 'left', fontSize: '10px', color: '#555' }}>
          <p style={{ margin: 0 }}>طُبع في: {new Date().toLocaleString('ar-EG')}</p>
        </div>
      </div>

      {/* Worker */}
      <WorkerInfoBlock worker={worker} />

      {/* Summary numbers */}
      <SummaryNumbers summary={summary} />

      {/* Products table */}
      <ItemsTable
        title="📦 المنتجات الناتجة"
        rows={summary.products}
        headerColor="#14532d"
        rowBg="#f0fdf4"
        totalWeight={summary.totalOutputWeight}
        textColor="#15803d"
      />

      {/* Raw materials table */}
      <ItemsTable
        title="📤 الخامات المستهلكة"
        rows={summary.rawMaterials}
        headerColor="#7c2d12"
        rowBg="#fff7ed"
        totalWeight={summary.totalRawWeight}
        textColor="#c2410c"
      />

      <PrintFooter />
    </div>
  );
});
PrintSummaryDoc.displayName = 'PrintSummaryDoc';

// ─────────────────────────────────────────────────────────────────────────────
// Print Doc — كامل مع الأوامر
// ─────────────────────────────────────────────────────────────────────────────
const PrintFullDoc = React.forwardRef(({ worker, data, seasonLabel }, ref) => {
  if (!data) return null;
  const { summary, orders } = data;
  const approved = orders.filter(o => o.status === 'approved');

  return (
    <div ref={ref} dir="rtl" style={{ padding: '16px', fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '11px', color: '#111', background: 'white' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '10px', borderBottom: '2px solid #1f2937', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>الشركة العالمية للاستيراد والتصدير</h1>
          <p style={{ fontSize: '10px', color: '#666', margin: '3px 0 0' }}>كشف حساب معلم تفصيلي — {seasonLabel}</p>
        </div>
        <div style={{ textAlign: 'left', fontSize: '10px', color: '#555' }}>
          <p style={{ margin: 0 }}>طُبع في: {new Date().toLocaleString('ar-EG')}</p>
        </div>
      </div>

      <WorkerInfoBlock worker={worker} />
      <SummaryNumbers summary={summary} />

      <ItemsTable
        title="📦 المنتجات الناتجة"
        rows={summary.products}
        headerColor="#14532d"
        rowBg="#f0fdf4"
        totalWeight={summary.totalOutputWeight}
        textColor="#15803d"
      />

      <ItemsTable
        title="📤 الخامات المستهلكة"
        rows={summary.rawMaterials}
        headerColor="#7c2d12"
        rowBg="#fff7ed"
        totalWeight={summary.totalRawWeight}
        textColor="#c2410c"
      />

      {/* Orders list */}
      {approved.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <p style={{ fontWeight: 'bold', fontSize: '11px', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '6px' }}>
            📋 أوامر التصنيع المعتمدة ({approved.length})
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead>
              <tr style={{ background: '#374151', color: 'white' }}>
                {['رقم المستند', 'التاريخ', 'العنبر', 'خامات (ك)', 'منتجات (ك)'].map((h, i) => (
                  <th key={i} style={{ padding: '4px 6px', textAlign: 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {approved.map((o, i) => {
                const rawWt = o.rawMaterials?.reduce((s, r) => s + (r.totalWeight || 0), 0) || 0;
                const outWt = o.outputProducts?.reduce((s, p) => s + (p.totalWeight || 0), 0) || 0;
                return (
                  <tr key={o._id} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '3px 6px', fontFamily: 'monospace', fontWeight: 'bold', color: '#b45309' }}>
                      {o.docNumber ? `#${o.docNumber}` : '—'}
                    </td>
                    <td style={{ padding: '3px 6px' }}>{new Date(o.date).toLocaleDateString('ar-EG')}</td>
                    <td style={{ padding: '3px 6px' }}>{WH_LABEL[o.warehouse] || o.warehouse}</td>
                    <td style={{ padding: '3px 6px', color: '#c2410c', fontWeight: 'bold' }}>{fmt(rawWt, 2)}</td>
                    <td style={{ padding: '3px 6px', color: '#15803d', fontWeight: 'bold' }}>{fmt(outWt, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#374151', color: 'white', fontWeight: 'bold' }}>
                <td colSpan={3} style={{ padding: '4px 6px' }}>الإجمالي</td>
                <td style={{ padding: '4px 6px', color: '#fca5a5' }}>{fmt(summary.totalRawWeight, 2)}</td>
                <td style={{ padding: '4px 6px', color: '#86efac' }}>{fmt(summary.totalOutputWeight, 2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <PrintFooter />
    </div>
  );
});
PrintFullDoc.displayName = 'PrintFullDoc';

// ─── Shared print sub-components ─────────────────────────────────────────────
function WorkerInfoBlock({ worker }) {
  return (
    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px' }}>
      <div>
        <p style={{ color: '#888', margin: '0 0 2px', fontSize: '9px' }}>اسم المعلم</p>
        <p style={{ fontWeight: 'bold', fontSize: '14px', margin: 0 }}>{worker.name}</p>
      </div>
      {worker.code && (
        <div style={{ borderRight: '1px solid #ddd', paddingRight: '14px' }}>
          <p style={{ color: '#888', margin: '0 0 2px', fontSize: '9px' }}>الكود</p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{worker.code}</p>
        </div>
      )}
      {worker.warehouse && (
        <div style={{ borderRight: '1px solid #ddd', paddingRight: '14px' }}>
          <p style={{ color: '#888', margin: '0 0 2px', fontSize: '9px' }}>العنبر</p>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{WH_LABEL[worker.warehouse] || worker.warehouse}</p>
        </div>
      )}
    </div>
  );
}

function SummaryNumbers({ summary }) {
  const items = [
    { label: 'أوامر معتمدة',    value: summary.totalOrders,                     color: '#1d4ed8' },
    { label: 'خامات مستهلكة',   value: `${fmt(summary.totalRawWeight, 2)} ك`,    color: '#c2410c' },
    { label: 'منتجات تمت',      value: `${fmt(summary.totalOutputWeight, 2)} ك`,  color: '#15803d' },
    { label: 'هالك',            value: `${fmt(summary.wasteWeight, 2)} ك`,        color: summary.wasteWeight > 0 ? '#dc2626' : '#64748b' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '12px' }}>
      {items.map((s, i) => (
        <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '9px', margin: '0 0 4px' }}>{s.label}</p>
          <p style={{ fontWeight: 'bold', fontSize: '13px', color: s.color, margin: 0 }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function ItemsTable({ title, rows, headerColor, rowBg, totalWeight, textColor }) {
  if (!rows?.length) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ fontWeight: 'bold', fontSize: '11px', color: textColor, borderBottom: `1px solid ${rowBg}`, paddingBottom: '4px', marginBottom: '6px' }}>{title}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ background: headerColor, color: 'white' }}>
            {['#', 'الكود', 'الصنف', 'الكراتين', 'الوزن الكلي'].map((h, i) => (
              <th key={i} style={{ padding: '4px 6px', textAlign: i > 1 ? 'center' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? rowBg : 'white', borderBottom: `1px solid ${rowBg}` }}>
              <td style={{ padding: '3px 6px', textAlign: 'center', color: '#888' }}>{i + 1}</td>
              <td style={{ padding: '3px 6px', fontFamily: 'monospace', color: '#2563eb' }}>{r.itemCode}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>{r.itemName}</td>
              <td style={{ padding: '3px 6px', textAlign: 'center' }}>{r.totalQty}</td>
              <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 'bold', color: textColor }}>{fmt(r.totalWeight, 3)} ك</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: headerColor, color: 'white', fontWeight: 'bold' }}>
            <td colSpan={4} style={{ padding: '4px 6px', textAlign: 'right' }}>الإجمالي</td>
            <td style={{ padding: '4px 6px', textAlign: 'center' }}>{fmt(totalWeight, 3)} ك</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PrintFooter() {
  return (
    <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontSize: '9px', color: '#9ca3af' }}>
      الشركة العالمية للاستيراد والتصدير — طُبع في {new Date().toLocaleString('ar-EG')}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main WorkerCard component
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkerCard({ worker, onClose, initialSeasonId = '' }) {
  const [seasons,    setSeasons]    = useState([]);
  const [seasonId,   setSeasonId]   = useState(initialSeasonId);
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [expanded,   setExpanded]   = useState(null);

  const summaryPrintRef = useRef(null);
  const fullPrintRef    = useRef(null);

  // ── season label for print ────────────────────────────────────────────────
  const seasonLabel = seasons.find(s => s._id === seasonId)?.name || 'كل المواسم';

  // ── print hooks ───────────────────────────────────────────────────────────
  const printSummary = useReactToPrint({
    contentRef:    summaryPrintRef,
    documentTitle: `ملخص معلم - ${worker.name} - ${seasonLabel}`,
    pageStyle:     PRINT_STYLE,
  });
  const printFull = useReactToPrint({
    contentRef:    fullPrintRef,
    documentTitle: `كشف معلم - ${worker.name} - ${seasonLabel}`,
    pageStyle:     PRINT_STYLE,
  });

  // ── load seasons once ─────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/manufacturing/seasons')
      .then(({ data: s }) => {
        setSeasons(s);
        // لو مفيش initialSeasonId → اختار النشط تلقائياً
        if (!initialSeasonId) {
          const active = s.find(x => x.isActive);
          if (active) setSeasonId(active._id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line

  // ── load data لما يتغير seasonId أو workerId ──────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      const params = seasonId ? { seasonId } : {};
      const { data: res } = await api.get(`/manufacturing/worker/${worker._id}`, { params });
      setData(res);
    } catch {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [worker._id, seasonId]);

  useEffect(() => { load(); }, [load]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl w-full max-w-3xl my-4 shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b bg-gray-800 rounded-t-2xl text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-xl font-bold shrink-0">
                {worker.name?.charAt(0) || '؟'}
              </div>
              <div>
                <h2 className="text-lg font-bold">{worker.name}</h2>
                <p className="text-gray-400 text-sm">{seasonLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* زرار ملخص فقط */}
              {data && (
                <button
                  onClick={printSummary}
                  className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                  title="طباعة ملخص المنتجات والخامات فقط"
                >
                  🖨️ ملخص
                </button>
              )}
              {/* زرار كامل مع الأوامر */}
              {data && (
                <button
                  onClick={printFull}
                  className="flex items-center gap-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                  title="طباعة الكشف الكامل مع أوامر التصنيع"
                >
                  🖨️ كامل
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl mr-1">×</button>
            </div>
          </div>

          <div className="p-5">

            {/* ── Season filter ──────────────────────────────────────────────── */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                🗓️ الموسم — كل موسم كشف مستقل
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSeasonId('')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    !seasonId ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  كل المواسم
                </button>
                {seasons.map(s => (
                  <button
                    key={s._id}
                    onClick={() => setSeasonId(s._id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                      seasonId === s._id
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {s.name}
                    {s.isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Loading ────────────────────────────────────────────────────── */}
            {loading && (
              <div className="text-center py-10 text-gray-400">
                <div className="flex gap-1 justify-center mb-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                  ))}
                </div>
                <p className="text-sm">جاري التحميل...</p>
              </div>
            )}

            {/* ── Empty state ───────────────────────────────────────────────── */}
            {!loading && data && data.orders.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <p className="text-4xl mb-2">📭</p>
                <p className="text-sm">مفيش أوامر لهذا المعلم في موسم <b>{seasonLabel}</b></p>
                <p className="text-xs text-gray-300 mt-1">لما تبدأ موسم جديد الكشف بيبدأ من الصفر</p>
              </div>
            )}

            {/* ── Data ──────────────────────────────────────────────────────── */}
            {!loading && data && data.orders.length > 0 && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'أوامر معتمدة', val: data.summary.totalOrders,              color: 'blue'  },
                    { label: 'خامات',         val: `${fmt(data.summary.totalRawWeight,1)} ك`,  color: 'orange'},
                    { label: 'منتجات',        val: `${fmt(data.summary.totalOutputWeight,1)} ك`, color: 'green' },
                    { label: 'هالك',          val: `${fmt(data.summary.wasteWeight,1)} ك`,  color: data.summary.wasteWeight > 0 ? 'red' : 'gray' },
                  ].map(({ label, val, color }) => {
                    const cls = {
                      blue:   ['bg-blue-50','border-blue-100','text-blue-700','text-blue-400'],
                      orange: ['bg-orange-50','border-orange-100','text-orange-600','text-orange-400'],
                      green:  ['bg-green-50','border-green-100','text-green-700','text-green-400'],
                      red:    ['bg-red-50','border-red-100','text-red-600','text-red-400'],
                      gray:   ['bg-gray-50','border-gray-100','text-gray-500','text-gray-400'],
                    }[color];
                    return (
                      <div key={label} className={`rounded-xl p-3 text-center border ${cls[0]} ${cls[1]}`}>
                        <p className={`text-xs mb-1 ${cls[3]}`}>{label}</p>
                        <p className={`text-xl font-bold ${cls[2]}`}>{val}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Products */}
                {data.summary.products.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">📦 المنتجات الناتجة</h3>
                    <div className="space-y-1.5">
                      {data.summary.products.map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-lg">
                          <div>
                            <span className="font-medium text-gray-800 text-sm">{p.itemName}</span>
                            <span className="text-gray-400 text-xs mr-2">{p.itemCode}</span>
                          </div>
                          <div className="flex gap-4 text-sm font-medium text-green-700">
                            <span>{p.totalQty} كرتون</span>
                            <span>{fmt(p.totalWeight, 1)} ك</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw materials */}
                {data.summary.rawMaterials.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">📤 الخامات المستهلكة</h3>
                    <div className="space-y-1.5">
                      {data.summary.rawMaterials.map((r, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-orange-50 rounded-lg">
                          <div>
                            <span className="font-medium text-gray-800 text-sm">{r.itemName}</span>
                            <span className="text-gray-400 text-xs mr-2">{r.itemCode}</span>
                          </div>
                          <div className="flex gap-4 text-sm font-medium text-orange-600">
                            <span>{r.totalQty} كرتون</span>
                            <span>{fmt(r.totalWeight, 1)} ك</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Orders collapsible */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    📋 الأوامر ({data.orders.length})
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {data.orders.map(order => {
                      const st    = STATUS[order.status];
                      const isExp = expanded === order._id;
                      return (
                        <div key={order._id} className="border border-gray-200 rounded-xl overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-right"
                            onClick={() => setExpanded(isExp ? null : order._id)}
                          >
                            <div className="flex items-center gap-3">
                              {/* docNumber بدل orderNumber */}
                              <span className="font-mono text-amber-700 text-sm font-bold">
                                {order.docNumber ? `#${order.docNumber}` : <span className="text-gray-300 italic text-xs">بدون مستند</span>}
                              </span>
                              <span className="text-gray-500 text-xs">
                                {new Date(order.date).toLocaleDateString('ar-EG')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>
                                {st.icon} {st.text}
                              </span>
                              <span className="text-gray-400 text-xs">{isExp ? '▲' : '▼'}</span>
                            </div>
                          </button>

                          {isExp && (
                            <div className="px-4 pb-3 pt-2 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="font-semibold text-orange-600 mb-1">الخامات</p>
                                {order.rawMaterials?.map((r, i) => (
                                  <div key={i} className="flex justify-between py-0.5 text-gray-600">
                                    <span>{r.itemName}</span>
                                    <span className="font-medium">{fmt(r.totalWeight, 2)} ك</span>
                                  </div>
                                ))}
                              </div>
                              <div>
                                <p className="font-semibold text-green-600 mb-1">المنتجات</p>
                                {order.outputProducts?.map((p, i) => (
                                  <div key={i} className="flex justify-between py-0.5 text-gray-600">
                                    <span>{p.itemName}</span>
                                    <span className="font-medium">{fmt(p.totalWeight, 2)} ك</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Hidden print targets ───────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none opacity-0" aria-hidden="true">
        <PrintSummaryDoc ref={summaryPrintRef} worker={worker} data={data} seasonLabel={seasonLabel} />
      </div>
      <div className="fixed inset-0 pointer-events-none opacity-0" aria-hidden="true">
        <PrintFullDoc ref={fullPrintRef} worker={worker} data={data} seasonLabel={seasonLabel} />
      </div>
    </>
  );
}
