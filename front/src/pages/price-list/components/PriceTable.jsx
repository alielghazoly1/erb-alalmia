/**
 * PriceTable — جدول العرض على الشاشة (مع Drag & Drop)
 * التعديل بيفتح EntryFormModal من الصفحة الرئيسية
 */
export default function PriceTable({
  list, priceLabels, isAdmin,
  draggingId,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onEdit, onDelete,
}) {
  return (
    <div className="no-print bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-900 text-white text-xs">
            {isAdmin && <th className="w-8 px-3 py-3 text-center text-gray-400">#</th>}
            <th className="text-right px-4 py-3 font-bold">الصنف</th>
            <th className="text-center px-3 py-3 font-bold w-24">المنشأ</th>
            <th className="text-center px-3 py-3 font-bold w-20">الوحدة</th>
            {priceLabels.map((lbl, i) => (
              <th key={i} className="text-center px-3 py-3 font-bold w-24">{lbl}</th>
            ))}
            <th className="text-center px-3 py-3 font-bold w-32">الأصناف المرتبطة</th>
            {isAdmin && <th className="w-24 px-3 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {list.map((entry, idx) => (
            <tr
              key={entry._id}
              draggable={isAdmin}
              onDragStart={e => onDragStart(e, entry)}
              onDragOver={onDragOver}
              onDrop={e => onDrop(e, entry)}
              onDragEnd={onDragEnd}
              className={`transition-colors ${
                draggingId === entry._id
                  ? 'opacity-40 bg-yellow-50'
                  : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'
              } ${isAdmin ? 'cursor-move' : ''}`}
            >
              {isAdmin && (
                <td className="px-3 py-3 text-center text-gray-400 text-xs select-none font-bold">⋮⋮</td>
              )}

              {/* الاسم + ملاحظات */}
              <td className="px-4 py-3">
                <p className="font-bold text-gray-900 text-sm">{entry.displayName}</p>
                {entry.notes && <p className="text-xs text-gray-400 mt-0.5">{entry.notes}</p>}
              </td>

              <td className="px-3 py-3 text-center text-xs text-gray-600">{entry.origin || '—'}</td>
              <td className="px-3 py-3 text-center text-xs text-gray-600">{entry.unit || '—'}</td>

              {entry.prices?.map((p, i) => (
                <td key={i} className="px-3 py-3 text-center">
                  <span className="font-bold text-gray-900 text-sm">{p.price?.toFixed(2)}</span>
                  <span className="text-xs text-gray-400 mr-0.5">ج</span>
                </td>
              ))}

              {/* الأصناف المرتبطة */}
              <td className="px-3 py-3">
                {entry.linkedItems?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {entry.linkedItems.slice(0, 3).map(li => (
                      <span
                        key={li.itemCode}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono"
                        title={li.itemName}
                      >
                        {li.itemCode}
                      </span>
                    ))}
                    {entry.linkedItems.length > 3 && (
                      <span className="text-xs text-gray-400">+{entry.linkedItems.length - 3}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </td>

              {isAdmin && (
                <td className="px-3 py-3">
                  <div className="flex gap-1.5 justify-center">
                    <button
                      onClick={() => onEdit(entry)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => onDelete(entry._id)}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg font-medium transition-colors"
                    >
                      حذف
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
