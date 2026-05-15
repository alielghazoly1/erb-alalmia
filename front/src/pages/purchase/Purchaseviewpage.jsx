import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { useDispatch, useSelector } from 'react-redux';
import {
  approvePurchaseInvoice,
  suspendPurchaseInvoice,
  cancelPurchaseInvoice,
} from '../../store/slices/purchaseSlice';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ✅ FIX precision: نستخدم totalWeight من DB مباشرة
// weight = وزن الكرتونة الواحدة | وزن كلي = totalWeight (from DB) | total = totalWeight × price
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const calcTotalWeight = (qty, wt) => (qty || 0) * (wt || 0);
const calcTotal = (qty, wt, pr) => (qty || 0) * (wt || 0) * (pr || 0);

const statusMap = {
  pending: {
    text: 'معلق',
    cls: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  },
  approved: {
    text: 'مُوافق',
    cls: 'bg-green-100 text-green-700 border-green-300',
  },
  suspended: {
    text: 'موقوف',
    cls: 'bg-orange-100 text-orange-700 border-orange-300',
  },
  cancelled: { text: 'ملغي', cls: 'bg-red-100 text-red-700 border-red-300' },
};

const PRINT_STYLE = `
  @page { size: A4 portrait; margin: 12mm 10mm 14mm 10mm; }
  @page :first { margin-top: 10mm; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
  }
  body { font-size: 10px; color: #1a1a2e; background: white; direction: rtl; }
  .card {
    box-shadow: none !important;
    border: 1px solid #d1d5db !important;
    border-radius: 4px !important;
    margin-bottom: 8px !important;
    padding: 8px 10px !important;
  }
  .overflow-x-auto { overflow: visible !important; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  thead tr th { padding: 5px 7px !important; font-size: 9.5px !important; }
  tbody tr td { padding: 3.5px 7px !important; font-size: 9.5px !important; }
  tfoot tr td { padding: 5px 7px !important; font-size: 9.5px !important; }
  tr[style*="#1e3a5f"] { background-color: #1e3a5f !important; color: white !important; }
  tr[style*="#1e293b"] { background-color: #1e293b !important; color: white !important; }
  tr[style*="#f8fafc"] { background-color: #f8fafc !important; }
  .no-print { display: none !important; }
  .print-footer { break-inside: avoid; page-break-inside: avoid; }
`;

export default function PurchaseViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actLoading, setActLoading] = useState(false);

  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: invoice
      ? `فاتورة توريد ${invoice.invoiceNumber}`
      : 'فاتورة توريد',
    pageStyle: PRINT_STYLE,
  });

  const loadInvoice = () => {
    setLoading(true);
    api
      .get(`/purchase/${id}`)
      .then(({ data }) => setInvoice(data))
      .catch(() => toast.error('خطأ في تحميل الفاتورة'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const handleApprove = async () => {
    if (!window.confirm('هتوافق على الفاتورة وتحدث المخزن؟')) return;
    setActLoading(true);
    const res = await dispatch(approvePurchaseInvoice(id));
    setActLoading(false);
    if (!res.error) {
      toast.success('تم الموافقة ✅');
      loadInvoice();
    } else toast.error(res.payload || 'خطأ');
  };

  const handleSuspend = async () => {
    const reason = window.prompt('سبب التعليق:') ?? '';
    if (reason === null) return;
    setActLoading(true);
    const res = await dispatch(suspendPurchaseInvoice({ id, reason }));
    setActLoading(false);
    if (!res.error) {
      toast.success('تم التعليق');
      loadInvoice();
    } else toast.error(res.payload || 'خطأ');
  };

  const handleCancel = async () => {
    if (!window.confirm('هتلغي الفاتورة دي نهائياً؟')) return;
    setActLoading(true);
    const res = await dispatch(cancelPurchaseInvoice(id));
    setActLoading(false);
    if (!res.error) {
      toast.success('تم الإلغاء');
      navigate('/purchase');
    } else toast.error(res.payload || 'خطأ');
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">📄</div>
          <p>جاري تحميل الفاتورة...</p>
        </div>
      </div>
    );

  if (!invoice)
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">😕</p>
        <p>الفاتورة مش موجودة</p>
        <Link
          to="/purchase"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          ← رجوع للقائمة
        </Link>
      </div>
    );

  const st = statusMap[invoice.status] || statusMap.pending;
  const totalWeight =
    invoice.items?.reduce(
      (s, i) => s + (i.totalWeight !== undefined && Number(i.totalWeight) > 0 ? Number(i.totalWeight) : (Number(i.quantity)||0)*(Number(i.weight)||0)),
      0,
    ) || 0;
  const totalQty =
    invoice.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* شريط الأكشن - مش بيتطبع */}
      <div className="no-print flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary text-sm px-3 py-2"
          >
            ← رجوع
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {invoice.invoiceNumber}
            </h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium border ${st.cls}`}
            >
              {st.text}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handlePrint}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            🖨️ طباعة
          </button>
          {isAdmin && invoice.status === 'pending' && (
            <button
              onClick={handleApprove}
              disabled={actLoading}
              className="btn-primary text-sm bg-green-600 hover:bg-green-700"
            >
              ✅ موافقة
            </button>
          )}
          {invoice.status === 'pending' && (
            <button
              onClick={handleSuspend}
              disabled={actLoading}
              className="text-sm px-4 py-2 rounded-xl bg-orange-100 text-orange-700 hover:bg-orange-200 font-medium"
            >
              ⏸ تعليق
            </button>
          )}
          {invoice.status !== 'approved' && invoice.status !== 'cancelled' && (
            <button
              onClick={handleCancel}
              disabled={actLoading}
              className="text-sm px-4 py-2 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 font-medium"
            >
              🗑 إلغاء
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          منطقة الطباعة
      ═══════════════════════════════════════════ */}
      <div
        ref={printRef}
        className="bg-white border border-gray-200 rounded-xl p-8"
      >
        {/* رأس الفاتورة */}
        <div
          className="flex justify-between items-start mb-6 pb-4"
          style={{ borderBottom: '2px solid #1e3a5f' }}
        >
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>
              الشركة العالمية للاستيراد والتصدير
            </h1>
            <p className="text-sm mt-1 text-gray-500">فاتورة توريد</p>
          </div>
          <div className="text-left">
            <p className="text-xs text-gray-400">رقم الفاتورة</p>
            <p className="text-xl font-bold text-blue-700">
              {invoice.invoiceNumber}
            </p>
            <p className="text-xs text-gray-400 mt-1">رقم المستند</p>
            <p className="font-bold text-gray-800">{invoice.docNumber}</p>
            <div
              className={`mt-2 text-xs px-2 py-0.5 rounded-full font-medium border inline-block ${st.cls} no-print`}
            >
              {st.text}
            </div>
          </div>
        </div>
        {/* شريط ألوان */}
        <div
          style={{
            height: '3px',
            background:
              'linear-gradient(90deg, #1e3a5f 0%, #3b82f6 50%, #93c5fd 100%)',
            borderRadius: '0 0 2px 2px',
            marginBottom: '16px',
          }}
        ></div>

        {/* بيانات الفاتورة */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* المورد */}
          <div className="card" style={{ background: '#f8fafc' }}>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">
              بيانات المورد
            </p>
            <p className="font-bold text-gray-800 text-lg">
              {invoice.supplierName}
            </p>
            <p className="text-gray-500 text-sm mt-0.5">
              كود: {invoice.supplierCode}
            </p>
            {invoice.supplier?.phone && (
              <p className="text-gray-500 text-sm mt-0.5">
                📞 {invoice.supplier.phone}
              </p>
            )}
          </div>

          {/* تفاصيل الفاتورة */}
          <div className="card" style={{ background: '#f8fafc' }}>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">
              تفاصيل الفاتورة
            </p>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400">التاريخ</p>
                <p className="font-medium">
                  {new Date(invoice.date).toLocaleDateString('ar-EG')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">الوقت</p>
                <p className="font-medium">
                  {new Date(invoice.createdAt).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">المخزن</p>
                <p className="font-medium">
                  {invoice.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">بواسطة</p>
                <p className="font-medium">{invoice.createdBy?.name}</p>
              </div>
              {invoice.approvedBy && (
                <>
                  <div>
                    <p className="text-xs text-gray-400">الموافقة</p>
                    <p className="font-medium text-green-600">
                      {invoice.approvedBy?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">تاريخ الموافقة</p>
                    <p className="font-medium text-green-600">
                      {new Date(invoice.approvedAt).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                </>
              )}
              {invoice.season?.name && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">الموسم</p>
                  <p className="font-medium">{invoice.season.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* جدول الأصناف */}
        <div className="mb-6">
          <table
            className="w-full text-sm"
            style={{ borderCollapse: 'collapse' }}
          >
            <thead>
              <tr
                style={{
                  background: '#1e3a5f',
                  color: 'white',
                  fontWeight: 'bold',
                }}
              >
                <th className="px-3 py-2.5 text-right">#</th>
                <th className="px-3 py-2.5 text-right">الكود</th>
                <th className="px-3 py-2.5 text-right">الصنف</th>
                <th className="px-3 py-2.5 text-center">العدد</th>
                <th className="px-3 py-2.5 text-center">وزن/وحدة</th>
                <th className="px-3 py-2.5 text-center">وزن كلي (ك)</th>
                <th className="px-3 py-2.5 text-center">السعر/ك</th>
                <th className="px-3 py-2.5 text-center">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    background: idx % 2 === 0 ? '#f8fafc' : 'white',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <td className="px-3 py-2 text-gray-400 text-center text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2 font-mono text-blue-600 text-xs font-medium">
                    {item.itemCode}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {item.itemName}
                  </td>
                  <td className="px-3 py-2 text-center font-medium">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-500 text-xs">
                    {(item.weight || 0).toFixed(3)}
                  </td>
                  <td className="px-3 py-2 text-center font-medium">
                    {(item.totalWeight !== undefined && Number(item.totalWeight) > 0 ? round3(Number(item.totalWeight)) : round3((Number(item.quantity)||0)*(Number(item.weight)||0))).toFixed(3)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {(item.price || 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold">
                    {((item.totalWeight !== undefined && Number(item.totalWeight) > 0 ? Number(item.totalWeight) : (Number(item.quantity)||0)*(Number(item.weight)||0)) * (Number(item.price)||0)).toFixed(
                      2,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                style={{
                  background: '#1e3a5f',
                  color: 'white',
                  fontWeight: 'bold',
                }}
              >
                <td colSpan={3} className="px-3 py-2.5 text-right">
                  الإجمالي ({invoice.items?.length} صنف — {totalQty} كرتون)
                </td>
                <td className="px-3 py-2.5 text-center">{totalQty}</td>
                <td></td>
                <td className="px-3 py-2.5 text-center">
                  {totalWeight.toFixed(3)} ك
                </td>
                <td></td>
                <td className="px-3 py-2.5 text-center text-lg">
                  {invoice.totalAmount?.toFixed(2)} ج.م
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ملاحظات + ملخص */}
        <div className="flex justify-between items-start gap-6">
          <div className="flex-1">
            {invoice.notes && (
              <div className="card" style={{ background: '#fafafa' }}>
                <p className="text-xs text-gray-400 mb-1">ملاحظات</p>
                <p className="text-sm text-gray-700">{invoice.notes}</p>
              </div>
            )}
            {invoice.suspendReason && (
              <div
                className="card mt-2"
                style={{ background: '#fff7ed', borderColor: '#fed7aa' }}
              >
                <p className="text-xs text-orange-500 mb-1">سبب التعليق</p>
                <p className="text-sm text-orange-700">
                  {invoice.suspendReason}
                </p>
              </div>
            )}
          </div>

          {/* ملخص المالي */}
          <div className="w-56 space-y-2">
            <div className="flex justify-between text-sm py-1.5 border-b">
              <span className="text-gray-500">الإجمالي الكلي</span>
              <span className="font-bold text-gray-800">
                {invoice.totalAmount?.toFixed(2)} ج.م
              </span>
            </div>
            <div className="flex justify-between text-sm py-1.5 border-b">
              <span className="text-gray-500">إجمالي الوزن</span>
              <span className="font-medium text-gray-700">
                {totalWeight.toFixed(3)} كيلو
              </span>
            </div>
            <div className="flex justify-between text-sm py-1.5">
              <span className="text-gray-500">عدد الكراتين</span>
              <span className="font-medium text-gray-700">{totalQty}</span>
            </div>
          </div>
        </div>

        {/* فوتر الطباعة */}
        <div
          className="mt-10 pt-4 print-footer"
          style={{ borderTop: '2px solid #1e3a5f' }}
        >
          <div
            className="grid grid-cols-3 gap-4 text-center"
            style={{ fontSize: '10px', color: '#6b7280' }}
          >
            <div>
              <div
                style={{
                  borderTop: '1px solid #9ca3af',
                  paddingTop: '10px',
                  marginTop: '32px',
                }}
              >
                توقيع المورد
              </div>
            </div>
            <div>
              <p
                className="font-semibold"
                style={{ color: '#1e3a5f', fontSize: '11px' }}
              >
                الشركة العالمية للاستيراد والتصدير
              </p>
              <p className="mt-1">
                {invoice.invoiceNumber} |{' '}
                {new Date(invoice.date).toLocaleDateString('ar-EG')}
              </p>
              <p
                style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}
              >
                {invoice.supplierName} |{' '}
                {invoice.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر'}
              </p>
            </div>
            <div>
              <div
                style={{
                  borderTop: '1px solid #9ca3af',
                  paddingTop: '10px',
                  marginTop: '32px',
                }}
              >
                توقيع المخزن
              </div>
            </div>
          </div>
          <div
            style={{
              height: '3px',
              background:
                'linear-gradient(90deg, #1e3a5f 0%, #3b82f6 50%, #93c5fd 100%)',
              borderRadius: '2px',
              marginTop: '12px',
            }}
          ></div>
        </div>
      </div>

      {/* معلومات إضافية تحت الفاتورة (مش بتتطبع) */}
      <div className="no-print mt-4 text-xs text-gray-400 text-center">
        أنشئت بواسطة: {invoice.createdBy?.name} |{' '}
        {new Date(invoice.createdAt).toLocaleString('ar-EG')}
      </div>
    </div>
  );
}
