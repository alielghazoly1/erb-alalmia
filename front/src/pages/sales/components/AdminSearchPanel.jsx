const statusLabel = {
  approved:  { text: 'مُوافق',  cls: 'bg-green-100 text-green-700' },
  pending:   { text: 'معلق',    cls: 'bg-yellow-100 text-yellow-700' },
  suspended: { text: 'موقوف',   cls: 'bg-orange-100 text-orange-700' },
  cancelled: { text: 'ملغي',    cls: 'bg-red-100 text-red-700' },
};

export default function AdminSearchPanel({
  show, onToggle,
  searchQuery, searchResults, searchLoading,
  onSearchChange, onLoadForEdit,
}) {
  return (
    <div className="card mb-4 border-2 border-purple-200 bg-purple-50">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-semibold text-purple-700"
      >
        <span>🔍 بحث عن فاتورة للتعديل (أدمن فقط)</span>
        <span className="text-purple-400">{show ? '▲' : '▼'}</span>
      </button>

      {show && (
        <div className="mt-3">
          <input className="input-field"
            placeholder="ابحث بـ: رقم الفاتورة (SAL-) أو رقم المستند أو اسم العميل..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            autoFocus
          />
          {searchLoading && <p className="text-xs text-gray-400 mt-1">جاري البحث...</p>}
          {searchResults.length > 0 && (
            <div className="border border-purple-200 rounded-xl overflow-hidden mt-2 bg-white">
              {searchResults.map(inv => (
                <button key={inv._id} onClick={() => onLoadForEdit(inv)}
                  className="w-full text-right px-4 py-3 hover:bg-purple-50 border-b border-purple-100 last:border-0 transition-colors"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-blue-600 text-sm font-medium">{inv.invoiceNumber}</span>
                      <span className="font-medium text-gray-800">{inv.customerName}</span>
                      <span className="text-gray-400 text-xs">{inv.docNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-700">{inv.totalAmount?.toFixed(2)} ج.م</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusLabel[inv.status]?.cls || 'bg-gray-100 text-gray-500'}`}>
                        {statusLabel[inv.status]?.text || inv.status}
                      </span>
                      <span className="text-xs text-purple-600 font-medium">تعديل ←</span>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                    <span>{new Date(inv.date).toLocaleDateString('ar-EG')}</span>
                    <span>{inv.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر'}</span>
                    {inv.season?.name && <span>الموسم: {inv.season.name}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchQuery && !searchLoading && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">مفيش نتائج</p>
          )}
        </div>
      )}
    </div>
  );
}
