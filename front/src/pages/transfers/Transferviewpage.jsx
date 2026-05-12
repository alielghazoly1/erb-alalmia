import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useReactToPrint } from 'react-to-print';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PRINT_STYLE = `
  @page { size: A4 portrait; margin: 12mm 10mm 14mm 10mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
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

const dirMap = {
  R2O: { text: 'رمسيس الي أكتوبر', icon: '🔵' },
  O2R: { text: 'أكتوبر الي رمسيس', icon: '🟣' },
};

const fmt     = (n, d = 3) => Number(n || 0).toFixed(d);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export default function TransferViewPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user }  = useSelector(s => s.auth);
  const isAdmin   = user?.role === 'admin';

  const [transfer, setTransfer] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: transfer ? `إذن تحويل ${transfer.transferNumber}` : 'إذن تحويل',
    pageStyle: PRINT_STYLE,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.get(`/transfers/${id}`)
      .then(({ data }) => { setTransfer(data); setLoading(false); })
      .catch(() => { toast.error('خطأ في تحميل الإذن'); navigate(-1); });
  }, [id]);

  if (loading) return <div className="text-center py-24 text-gray-400">جاري التحميل...</div>;
  if (!transfer) return null;

  const st  = statusMap[transfer.status] || statusMap.pending;
  const dir = dirMap[transfer.direction] || dirMap.R2O;

  const canEdit = transfer.status === 'pending' || (transfer.status === 'approved' && isAdmin);
  const editPath = `/transfers/${transfer._id}/edit`;

  const totalWeight   = transfer.items?.reduce((s, i) => s + (i.totalWeight || 0), 0) || 0;
  const totalQuantity = transfer.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* أزرار التحكم */}
      <div className="no-print flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate(-1)} className="btn-secondary text-sm">← رجوع</button>
          <h1 className="text-xl font-bold text-gray-800">{transfer.transferNumber}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.text}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
            {dir.icon} {dir.text}
          </span>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link
              to={editPath}
              className={`text-sm ${transfer.status === 'approved' ? 'btn-danger' : 'btn-secondary'}`}
            >
              {transfer.status === 'approved' ? '⚠️ تعديل (معتمد)' : '✏️ تعديل'}
            </Link>
          )}
          <button onClick={handlePrint} className="btn-primary text-sm">🖨️ طباعة</button>
        </div>
      </div>

      {/* تحذير للمعتمد */}
      {transfer.status === 'approved' && isAdmin && (
        <div className="no-print mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex gap-2">
          <span>⚠️</span>
          <span>هذا الإذن <strong>معتمد</strong>. أي تعديل سيُعيد احتساب المخزن تلقائياً.</span>
        </div>
      )}

      {/* المحتوى القابل للطباعة */}
      <div
        ref={printRef}
        className="bg-white border border-gray-200 rounded-xl p-5 print:border-none print:p-0 print:rounded-none"
      >
        {/* هيدر */}
        <div className="flex justify-between items-start mb-3 pb-2 border-b-2 border-gray-800">
          <div>
            <h1 className="text-xl font-bold text-gray-800">الشركة العالمية للاستيراد والتصدير</h1>
            <p className="text-gray-500 text-sm mt-1">إذن تحويل بضاعة بين المخازن</p>
          </div>
          <div className="text-left pl-4 space-y-1">
            <div>
              <p className="text-lg  text-black font-bold"> رقم الإذن</p>
              <p className="text-xl font-bold text-purple-700">{transfer.docNumber}</p>
            </div>
          
          </div>
        </div>

        {/* بيانات رئيسية */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* التحويل من / إلى */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-4 text-center">
              <div className="flex-1">
                <p className="text-xs text-black font-bold mb-1">من مخزن</p>
                <p className=" font-bold text-blue-700">
                  {transfer.fromWarehouse === 'ramses' ? '🔵 رمسيس' : '🟣 أكتوبر'}
                </p>
              </div>
              <div className="text-2xl text-black font-extrabold">←</div>
              <div className="flex-1">
                <p className="text-xs  text-black font-bold mb-1">إلى مخزن</p>
                <p className=" font-bold text-purple-700">
                  {transfer.toWarehouse === 'ramses' ? '🔵 رمسيس' : '🟣 أكتوبر'}
                </p>
              </div>
            </div>
          </div>
          {/* التفاصيل */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              { label: 'التاريخ',   value: fmtDate(transfer.date) },
              { label: 'الحالة',    value: st.text },
              { label: 'بواسطة',   value: transfer.createdBy?.name },
              { label: 'الموسم',   value: transfer.season?.name },
              ...(transfer.status === 'approved' ? [
                { label: 'وافق عليه', value: transfer.approvedBy?.name },
                { label: 'تاريخ الموافقة', value: fmtDate(transfer.approvedAt) },
              ] : []),
            ].filter(x => x.value).map((x, i) => (
              <div key={i}>
                <p className="text-xs text-black font-bold">{x.label}</p>
                <p className="font-medium text-gray-700">{x.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* جدول الأصناف */}
        <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#eee', color: 'black', fontWeight: 'bold', borderBottom: '2px solid #333' }}>
              {['#', 'الكود', 'الصنف', 'العدد', 'وزن/وحدة', 'الوزن الكلي'].map((h, i) => (
                <th key={i} className={`px-3  text-l font-bold ${i > 2 ? 'text-center' : 'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transfer.items?.map((item, idx) => (
              <tr
                key={idx}
                style={{
                  background:   idx % 2 === 0 ? '#f0f9ff' : 'white',
                  borderBottom: '1px solid #bae6fd',
                }}
              >
                <td className="px-3 py-1 text-black text-xs text-center">{idx + 1}</td>
                <td className="px-3 py-1 font-mono text-blue-600 text-xs">{item.itemCode}</td>
                <td className="px-3 py-1 font-medium text-gray-800">{item.itemName}</td>
                <td className="px-3 py-1 text-center font-bold">{item.quantity}</td>
                <td className="px-3 py-1 text-center text-xs font-bold text-black">{fmt(item.weight)} ك</td>
                <td className="px-3 py-1 text-center font-semibold text-blue-700">
                  {fmt(item.totalWeight || (item.quantity * item.weight))} ك
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#eee', color: 'black', fontWeight: 'bold', borderTop: '2px solid #333' }}>
              <td colSpan={3} className="px-3 py-1 text-right text-xs">الإجمالي</td>
              <td className="px-3 py-1 text-center text-sm">{totalQuantity} كرتونة</td>
              <td></td>
              <td className="px-3 py-1 text-center text-sm">{fmt(totalWeight)} ك</td>
            </tr>
          </tfoot>
        </table>

        {/* ملاحظات + ملخص */}
        <div className="flex justify-between gap-6">
          <div className="flex-1 space-y-2">
            {transfer.notes && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">ملاحظات</p>
                <p className="text-sm text-gray-700">{transfer.notes}</p>
              </div>
            )}
          </div>

          {/* ملخص مالي */}
          <div className="w-56 space-y-2">
            <div className="flex justify-between text-sm border-b">
              <span className="text-black">عدد الأصناف</span>
              <span className="font-bold text-gray-800">{transfer.items?.length || 0}</span>
            </div>
            <div className="flex justify-between text-sm border-b">
              <span className="text-black">إجمالي الكراتين</span>
              <span className="font-bold text-gray-800">{totalQuantity}</span>
            </div>
          
          </div>
        </div>

        
      </div>
    </div>
  );
}