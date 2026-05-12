// ─── components/SummaryTables.jsx ────────────────────────────────────────────
//  جداول ملخص المنتجات الناتجة والخامات المصروفة
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n, d = 2) => Number(n || 0).toFixed(d);

// ─── Generic table ────────────────────────────────────────────────────────────
function ItemTable({ title, icon, rows, totalWeight, colorCls, hoverCls, footerCls }) {
  if (!rows?.length) return null;

  return (
    <div className="card card-no-break">
      <h3 className={`font-semibold mb-3 flex items-center gap-2 ${colorCls}`}>
        {icon} {title}
        <span className="text-sm font-bold text-gray-800">({rows.length} صنف)</span>
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b">
              <th className="text-right  pb-2 font-medium">الصنف</th>
              <th className="text-center pb-2 font-medium">الكراتين</th>
              <th className="text-center pb-2 font-medium">الوزن الكلي</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => (
              <tr key={i} className={`${hoverCls} transition-colors`}>
                <td className="py-2 font-semibold text-gray-800">{row.itemName}</td>
                <td className="py-2 text-center text-gray-700">{fmt(row.totalQty, 0)}</td>
                <td className={`py-2 text-center font-bold ${colorCls}`}>{fmt(row.totalWeight, 2)} ك</td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className={`${footerCls} text-xs font-semibold`}>
              <td className="pt-2.5 font-bold text-gray-800">الإجمالي</td>
              <td />
              <td className={`pt-2.5 text-center font-bold ${colorCls}`}>{fmt(totalWeight, 2)} ك</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SummaryTables({ summary }) {
  if (!summary) return null;
  const { products, rawMaterials, totalOutputWeight, totalRawWeight } = summary;
  if (!products?.length && !rawMaterials?.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
      <ItemTable
        title="ملخص المنتجات الناتجة"
        icon="📦"
        rows={products}
        totalWeight={totalOutputWeight}
        colorCls="text-green-700"
        hoverCls="hover:bg-green-50/50"
        footerCls="bg-green-50"
      />
      <ItemTable
        title="ملخص الخامات المصروفة"
        icon="📤"
        rows={rawMaterials}
        totalWeight={totalRawWeight}
        colorCls="text-orange-700"
        hoverCls="hover:bg-orange-50/50"
        footerCls="bg-orange-50"
      />
    </div>
  );
}
