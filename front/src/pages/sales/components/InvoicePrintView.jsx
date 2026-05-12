import { useNavigate } from 'react-router-dom';

export default function InvoicePrintView({ invoice, onBack, backLabel = 'رجوع' }) {
  const navigate = useNavigate();
  const qw = (q, w) => (q || 0) * (w || 0);
  const t  = (q, w, p) => (q || 0) * (w || 0) * (p || 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="print:hidden flex gap-2 mb-4">
        <button className="btn-primary" onClick={() => window.print()}>🖨️ طباعة</button>
        <button className="btn-secondary" onClick={() => {
          if (onBack) { onBack(); return; }
          if (window.history.length > 1) navigate(-1);
          else navigate('/sales/new');
        }}>← {backLabel}</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 print:border-none print:p-0">
        {/* header */}
        <div className="flex justify-between items-start mb-2 pb-2 border-b-2 border-gray-800">
          <div>
            <h1 className="text-xl font-bold text-gray-800">الشركة العالمية للاستيراد والتصدير</h1>
            <p className="black text-sm mt-1">فاتورة مبيعات</p>
          </div>
          <div className="text-left flex justify-items-center items-center gap-5">
            <div>
              <p className="text-xs text-blue-700">رقم الفاتورة</p>
              <p className="font-bold text-blue-700">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs black">رقم المستند</p>
              <p className="font-bold text-xl black">{invoice.docNumber}</p>
            </div>
          </div>
        </div>

        {/* customer + meta */}
        <div className="grid grid-cols-2 gap-6 mb-2 border-b border-gray-500 pb-2">
          <div>
            <p className="text-xs black uppercase tracking-wide mb-1">بيانات العميل</p>
            <p className="font-bold black text-xl">{invoice.customerName}</p>
            <p className="black text-sm">كود العميل: {invoice.customerCode}</p>
          </div>
          <div className="text-left">
            <div className="grid grid-cols-3 gap-2 text-sm">
              {[
                { label: 'التاريخ',    value: new Date(invoice.date).toLocaleDateString('ar-EG') },
                { label: 'الوقت',     value: new Date(invoice.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) },
                { label: 'المخزن',    value: invoice.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر' },
                { label: 'كتبت بواسطة', value: invoice.createdBy?.name },
                { label: 'تم الموافقة', value: invoice.approvedBy ? invoice.approvedBy.name : '❌ يجب الدفع في الخزنة' },
                { label: 'الموسم',    value: invoice.season?.name },
              ].filter(x => x.value).map((x, i) => (
                <div key={i}>
                  <p className="text-xs bold black">{x.label}</p>
                  <p className="font-medium">{x.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* items table */}
        <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#eee', fontWeight: 'bold', borderBottom: '2px solid #333' }}>
              {['#','الكود','الصنف','العدد','الوزن','وزن كلي','السعر/ك','الإجمالي'].map((h,i) => (
                <th key={i} className={i > 2 ? 'text-center' : 'text-right'}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #e2e8f0' }}>
                <td className="px-3 py-1 text-gray-400 text-center text-xs">{idx + 1}</td>
                <td className="px-3 py-1 font-mono text-blue-600 text-xs">{item.itemCode}</td>
                <td className="px-4 py-1 font-medium black bold">{item.itemName}</td>
                <td className="px-4 py-1 bold text-center font-medium">{item.quantity}</td>
                <td className="px-4 bold py-1 text-center text-xs black">{(item.weight||0).toFixed(3)}</td>
                <td className="px-4 bold py-1 text-center font-medium">{qw(item.quantity, item.weight).toFixed(3)}</td>
                <td className="px-4 bold py-1 text-center">{(item.price||0).toFixed(2)}</td>
                <td className="px-4 bold py-1 text-center font-semibold">{t(item.quantity, item.weight, item.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#eee', fontWeight: 'bold', borderTop: '2px solid #333' }}>
              <td colSpan={5} className="text-right">الإجمالي</td>
              <td className="text-center">{invoice.items?.reduce((s,i) => s + qw(i.quantity, i.weight), 0).toFixed(3)} ك</td>
              <td></td>
              <td className="text-center bold text-lg">{invoice.totalAmount?.toFixed(2)} ج.م</td>
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
              <span className="font-bold text-gray-800">{invoice.totalAmount?.toFixed(2)} ج.م</span>
            </div>
            {invoice.paymentMethod !== 'credit' && (
              <>
                {invoice.paymentMethod === 'mixed' && (
                  <>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>نقدي</span>
                      <span>{parseFloat(invoice.cashAmount||0).toFixed(2)} ج.م</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>انستاباي</span>
                      <span>{parseFloat(invoice.instapayAmount||0).toFixed(2)} ج.م</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm text-green-600">
                  <span>المدفوع ({{'cash':'نقدي','instapay':'انستاباي','transfer':'تحويل','check':'شيك','mixed':'مختلط'}[invoice.paymentMethod]})</span>
                  <span className="font-bold">{parseFloat(invoice.paidAmount||0).toFixed(2)} ج.م</span>
                </div>
                {(invoice.paidAmount||0) < (invoice.totalAmount||0) && (
                  <div className="flex justify-between text-sm text-red-600 font-bold border-t pt-2">
                    <span>المتبقي</span>
                    <span>{((invoice.totalAmount||0) - (invoice.paidAmount||0)).toFixed(2)} ج.م</span>
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
