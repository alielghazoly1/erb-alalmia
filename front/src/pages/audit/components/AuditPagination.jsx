import React from 'react';

export default function AuditPagination({ page, totalPages, total, setPage }) {
  if (totalPages <= 1) return null;

  // Build visible page numbers (window of 5)
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (page <= 3)                     return i + 1;
    if (page >= totalPages - 2)        return totalPages - 4 + i;
    return page - 2 + i;
  }).filter((p) => p >= 1 && p <= totalPages);

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-500">
        صفحة {page} من {totalPages}{' '}
        <span className="text-gray-400">({total.toLocaleString('ar-EG')} سجل)</span>
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
        >
          ← السابق
        </button>

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              p === page
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages}
          className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
        >
          التالي →
        </button>
      </div>
    </div>
  );
}
