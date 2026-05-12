// ─── CustomerFilters.jsx ─────────────────────────────────────────────────────
// شريط البحث والفلاتر فوق جدول العملاء
// Props: search, filterType, onlyDebtors + handlers
// ────────────────────────────────────────────────────────────────────────────

export default function CustomerFilters({
  search, setSearch,
  filterType, setFilterType,
  onlyDebtors, setOnlyDebtors,
}) {
  return (
    <div className="card mb-4 flex gap-3 flex-wrap items-center">
      {/* ── بحث بالاسم أو الكود ── */}
      <input
        className="input-field flex-1 min-w-48"
        placeholder="بحث بالاسم أو الكود..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* ── فلتر نوع العميل ── */}
      <select
        className="input-field w-36"
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
      >
        <option value="">كل الأنواع</option>
        <option value="credit">آجل</option>
        <option value="cash">نقدي</option>
      </select>

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
