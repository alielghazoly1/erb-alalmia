import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import api from '../../services/api';
import SupplierSearch from '../../components/common/SupplierSearch';
import ItemSearch from '../../components/common/ItemSearch';
import toast from 'react-hot-toast';

const PRINT_STYLE = `
  @page { size: A4 portrait; margin: 10mm 8mm 12mm 8mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
  body { font-size: 9.5px; color: #111; background: white; direction: rtl; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .no-print { display: none !important; }
`;

const fmt  = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtN = (n)        => Number(n || 0).toLocaleString('ar-EG');

export default function SupplierItemStatementPage() {
  const [supplier, setSupplier] = useState(null);
  const [item,     setItem]     = useState(null);
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [seasonFilter, setSeasonFilter] = useState('');
  const [seasons,      setSeasons]      = useState([]);

  const printRef   = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `كشف صنف - ${supplier?.name || ''} - ${item?.name || ''}`,
    pageStyle: PRINT_STYLE,
  });

  const load = async (s, it, sid = seasonFilter) => {
    if (!s || !it) return;
    setLoading(true);
    try {
      const params = {};
      if (sid) params.seasonId = sid;
      const { data: res } = await api.get(
        `/suppliers/${s._id}/item/${it._id}`,
        { params }
      );
      setData(res);
      // جيب المواسم مرة واحدة
      if (!seasons.length) {
        const { data: ss } = await api.get('/seasons');
        setSeasons(ss || []);
      }
    } catch {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSupplier = (s)  => { setSupplier(s); setData(null); load(s, item); };
  const handleItem     = (it) => { setItem(it);    setData(null); load(supplier, it); };
  const handleSeason   = (sid) => {
    setSeasonFilter(sid);
    setData(null);
    load(supplier, item, sid);
  };

  // حركات المبيعات والمرتجعات
  const purchases = data?.movements?.filter(m => m.type === 'purchase') || [];
  const returns   = data?.movements?.filter(m => m.type === 'return')   || [];

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── هيدر ── */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">كشف صنف عند مورد</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="font-medium text-gray-700">{data.supplier?.name}</span>
              <span className="text-gray-300 mx-2">|</span>
              <span className="font-mono text-blue-600 text-xs">{data.item?.code}</span>
              <span className="text-gray-300 mx-1">—</span>
              <span className="font-medium">{data.item?.name}</span>
              {seasonFilter && seasons.length && (
                <span className="mr-2 text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                  {seasons.find(s => s._id === seasonFilter)?.name || ''}
                </span>
              )}
            </p>
          )}
        </div>
        {data && (
          <button className="btn-secondary no-print" onClick={handlePrint}>🖨️ طباعة</button>
        )}
      </div>

      {/* ── فلاتر البحث ── */}
      <div className="card mb-5 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">المورد *</label>
            <SupplierSearch onSelect={handleSupplier} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">الصنف *</label>
            <ItemSearch onSelect={handleItem} placeholder="ابحث عن الصنف..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">الموسم</label>
            <select
              className="input-field"
              value={seasonFilter}
              onChange={e => handleSeason(e.target.value)}
              disabled={!supplier || !item}
            >
              <option value="">كل المواسم</option>
              {seasons.map(s => (
                <option key={s._id} value={s._id}>
                  {s.name}{s.isActive ? ' ✦' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── loading ── */}
      {loading && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          <p>جاري التحميل...</p>
        </div>
      )}

      {/* ── placeholder ── */}
      {!loading && !data && (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📦</p>
          <p className="text-lg font-medium text-gray-500">اختار مورد وصنف للعرض</p>
          <p className="text-sm mt-1">بيظهرلك كل حركات الصنف ده عند المورد</p>
        </div>
      )}

      {/* ── النتائج ── */}
      {data && !loading && (
        <div ref={printRef}>

          {/* رأس الطباعة */}
          <div className="hidden print:block mb-5">
            <div className="flex justify-between items-start pb-3" style={{ borderBottom: '2px solid #1e3a5f' }}>
              <div>
                <h1 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>
                  الشركة العالمية للاستيراد والتصدير
                </h1>
                <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>كشف صنف عند مورد</p>
              </div>
              <div style={{ textAlign: 'left', fontSize: '10px', color: '#555' }}>
                <p><b>المورد:</b> {data.supplier?.name} ({data.supplier?.code})</p>
                <p><b>الصنف:</b> {data.item?.name} ({data.item?.code})</p>
                <p>{new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #1e3a5f, #3b82f6, #93c5fd)', borderRadius: '0 0 2px 2px' }}></div>
          </div>

          {/* ── بطاقات الملخص ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'إجمالي الكراتين',  value: fmtN(data.totalQty),                 unit: 'كرتون',  color: 'blue',   icon: '📦' },
              { label: 'الوزن الكلي',       value: fmt(data.totalWeight, 3),            unit: 'كيلو',   color: 'purple', icon: '⚖️' },
              { label: 'إجمالي التوريد',   value: fmt(data.totalAmount),               unit: 'ج.م',    color: 'green',  icon: '💰' },
              { label: 'آخر سعر / كيلو',   value: fmt(data.lastPrice),                 unit: 'ج.م/ك',  color: 'amber',  icon: '🏷️' },
            ].map((s, i) => (
              <div key={i} className={`bg-${s.color}-50 rounded-xl p-4 text-center border border-${s.color}-100`}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className={`text-xs text-${s.color}-500 mb-1`}>{s.label}</p>
                <p className={`text-2xl font-bold text-${s.color}-700`}>{s.value}</p>
                <p className={`text-xs text-${s.color}-400`}>{s.unit}</p>
              </div>
            ))}
          </div>

          {/* ── بار المرتجعات (لو فيه) ── */}
          {data.returnQty > 0 && (
            <div className="mb-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">↩️</span>
                <span className="font-medium text-orange-700">إجمالي المرتجع للمورد</span>
              </div>
              <div className="flex gap-6 text-orange-600 text-sm font-medium">
                <span>{fmtN(data.returnQty)} كرتون</span>
                <span>{fmt(data.returnWeight, 3)} كيلو</span>
                <span className="font-bold">{returns.reduce((s,m) => s + (m.total||0), 0).toFixed(2)} ج.م</span>
              </div>
            </div>
          )}

          {/* ── صافي التوريد ── */}
          {data.returnQty > 0 && (
            <div className="mb-4 px-4 py-3 bg-gray-800 rounded-xl flex items-center justify-between text-white">
              <span className="font-semibold">صافي التوريد (بعد المرتجعات)</span>
              <div className="flex gap-6 text-sm font-medium">
                <span>{fmtN(data.totalQty - data.returnQty)} كرتون</span>
                <span>{fmt(data.totalWeight - (data.returnWeight || 0), 3)} كيلو</span>
                <span className="text-green-400 font-bold text-base">
                  {(data.totalAmount - returns.reduce((s,m) => s+(m.total||0),0)).toFixed(2)} ج.م
                </span>
              </div>
            </div>
          )}

          {/* ── جدول الحركات ── */}
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b no-print bg-gray-50">
              <h3 className="font-semibold text-gray-700">
                سجل الحركات
                <span className="text-gray-400 font-normal text-sm mr-2">
                  ({data.movements?.length} حركة — {purchases.length} توريد / {returns.length} مرتجع)
                </span>
              </h3>
            </div>

            {data.movements?.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-medium">مفيش حركات لهذا الصنف عند هذا المورد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#1e3a5f', color: 'white' }}>
                      {[
                        { label: '#',           cls: 'text-right  px-3 py-2.5 text-xs font-medium' },
                        { label: 'النوع',        cls: 'text-right  px-3 py-2.5 text-xs font-medium' },
                        { label: 'التاريخ',      cls: 'text-right  px-3 py-2.5 text-xs font-medium' },
                        { label: 'الوقت',        cls: 'text-right  px-3 py-2.5 text-xs font-medium' },
                        { label: 'الموسم',       cls: 'text-right  px-3 py-2.5 text-xs font-medium' },
                        { label: 'الفاتورة',     cls: 'text-right  px-3 py-2.5 text-xs font-medium' },
                        { label: 'المستند',      cls: 'text-right  px-3 py-2.5 text-xs font-medium' },
                        { label: 'المخزن',       cls: 'text-right  px-3 py-2.5 text-xs font-medium' },
                        { label: 'الكراتين',     cls: 'text-center px-3 py-2.5 text-xs font-medium' },
                        { label: 'وزن/وحدة',    cls: 'text-center px-3 py-2.5 text-xs font-medium' },
                        { label: 'وزن كلي (ك)', cls: 'text-center px-3 py-2.5 text-xs font-medium' },
                        { label: 'السعر/ك',     cls: 'text-center px-3 py-2.5 text-xs font-medium' },
                        { label: 'الإجمالي',    cls: 'text-center px-3 py-2.5 text-xs font-medium' },
                        { label: 'فتح',          cls: 'text-center px-3 py-2.5 text-xs font-medium no-print' },
                      ].map((h, i) => (
                        <th key={i} className={h.cls}>{h.label}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {data.movements.map((m, idx) => {
                      const isReturn = m.type === 'return';
                      return (
                        <tr key={idx}
                          className={`hover:bg-gray-50 ${
                            isReturn
                              ? 'bg-orange-50/60'
                              : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}
                        >
                          {/* # */}
                          <td className="px-3 py-2.5 text-gray-400 text-xs text-center">{idx + 1}</td>

                          {/* النوع */}
                          <td className="px-3 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isReturn
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isReturn ? '↩️ مرتجع' : '🚚 توريد'}
                            </span>
                          </td>

                          {/* التاريخ */}
                          <td className="px-3 py-2.5 text-gray-700 text-xs font-medium whitespace-nowrap">
                            {new Date(m.date).toLocaleDateString('ar-EG')}
                          </td>

                          {/* الوقت */}
                          <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </td>

                          {/* الموسم */}
                          <td className="px-3 py-2.5 text-xs">
                            {m.season?.name
                              ? <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{m.season.name}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>

                          {/* رقم الفاتورة */}
                          <td className="px-3 py-2.5 font-mono text-blue-600 text-xs font-medium">
                            {m.invoiceNumber}
                          </td>

                          {/* المستند */}
                          <td className="px-3 py-2.5 text-gray-500 text-xs">{m.docNumber || '—'}</td>

                          {/* المخزن */}
                          <td className="px-3 py-2.5 text-gray-500 text-xs">
                            {m.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر'}
                          </td>

                          {/* الكراتين */}
                          <td className={`px-3 py-2.5 text-center font-bold text-sm ${
                            isReturn ? 'text-orange-600' : 'text-gray-800'
                          }`}>
                            {isReturn ? '-' : ''}{m.quantity}
                            <span className="text-xs text-gray-400 font-normal mr-0.5">ك</span>
                          </td>

                          {/* وزن الوحدة */}
                          <td className="px-3 py-2.5 text-center text-xs text-gray-400">
                            {fmt(m.weight, 3)}
                          </td>

                          {/* الوزن الكلي */}
                          <td className={`px-3 py-2.5 text-center font-medium text-sm ${
                            isReturn ? 'text-orange-500' : 'text-green-700'
                          }`}>
                            {isReturn ? '-' : ''}{fmt(m.totalWeight, 3)}
                          </td>

                          {/* السعر */}
                          <td className="px-3 py-2.5 text-center text-xs text-gray-500">
                            {fmt(m.price)}
                          </td>

                          {/* الإجمالي */}
                          <td className={`px-3 py-2.5 text-center font-semibold text-xs ${
                            isReturn ? 'text-orange-600' : 'text-gray-800'
                          }`}>
                            {isReturn ? '-' : ''}{fmt(m.total)}
                          </td>

                          {/* رابط فتح */}
                          <td className="px-3 py-2.5 text-center no-print">
                            {m.invoiceId ? (
                              <Link
                                to={isReturn ? `/returns/${m.invoiceId}` : `/purchase/${m.invoiceId}`}
                                className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg font-medium transition-colors"
                              >
                                فتح ←
                              </Link>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* footer الجدول */}
                  <tfoot>
                    {/* صف توريد */}
                    {purchases.length > 0 && (
                      <tr style={{ background: '#1e3a5f', color: 'white', fontWeight: 'bold' }}>
                        <td colSpan={8} className="px-3 py-2 text-right text-xs">
                          إجمالي التوريد ({purchases.length} فاتورة)
                        </td>
                        <td className="px-3 py-2 text-center text-sm">
                          {fmtN(data.totalQty)} ك
                        </td>
                        <td></td>
                        <td className="px-3 py-2 text-center text-sm">
                          {fmt(data.totalWeight, 3)} ك
                        </td>
                        <td></td>
                        <td className="px-3 py-2 text-center text-sm">
                          {fmt(data.totalAmount)} ج
                        </td>
                        <td className="no-print"></td>
                      </tr>
                    )}

                    {/* صف مرتجع */}
                    {returns.length > 0 && (
                      <tr style={{ background: '#9a3412', color: 'white', fontWeight: 'bold' }}>
                        <td colSpan={8} className="px-3 py-2 text-right text-xs">
                          إجمالي المرتجعات ({returns.length})
                        </td>
                        <td className="px-3 py-2 text-center text-sm">
                          -{fmtN(data.returnQty)} ك
                        </td>
                        <td></td>
                        <td className="px-3 py-2 text-center text-sm">
                          -{fmt(data.returnWeight, 3)} ك
                        </td>
                        <td></td>
                        <td className="px-3 py-2 text-center text-sm">
                          -{returns.reduce((s,m) => s+(m.total||0), 0).toFixed(2)} ج
                        </td>
                        <td className="no-print"></td>
                      </tr>
                    )}

                    {/* صف الصافي */}
                    {returns.length > 0 && (
                      <tr style={{ background: '#14532d', color: 'white', fontWeight: 'bold' }}>
                        <td colSpan={8} className="px-3 py-2 text-right text-xs">الصافي</td>
                        <td className="px-3 py-2 text-center text-sm">
                          {fmtN(data.totalQty - data.returnQty)} ك
                        </td>
                        <td></td>
                        <td className="px-3 py-2 text-center text-sm">
                          {fmt(data.totalWeight - (data.returnWeight || 0), 3)} ك
                        </td>
                        <td></td>
                        <td className="px-3 py-2 text-center text-sm">
                          {(data.totalAmount - returns.reduce((s,m) => s+(m.total||0),0)).toFixed(2)} ج
                        </td>
                        <td className="no-print"></td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* فوتر الطباعة */}
          <div className="hidden print:block text-center mt-5 pt-3" style={{ borderTop: '1px solid #ccc' }}>
            <p style={{ fontSize: '9px', color: '#aaa' }}>
              الشركة العالمية للاستيراد والتصدير — {new Date().toLocaleDateString('ar-EG')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}