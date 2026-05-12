// ─── pages/items/components/ItemsTable.jsx ────────────────────────────────────
import { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';

const fmt = (n) => (n || 0).toLocaleString('eg-EG', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function ItemRow({ item, isAdmin, onEdit, onDelete }) {
  const navigate = useNavigate();
  const ramQty = item.stock?.ramses?.quantity  ?? 0;
  const ramWgt = item.stock?.ramses?.weight    ?? 0;
  const octQty = item.stock?.october?.quantity ?? 0;
  const octWgt = item.stock?.october?.weight   ?? 0;

  const goToMovements = () =>
    navigate(`/items/movements?itemId=${item._id}&itemCode=${encodeURIComponent(item.code)}&itemName=${encodeURIComponent(item.name)}&itemUnit=${encodeURIComponent(item.unit)}&warehouse=october`);

  return (
    <tr className="hover:bg-blue-50/40 transition-colors group">
      {/* الكود */}
      <td className="px-4 py-3">
        <span className="font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-sm">
          {item.code}
        </span>
      </td>

      {/* الاسم */}
      <td className="px-4 py-3">
        <span className="font-medium text-gray-800">{item.name}</span>
        {item.notes && (
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{item.notes}</p>
        )}
      </td>

      {/* التصنيف */}
      <td className="px-4 py-3">
        {item.category ? (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.category}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* الوحدة */}
      <td className="px-4 py-3 text-gray-500 text-sm">{item.unit}</td>

      {/* رمسيس */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className={`font-bold text-sm ${ramQty > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
            {ramQty.toLocaleString()} <span className="font-normal text-xs text-gray-400">كرتون</span>
          </span>
          <span className="text-xs text-gray-400">{fmt(ramWgt)} ك</span>
        </div>
      </td>

      {/* أكتوبر */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className={`font-bold text-sm ${octQty > 0 ? 'text-purple-700' : 'text-gray-400'}`}>
            {octQty.toLocaleString()} <span className="font-normal text-xs text-gray-400">كرتون</span>
          </span>
          <span className="text-xs text-gray-400">{fmt(octWgt)} ك</span>
        </div>
      </td>

      {/* الإجمالي */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className={`font-bold text-sm ${(ramQty + octQty) > 0 ? 'text-green-700' : 'text-gray-400'}`}>
            {(ramQty + octQty).toLocaleString()} <span className="font-normal text-xs text-gray-400">كرتون</span>
          </span>
          <span className="text-xs text-gray-400">{fmt(ramWgt + octWgt)} ك</span>
        </div>
      </td>

      {/* النوع */}
      <td className="px-4 py-3">
        {item.isRawMaterial ? (
          <span className="bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-full font-medium">خامة</span>
        ) : (
          <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">منتج</span>
        )}
      </td>

      {/* الإجراءات — دايماً ظاهر مش بس الأدمن */}
      <td className="px-4 py-3">
        <div className="flex gap-1.5 items-center flex-wrap">
          {/* كشف الحركة — متاح للكل */}
          <button
            onClick={goToMovements}
            title="كشف حركة الصنف"
            className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded-lg font-medium transition-colors border border-emerald-200"
          >
            📊 حركة
          </button>

          {/* تعديل + حذف — للأدمن بس */}
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(item)}
                className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium transition-colors border border-blue-200"
              >
                تعديل
              </button>
              <button
                onClick={() => onDelete(item._id)}
                className="text-xs bg-red-50 text-red-500 hover:bg-red-100 px-2.5 py-1 rounded-lg font-medium transition-colors border border-red-200"
              >
                حذف
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

const ItemsTable = forwardRef(function ItemsTable(
  { items, isAdmin, onEdit, onDelete, loadingMore, hasMore },
  sentinelRef
) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-l from-gray-50 to-blue-50/40 text-gray-600 border-b border-gray-200">
              <th className="text-right px-4 py-3.5 font-semibold">الكود</th>
              <th className="text-right px-4 py-3.5 font-semibold">الاسم</th>
              <th className="text-right px-4 py-3.5 font-semibold">التصنيف</th>
              <th className="text-right px-4 py-3.5 font-semibold">الوحدة</th>
              <th className="text-right px-4 py-3.5 font-semibold">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />
                  رمسيس
                </span>
              </th>
              <th className="text-right px-4 py-3.5 font-semibold">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-purple-500 rounded-full inline-block" />
                  أكتوبر
                </span>
              </th>
              <th className="text-right px-4 py-3.5 font-semibold">الإجمالي</th>
              <th className="text-right px-4 py-3.5 font-semibold">النوع</th>
              <th className="text-right px-4 py-3.5 font-semibold">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <ItemRow
                key={item._id}
                item={item}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Sentinel للـ infinite scroll */}
      <div ref={sentinelRef} className="h-4" />

      {loadingMore && (
        <div className="flex items-center justify-center gap-2 py-4 text-blue-600 text-sm border-t border-gray-100">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          جاري تحميل المزيد...
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="text-center py-3 text-xs text-gray-400 border-t border-gray-100">
          ✓ تم عرض جميع الأصناف ({items.length.toLocaleString()} صنف)
        </div>
      )}
    </div>
  );
});

export default ItemsTable;
