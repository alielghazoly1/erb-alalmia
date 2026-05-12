// ─── components/SectionHeader.jsx ───────────────────────────────────────────
// هيدر قسم داخل كشف الحساب — عنوان + عدد السجلات + الإجمالي
// مشترك بين InvoicesSection / ReturnsSection / PaymentsSection
// ────────────────────────────────────────────────────────────────────────────

export default function SectionHeader({ title, count, total, totalColor = 'text-gray-700' }) {
  return (
    <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b flex items-center justify-between">
      <span>
        {title}{' '}
        <span className="text-gray-400 font-normal text-sm">({count})</span>
      </span>
      {total && (
        <span className={`text-sm font-normal ${totalColor}`}>{total}</span>
      )}
    </h3>
  );
}
