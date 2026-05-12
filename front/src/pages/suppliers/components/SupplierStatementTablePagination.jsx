// ─── components/SupplierStatementTablePagination.jsx ────────────────────────
// Pagination للجداول داخل كشف المورد — مخفي في الطباعة
// ────────────────────────────────────────────────────────────────────────────

export default function SupplierStatementTablePagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t text-sm print:hidden">
      <span className="text-gray-500">
        صفحة {page} / {totalPages} ({total} سجل)
      </span>
      <div className="flex gap-1 items-center">
        <button
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50"
        >
          ← السابق
        </button>
        {pages.map((item, i) =>
          item === '...' ? (
            <span key={`dot-${i}`} className="px-2 py-1 text-gray-400">...</span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              className={`px-3 py-1 rounded border ${
                item === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50"
        >
          التالي →
        </button>
      </div>
    </div>
  );
}
