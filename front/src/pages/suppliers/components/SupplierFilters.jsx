// ─── components/SupplierFilters.jsx ──────────────────────────────────────────
// شريط البحث والفلاتر فوق جدول الموردين
// ────────────────────────────────────────────────────────────────────────────
export default function SupplierFilters({ search, setSearch, onlyDebtors, setOnlyDebtors }) {
  return (
    <div className="card mb-4 flex gap-3 flex-wrap items-center">
      {/* ── بحث ── */}
      <input
        className="input-field flex-1 min-w-48"
        placeholder="بحث بالاسم أو الكود..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* ── فلتر "عليهم فلوس بس" ── */}
      <label className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
        <input
          type="checkbox"
          checked={onlyDebtors}
          onChange={(e) => setOnlyDebtors(e.target.checked)}
          className="w-4 h-4 accent-red-600"
        />
        <span className={`text-sm font-medium ${onlyDebtors ? 'text-red-600' : 'text-gray-600'}`}>
          عليهم فلوس بس
        </span>
      </label>
    </div>
  );
}
