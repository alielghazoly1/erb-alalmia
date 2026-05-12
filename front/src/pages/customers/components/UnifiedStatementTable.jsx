// ─── components/UnifiedStatementTable.jsx ────────────────────────────────────
// جدول كشف الحساب الموحد — كل الحركات في جدول واحد مرتب بالتاريخ
// أعمدة: التاريخ | رقم المستند | نوع الحركة | مسحوبات | مدفوعات | له | عليه
// تذييل: إجمالي كل عمود + الرصيد النهائي
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom';

const fmt   = (n)    => (n ? n.toFixed(2) : '');
const fmtD  = (date) => new Date(date).toLocaleDateString('ar-EG');

/**
 * ننشئ صف موحد من كل حركة
 * نوع الصف: invoice | return | payment
 */
function buildRows(invoices = [], returns = [], payments = [], backToStatement) {
  const rows = [];

  for (const inv of invoices) {
    rows.push({
      key:      inv._id,
      date:     inv.date,
      docNum:   inv.docNumber || inv.invoiceNumber || '—',
      type:     'invoice',
      typeLabel:'فاتورة بيع',
      debit:    inv.totalAmount || 0,   // مسحوبات — على العميل
      credit:   0,
      link:     inv._id ? `/sales/${inv._id}` : null,
      state:    backToStatement,
    });
  }

  for (const ret of returns) {
    rows.push({
      key:      ret._id,
      date:     ret.date,
      docNum:   ret.invoiceNumber || ret.docNumber || '—',
      type:     'return',
      typeLabel:'مرتجع',
      debit:    0,
      credit:   ret.totalAmount || 0,  // مدفوعات — له العميل
      link:     ret._id ? `/returns/${ret._id}` : null,
    });
  }

  for (const pay of payments) {
    rows.push({
      key:      pay._id,
      date:     pay.date,
      docNum:   pay.receiptNumber || '—',
      type:     'payment',
      typeLabel:'سداد',
      debit:    0,
      credit:   pay.amount || 0,       // مدفوعات — سداد من العميل
      link:     null,
      rawPay:   pay,
    });
  }

  // ترتيب تصاعدي بالتاريخ
  rows.sort((a, b) => new Date(a.date) - new Date(b.date));
  return rows;
}

// ألوان كل نوع
const TYPE_STYLE = {
  invoice: { bg: '#eff6ff', badge: '#2563eb', text: '#1e40af' },
  return:  { bg: '#fff7ed', badge: '#ea580c', text: '#9a3412' },
  payment: { bg: '#f0fdf4', badge: '#16a34a', text: '#14532d' },
};

export default function UnifiedStatementTable({
  invoices       = [],
  returns        = [],
  payments       = [],
  initialBalance = 0,
  backToStatement,
  onEditPayment,   // callback (payment) => void  — للأدمن بس
}) {
  const rows = buildRows(invoices, returns, payments, backToStatement);

  // ── إجماليات ─────────────────────────────────────────────────────────────
  const totalDebit  = rows.reduce((s, r) => s + r.debit,  0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  // الرصيد المتراكم صف بصف
  let running = initialBalance; // لو فيه رصيد أولي
  const rowsWithBalance = rows.map((r) => {
    running += r.debit - r.credit;
    return { ...r, balance: running };
  });

  const finalBalance = running;
  const isDebt       = finalBalance > 0; // مستحق على العميل

  if (rows.length === 0) {
    return (
      <div className="card text-center py-12 text-gray-400">
        لا يوجد حركات في هذا الموسم
      </div>
    );
  }

  return (
    <div className="card mb-4 print:shadow-none print:border">
      {/* ── عنوان الجدول ── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-base font-bold text-gray-800">
          📋 حركات الحساب
        </h3>
        <span className="text-xs text-gray-400">{rows.length} حركة</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          {/* ── رأس الجدول ── */}
          <thead>
            <tr style={{
              borderTop:    '2px solid #1e293b',
              borderBottom: '2px solid #1e293b',
              background:   '#f1f5f9',
            }}>
              {[
                { label: '#',            align: 'center', w: '3%'  },
                { label: 'التاريخ',      align: 'right',  w: '10%' },
                { label: 'رقم المستند',  align: 'right',  w: '13%' },
                { label: 'نوع الحركة',  align: 'center', w: '12%' },
                { label: 'مسحوبات',      align: 'center', w: '13%' },
                { label: 'مدفوعات',      align: 'center', w: '13%' },
                { label: 'له',           align: 'center', w: '13%' },
                { label: 'عليه',         align: 'center', w: '13%' },
                { label: '',             align: 'center', w: '6%', printHide: true },
              ].map((col, i) => (
                <th
                  key={i}
                  style={{ width: col.w, padding: '8px 6px', textAlign: col.align, fontSize: '11px', fontWeight: 700, color: '#1e293b' }}
                  className={col.printHide ? 'print:hidden' : ''}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── جسم الجدول ── */}
          <tbody>
            {rowsWithBalance.map((row, idx) => {
              const st      = TYPE_STYLE[row.type];
              const isNeg   = row.balance < 0; // دائن
              return (
                <tr
                  key={row.key}
                  style={{
                    background:   idx % 2 === 0 ? st.bg : 'white',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  {/* # */}
                  <td style={{ padding: '7px 6px', textAlign: 'center', color: '#94a3b8' }}>
                    {idx + 1}
                  </td>

                  {/* التاريخ */}
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#475569' }}>
                    {fmtD(row.date)}
                  </td>

                  {/* رقم المستند */}
                  <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#374151' }}>
                    {row.link ? (
                      <Link
                        to={row.link}
                        state={row.state ? { backTo: row.state, backLabel: 'كشف العميل' } : undefined}
                        className="hover:underline"
                        style={{ color: st.text }}
                      >
                        {row.docNum}
                      </Link>
                    ) : (
                      row.docNum
                    )}
                  </td>

                  {/* نوع الحركة */}
                  <td style={{ padding: '7px 6px', textAlign: 'center' }}>
                    <span style={{
                      background:   st.badge,
                      color:        'white',
                      borderRadius: '4px',
                      padding:      '2px 7px',
                      fontSize:     '10px',
                      fontWeight:   600,
                    }}>
                      {row.typeLabel}
                    </span>
                  </td>

                  {/* مسحوبات — فاتورة فقط */}
                  <td style={{ padding: '7px 6px', textAlign: 'center', color: '#1d4ed8', fontWeight: row.debit ? 600 : 400 }}>
                    {row.debit ? fmt(row.debit) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>

                  {/* مدفوعات — سداد/مرتجع */}
                  <td style={{ padding: '7px 6px', textAlign: 'center', color: '#15803d', fontWeight: row.credit ? 600 : 400 }}>
                    {row.credit ? fmt(row.credit) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>

                  {/* له — رصيد دائن (مرتجع/سداد أكبر من المشتريات) */}
                  <td style={{ padding: '7px 6px', textAlign: 'center', color: '#15803d', fontWeight: isNeg ? 600 : 400 }}>
                    {isNeg ? fmt(Math.abs(row.balance)) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>

                  {/* عليه — رصيد مدين */}
                  <td style={{ padding: '7px 6px', textAlign: 'center', color: '#dc2626', fontWeight: !isNeg ? 600 : 400 }}>
                    {!isNeg ? fmt(row.balance) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>

                  {/* زر الفتح / تعديل — مخفي في الطباعة */}
                  <td style={{ padding: '7px 6px', textAlign: 'center' }} className="print:hidden">
                    {row.type === 'payment' && onEditPayment ? (
                      <button
                        onClick={() => onEditPayment(row.rawPay)}
                        style={{ color: '#3b82f6', fontSize: '11px', cursor: 'pointer', background: 'none', border: 'none' }}
                      >
                        ✏️
                      </button>
                    ) : row.link ? (
                      <Link
                        to={row.link}
                        state={row.state ? { backTo: row.state, backLabel: 'كشف العميل' } : undefined}
                        style={{ color: '#64748b', fontSize: '13px' }}
                      >
                        ←
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* ── تذييل الإجماليات ── */}
          <tfoot>
            <tr style={{ borderTop: '2px solid #1e293b', background: '#f8fafc', fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: '9px 6px', textAlign: 'right', fontSize: '12px', color: '#1e293b' }}>
                الإجمالي
              </td>
              <td style={{ padding: '9px 6px', textAlign: 'center', color: '#1d4ed8', fontSize: '12px' }}>
                {fmt(totalDebit)}
              </td>
              <td style={{ padding: '9px 6px', textAlign: 'center', color: '#15803d', fontSize: '12px' }}>
                {fmt(totalCredit)}
              </td>
              {/* له / عليه في الإجمالي */}
              <td style={{ padding: '9px 6px', textAlign: 'center', color: '#15803d', fontSize: '12px' }}>
                {finalBalance < 0 ? fmt(Math.abs(finalBalance)) : '—'}
              </td>
              <td style={{ padding: '9px 6px', textAlign: 'center', color: '#dc2626', fontSize: '12px' }}>
                {finalBalance >= 0 ? fmt(finalBalance) : '—'}
              </td>
              <td className="print:hidden" />
            </tr>

            {/* ── صف الرصيد النهائي ── */}
            <tr style={{
              borderTop:  '1px solid #e2e8f0',
              background: isDebt ? '#fef2f2' : '#f0fdf4',
            }}>
              <td colSpan={6} style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                {isDebt ? '⚠️ الرصيد المستحق (عليه)' : '✅ الرصيد (له)'}
              </td>
              <td colSpan={2} style={{
                padding:    '10px 6px',
                textAlign:  'center',
                fontWeight: 800,
                fontSize:   '16px',
                color:      isDebt ? '#dc2626' : '#15803d',
              }}>
                {fmt(Math.abs(finalBalance))} ج.م
              </td>
              <td className="print:hidden" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
