// ─── components/StatementHeader.jsx ─────────────────────────────────────────
// هيدر كشف الحساب — اسم العميل + زر طباعة + زر إضافة دفعة + اختيار موسم
// مخفي جزئياً في الطباعة (الأزرار تختفي — الاسم والموسم يظهران)
// ────────────────────────────────────────────────────────────────────────────

export default function StatementHeader({
  customer,
  seasons,
  seasonId,
  onSeasonChange,
  onPrint,
  onAddPayment,
  isAdmin,
  printRef,        // ref للزر المخصص للطباعة (اختياري)
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">

      {/* ── اسم العميل ── */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          كشف حساب — {customer?.name}
          <span className="text-gray-400 font-normal text-base mr-2">
            ({customer?.code})
          </span>
        </h2>
        {customer?.phone && (
          <p className="text-gray-400 text-sm">📞 {customer.phone}</p>
        )}
      </div>

      {/* ── أدوات ── */}
      <div className="flex items-center gap-2 flex-wrap print:hidden">

        {/* اختيار الموسم */}
        {seasons.length > 0 && (
          <select
            className="input-field w-40 text-sm"
            value={seasonId}
            onChange={(e) => onSeasonChange(e.target.value)}
          >
            <option value="">الموسم النشط</option>
            {seasons.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} {s.isActive ? '✅' : ''}
              </option>
            ))}
          </select>
        )}

        {/* إضافة دفعة — أدمن فقط */}
        {isAdmin && (
          <button
            onClick={onAddPayment}
            className="btn-primary text-sm"
          >
            + إضافة دفعة
          </button>
        )}

        {/* طباعة */}
        <button
          onClick={onPrint}
          className="btn-secondary text-sm"
        >
          🖨️ طباعة
        </button>
      </div>
    </div>
  );
}
