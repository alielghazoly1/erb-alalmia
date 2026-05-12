// ─── Pagination.jsx ──────────────────────────────────────────────────────────
// مكوّن Pagination قابل للإعادة الاستخدام في أي جدول
// يعرض أزرار الصفحات مع "..." للصفحات البعيدة
// ────────────────────────────────────────────────────────────────────────────

export default function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null;

  // بناء قائمة الصفحات مع "..." — نعرض: الأولى، الأخيرة، والقريبة من الصفحة الحالية
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <span className="text-sm text-gray-500">
        صفحة {page} من {totalPages} • {total} عميل
      </span>

      <div className="flex gap-1">
        {/* السابق */}
        <button
          disabled={page === 1}
          onClick={() => onPageChange((p) => p - 1)}
          className="px-3 py-1.5 text-sm rounded border disabled:opacity-40 hover:bg-gray-50"
        >
          ← السابق
        </button>

        {/* أرقام الصفحات */}
        {pages.map((item, i) =>
          item === '...' ? (
            <span key={`dot-${i}`} className="px-2 py-1.5 text-gray-400">...</span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              className={`px-3 py-1.5 text-sm rounded border ${
                item === page
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              {item}
            </button>
          ),
        )}

        {/* التالي */}
        <button
          disabled={page === totalPages}
          onClick={() => onPageChange((p) => p + 1)}
          className="px-3 py-1.5 text-sm rounded border disabled:opacity-40 hover:bg-gray-50"
        >
          التالي →
        </button>
      </div>
    </div>
  );
}
