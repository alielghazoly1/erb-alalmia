import { calcTotalWeight, fmtW } from '../hooks/useManufacturingItems';

// أقصى 4 خانات عشرية للعرض
const fmt4 = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || Math.abs(n) < 1e-10) return '0';
  return parseFloat(n.toFixed(4)).toString();
};

export default function MfgItemsTable({ savedRows, totalWeightAll, onEditRow, onDeleteRow }) {
  if (savedRows.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
        الأصناف ({savedRows.length})
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs">
              {['#', 'الكود', 'الصنف', 'العدد', 'وزن/وحدة', 'الوزن الكلي (ك)', ''].map((h, i) => (
                <th
                  key={i}
                  className={`px-2 py-2 ${i > 2 ? 'text-center' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {savedRows.map((row, idx) => {
              const uw  = parseFloat(row.unitWeight) || 0;
              const tw  = calcTotalWeight(row);
              // ✅ ARCH-001: العدد مشتق — أقصى 4 خانات
              const qty = uw > 0 && tw > 0 ? fmt4(tw / uw) : (row.quantity || '—');
              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2 text-gray-400 text-center text-xs">{idx + 1}</td>
                  <td className="px-2 py-2 font-mono text-blue-600 text-xs">{row.itemCode}</td>
                  <td className="px-2 py-2 font-medium text-gray-800">{row.itemName}</td>
                  <td className="px-2 py-2 text-center text-gray-600 text-xs">{qty}</td>
                  <td className="px-2 py-2 text-center text-gray-400 text-xs">
                    {fmtW(uw)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="font-semibold text-green-700">
                      {fmtW(tw)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditRow(row.id)}
                        className="text-blue-500 text-xs p-1 rounded hover:bg-blue-50"
                        title="تعديل"
                      >✏️</button>
                      <button
                        onClick={() => onDeleteRow(row.id)}
                        className="text-red-400 text-xs p-1 rounded hover:bg-red-50"
                        title="حذف"
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="bg-green-50 font-semibold text-xs">
              <td colSpan={5} className="px-2 py-2 text-right text-gray-600">الإجمالي</td>
              <td className="px-2 py-2 text-center text-green-700">{fmtW(totalWeightAll)} ك</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
