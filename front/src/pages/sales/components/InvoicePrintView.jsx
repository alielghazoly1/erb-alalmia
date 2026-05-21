// ─── InvoicePrintView.jsx ─────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom';
import { toNum, fmtFixed, smartFmt } from '../../../utils/fmt';

const PAYMENT_LABELS = {
  cash: 'نقدي', instapay: 'انستاباي',
  transfer: 'تحويل بنكي', check: 'شيك', mixed: 'مختلط', credit: 'آجل',
};

export default function InvoicePrintView({ invoice, onBack, backLabel = 'رجوع' }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/sales/new');
  };

  const r2 = (v) => Math.round(v * 100) / 100;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const totalAmount  = toNum(invoice.totalAmount);
  const paidAmount   = toNum(invoice.paidAmount);
  const remaining    = r2(totalAmount - paidAmount);
  // نستخدم totalWeight المخزّن إن وُجد، وإلا نحسبه من qty × wt كـ fallback
  const totalWeight  = toNum(invoice.totalWeight) > 0
    ? toNum(invoice.totalWeight)
    : r3((invoice.items ?? []).reduce(
        (s, i) => s + (toNum(i.totalWeight) > 0 ? toNum(i.totalWeight) : toNum(i.quantity) * toNum(i.weight)), 0
      ));

  return (
    <div className="max-w-4xl mx-auto">
      {/* أزرار */}
      <div className="print:hidden flex gap-2 mb-4">
        <button className="btn-primary" onClick={() => window.print()}>🖨️ طباعة</button>
        <button className="btn-secondary" onClick={handleBack}>← {backLabel}</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 print:border-none print:p-0">
        {/* header */}
        <div className="flex justify-between items-start mb-2 pb-2 border-b-2 border-gray-800">
          <div>
            <h1 className="text-xl font-bold text-gray-800">الشركة العالمية للاستيراد والتصدير</h1>
            <p className="text-sm text-gray-600 mt-1">فاتورة مبيعات</p>
          </div>
          <div className="text-left flex items-center gap-5">
            <div>
              <p className="text-xs text-blue-700">رقم الفاتورة</p>
              <p className="font-bold text-blue-700">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">رقم المستند</p>
              <p className="font-bold text-xl text-gray-800">{invoice.docNumber}</p>
            </div>
          </div>
        </div>

        {/* customer + meta */}
        <div className="grid grid-cols-2 gap-6 mb-2 border-b border-gray-300 pb-2">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">بيانات العميل</p>
            <p className="font-bold text-gray-800 text-xl">{invoice.customerName}</p>
            <p className="text-gray-500 text-sm">كود: {invoice.customerCode}</p>
          </div>
          <div className="text-left">
            <div className="grid grid-cols-3 gap-2 text-sm">
              {[
                { label: 'التاريخ',      value: invoice.date    ? new Date(invoice.date).toLocaleDateString('ar-EG')      : null },
                { label: 'الوقت',        value: invoice.createdAt ? new Date(invoice.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : null },
                { label: 'المخزن',       value: invoice.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر' },
                { label: 'بواسطة',       value: invoice.createdBy?.name },
                { label: 'الموافقة',     value: invoice.approvedBy?.name ?? '❌ يجب الدفع في الخزنة' },
                { label: 'الموسم',       value: invoice.season?.name },
              ].filter(x => x.value).map((x, i) => (
                <div key={i}>
                  <p className="text-xs text-gray-400 font-medium">{x.label}</p>
                  <p className="font-medium text-gray-700">{x.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* items table */}
        <table className="w-full text-sm mb-4" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#eee', fontWeight: 'bold', borderBottom: '2px solid #333' }}>
              {['#', 'الكود', 'الصنف', 'العدد', 'وزن/وحدة', 'وزن كلي', 'السعر/ك', 'الإجمالي'].map((h, i) => (
                <th key={i} className={`px-3 py-2 ${i > 2 ? 'text-center' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(invoice.items ?? []).map((item, idx) => {
              const qty = toNum(item.quantity);
              const wt  = toNum(item.weight);
              const pr  = toNum(item.price);
              // استخدم totalWeight المخزّن مباشرة — يتجنب أخطاء الفاصلة العائمة
              const tw  = toNum(item.totalWeight) > 0
                ? toNum(item.totalWeight)
                : r3(qty * wt);
              const rowTotal = toNum(item.total) > 0
                ? toNum(item.total)
                : r2(tw * pr);
              return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #e2e8f0' }}>
                  <td className="px-3 py-1 text-gray-400 text-center text-xs">{idx + 1}</td>
                  <td className="px-3 py-1 font-mono text-blue-600 text-xs">{item.itemCode}</td>
                  <td className="px-4 py-1 font-medium text-gray-800">{item.itemName}</td>
                  <td className="px-4 py-1 text-center font-bold">{smartFmt(qty, 3)}</td>
                  <td className="px-4 py-1 text-center text-xs">{smartFmt(wt, 3)}</td>
                  <td className="px-4 py-1 text-center font-medium">{smartFmt(tw, 3)} ك</td>
                  <td className="px-4 py-1 text-center">{smartFmt(pr, 2)}</td>
                  <td className="px-4 py-1 text-center font-semibold">{smartFmt(rowTotal, 2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#eee', fontWeight: 'bold', borderTop: '2px solid #333' }}>
              <td colSpan={5} className="px-3 py-2 text-right">الإجمالي</td>
              <td className="px-3 py-2 text-center">{smartFmt(totalWeight, 3)} ك</td>
              <td />
              <td className="px-3 py-2 text-center text-lg font-bold">{smartFmt(totalAmount, 2)} ج.م</td>
            </tr>
          </tfoot>
        </table>

        {/* totals + notes */}
        <div className="flex justify-between gap-6">
          <div className="flex-1">
            {invoice.notes && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">ملاحظات</p>
                <p className="text-sm text-gray-700">{invoice.notes}</p>
              </div>
            )}
          </div>
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm py-1 border-b">
              <span className="text-gray-500">إجمالي الفاتورة</span>
              <span className="font-bold text-gray-800">{smartFmt(totalAmount, 2)} ج.م</span>
            </div>

            {invoice.paymentMethod !== 'credit' && (
              <>
                {invoice.paymentMethod === 'mixed' && (
                  <>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>نقدي</span>
                      <span>{smartFmt(invoice.cashAmount, 2)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>انستاباي</span>
                      <span>{smartFmt(invoice.instapayAmount, 2)} ج.م</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm text-green-600">
                  <span>المدفوع ({PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod})</span>
                  <span className="font-bold">{smartFmt(paidAmount, 2)} ج.م</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-sm text-red-600 font-bold border-t pt-2">
                    <span>المتبقي</span>
                    <span>{smartFmt(remaining, 2)} ج.م</span>
                  </div>
                )}
              </>
            )}

            {invoice.paymentMethod === 'credit' && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 font-medium">فاتورة آجل</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// helper داخلي
function round2(v) { return Math.round(v * 100) / 100; }
