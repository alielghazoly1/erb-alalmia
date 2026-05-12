import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useReactToPrint } from 'react-to-print';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PRINT_STYLE = `
  @page { size: A4 portrait; margin: 12mm 10mm 14mm 10mm; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
  }
  body { font-size: 10px; color: #111; background: white; direction: rtl; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tbody tr { page-break-inside: avoid; }
  .no-print { display: none !important; }
`;

const statusMap = {
  pending:  { text: 'معلق',   cls: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'مُوافق', cls: 'bg-green-100 text-green-700' },
  rejected: { text: 'مرفوض', cls: 'bg-red-100 text-red-700' },
};

const refundLabel = {
  none:  'لا يوجد رد نقدي (آجل)',
  cash:  'نقدي',
  bank:  'بنكي',
  mixed: 'مختلط (نقدي + بنكي)',
};

const fmt = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

export default function ReturnViewPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const isAdmin  = user?.role === 'admin';

  const [ret, setRet]       = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: ret ? `مرتجع ${ret.invoiceNumber}` : 'مرتجع',
    pageStyle: PRINT_STYLE,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    api
      .get(`/returns/${id}`)
      .then(({ data }) => { setRet(data); setLoading(false); })
      .catch(() => { toast.error('خطأ في تحميل المرتجع'); navigate(-1); });
  }, [id]);

  if (loading)
    return <div className="text-center py-20 text-gray-400">جاري التحميل...</div>;
  if (!ret) return null;

  const isCustomer = ret.type === 'customer_return';
  const partyName  = isCustomer ? ret.customerName : ret.supplierName;
  const partyCode  = isCustomer ? ret.customerCode : ret.supplierCode;
  const st = statusMap[ret.status] || { text: ret.status, cls: 'bg-gray-100 text-gray-600' };

  const totalWeight =
    ret.items?.reduce((s, i) => s + (i.quantity || 0) * (i.weight || 0), 0) || 0;

  const editPath = isCustomer
    ? `/returns/customer/${ret._id}/edit`
    : `/returns/supplier/${ret._id}/edit`;

  // زر التعديل: pending → الكل | approved → الأدمن فقط | rejected → لا
  const canEdit =
    ret.status === 'pending' ||
    (ret.status === 'approved' && isAdmin);

  return (
    <div className="max-w-4xl mx-auto">
      {/* أزرار التحكم */}
      <div className="no-print flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary text-sm">
            ← رجوع
          </button>
          <h1 className="text-xl font-bold text-gray-800">{ret.invoiceNumber}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
            {st.text}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isCustomer ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isCustomer ? '↩️ مرتجع عميل' : '↩️ مرتجع مورد'}
          </span>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link
              to={editPath}
              className={`text-sm ${
                ret.status === 'approved'
                  ? 'btn-danger'   // أحمر للمعتمد — تحذير بصري
                  : 'btn-secondary'
              }`}
            >
              {ret.status === 'approved' ? '⚠️ تعديل (معتمد)' : '✏️ تعديل'}
            </Link>
          )}
          <button onClick={handlePrint} className="btn-primary text-sm">
            🖨️ طباعة
          </button>
        </div>
      </div>

      {/* تحذير للمعتمد */}
      {ret.status === 'approved' && isAdmin && (
        <div className="no-print mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex gap-2">
          <span>⚠️</span>
          <span>
            هذا المرتجع <strong>معتمد</strong>. أي تعديل سيُعيد احتساب المخزن والخزنة تلقائياً.
          </span>
        </div>
      )}

      {/* المحتوى القابل للطباعة */}
      <div
        ref={printRef}
        className="bg-white border border-gray-200 rounded-xl p-8 print:border-none print:p-0 print:rounded-none"
      >
        {/* هيدر الطباعة */}
        <div className="flex justify-between items-start mb-6 pb-5 border-b-2 border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              الشركة العالمية للاستيراد والتصدير
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isCustomer ? 'مرتجع مبيعات' : 'مرتجع مشتريات'}
            </p>
          </div>
          <div className="text-left space-y-1">
            <div>
              <p className="text-xs text-gray-400">رقم المرتجع</p>
              <p className="text-xl font-bold text-orange-600">{ret.invoiceNumber}</p>
            </div>
            {ret.docNumber && (
              <div>
                <p className="text-xs text-gray-400">رقم المستند</p>
                <p className="font-bold text-gray-700">{ret.docNumber}</p>
              </div>
            )}
          </div>
        </div>

        {/* بيانات رئيسية */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              {isCustomer ? 'بيانات العميل' : 'بيانات المورد'}
            </p>
            <p className="font-bold text-gray-800 text-lg">{partyName}</p>
            {partyCode && <p className="text-gray-500 text-sm">كود: {partyCode}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'التاريخ',       value: fmtDate(ret.date) },
              { label: 'المخزن',        value: ret.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر' },
              { label: 'الحالة',        value: st.text },
              { label: 'بواسطة',        value: ret.createdBy?.name },
              { label: 'الموسم',        value: ret.season?.name },
              { label: 'فاتورة أصلية', value: ret.originalInvoice },
            ]
              .filter((x) => x.value)
              .map((x, i) => (
                <div key={i}>
                  <p className="text-xs text-gray-400">{x.label}</p>
                  <p className="font-medium text-gray-700">{x.value}</p>
                </div>
              ))}
          </div>
        </div>

        {/* جدول الأصناف */}
        <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: 'white', fontWeight: 'bold' }}>
              {['#', 'الكود', 'الصنف', 'العدد', 'وزن/وحدة', 'وزن كلي', 'السعر/ك', 'الإجمالي'].map(
                (h, i) => (
                  <th
                    key={i}
                    className={`px-3 py-2 text-xs font-medium ${i > 2 ? 'text-center' : 'text-right'}`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {ret.items?.map((item, idx) => {
              const tw    = (item.quantity || 0) * (item.weight || 0);
              const total = tw * (item.price || 0);
              return (
                <tr
                  key={idx}
                  style={{
                    background:   idx % 2 === 0 ? '#fff7ed' : 'white',
                    borderBottom: '1px solid #fed7aa',
                  }}
                >
                  <td className="px-3 py-2 text-gray-400 text-xs text-center">{idx + 1}</td>
                  <td className="px-3 py-2 font-mono text-blue-600 text-xs">{item.itemCode}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{item.itemName}</td>
                  <td className="px-3 py-2 text-center font-bold">{item.quantity}</td>
                  <td className="px-3 py-2 text-center text-xs text-gray-400">{fmt(item.weight, 3)}</td>
                  <td className="px-3 py-2 text-center font-medium text-orange-700">{fmt(tw, 3)} ك</td>
                  <td className="px-3 py-2 text-center text-gray-600">{fmt(item.price)}</td>
                  <td className="px-3 py-2 text-center font-semibold text-gray-800">{fmt(total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#7c2d12', color: 'white', fontWeight: 'bold' }}>
              <td colSpan={5} className="px-3 py-2 text-right text-xs">الإجمالي</td>
              <td className="px-3 py-2 text-center text-sm">{fmt(totalWeight, 3)} ك</td>
              <td></td>
              <td className="px-3 py-2 text-center text-sm">{fmt(ret.totalAmount)} ج.م</td>
            </tr>
          </tfoot>
        </table>

        {/* ملخص أسفل */}
        <div className="flex justify-between gap-6">
          <div className="flex-1 space-y-2">
            {ret.notes && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">ملاحظات</p>
                <p className="text-sm text-gray-700">{ret.notes}</p>
              </div>
            )}
            {ret.originalInvoice && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-400 mb-1">الفاتورة الأصلية</p>
                <p className="text-sm text-blue-700 font-medium">{ret.originalInvoice}</p>
              </div>
            )}
            {ret.status === 'approved' && ret.approvedBy && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-500 mb-1">تمت الموافقة</p>
                <p className="text-sm text-green-700">
                  {ret.approvedBy.name} — {fmtDate(ret.approvedAt)}
                </p>
              </div>
            )}
          </div>

          {/* ملخص مالي */}
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm py-1.5 border-b">
              <span className="text-gray-500">إجمالي المرتجع</span>
              <span className="font-bold text-orange-600">{fmt(ret.totalAmount)} ج.م</span>
            </div>
            <div className="flex justify-between text-sm py-1.5 border-b">
              <span className="text-gray-500">الوزن الكلي</span>
              <span className="font-medium text-gray-700">{fmt(totalWeight, 3)} كيلو</span>
            </div>

            {isCustomer && ret.refundMethod && ret.refundMethod !== 'none' && (
              <>
                <div className="flex justify-between text-sm py-1 border-b">
                  <span className="text-gray-500">طريقة الرد</span>
                  <span className="font-medium text-gray-700">{refundLabel[ret.refundMethod]}</span>
                </div>
                {(ret.refundMethod === 'cash' || ret.refundMethod === 'mixed') && ret.refundCashAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">مسترد نقدي</span>
                    <span className="font-bold text-green-600">{fmt(ret.refundCashAmount)} ج.م</span>
                  </div>
                )}
                {(ret.refundMethod === 'bank' || ret.refundMethod === 'mixed') && ret.refundBankAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">مسترد بنكي</span>
                    <span className="font-bold text-blue-600">{fmt(ret.refundBankAmount)} ج.م</span>
                  </div>
                )}
              </>
            )}

            {isCustomer && (!ret.refundMethod || ret.refundMethod === 'none') && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                <p className="text-xs text-blue-600 font-medium">يُخصم من رصيد العميل (آجل)</p>
              </div>
            )}
          </div>
        </div>

        {/* فوتر الطباعة */}
        <div className="hidden print:block text-center mt-8 pt-4 border-t border-gray-300">
          <p className="text-xs text-gray-400">
            الشركة العالمية للاستيراد والتصدير — {new Date().toLocaleDateString('ar-EG')}
          </p>
        </div>
      </div>
    </div>
  );
}