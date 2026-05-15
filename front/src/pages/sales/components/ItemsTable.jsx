import { calcTotalWeight } from '../hooks/useSaleInvoiceForm';
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

export default function ItemsTable({ savedRows, totalAmount, totalWeightAll, onEditRow, onDeleteRow }) {
  if (savedRows.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
        الأصناف ({savedRows.length})
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs">
              {['#','الكود','الصنف','العدد','وزن/وحدة','وزن كلي','السعر/ك','الإجمالي',''].map((h,i) => (
                <th key={i} className={`px-2 py-2 text-center`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {savedRows.map((row, idx) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-2 py-2 text-gray-400 text-center text-xs">{idx + 1}</td>
                <td className="px-2 py-2 font-mono text-black text-xs">{row.itemCode}</td>
                <td className="px-2 py-2 font-medium text-gray-800 text-sm">{row.itemName}</td>
                <td className="px-2 py-2 text-center font-medium">{row.quantity}</td>
                <td className="px-2 py-2 text-center text-gray-400 text-xs">{parseFloat(row.weight).toFixed(3)}</td>
                <td className="px-2 py-2 text-center font-medium">
                  { (row._totalWeight ?? r3((parseFloat(row.quantity)||0)*(parseFloat(row.weight)||0))).toFixed(3) } ك
                </td>
                <td className="px-2 py-2 text-center">{parseFloat(row.price).toFixed(2)}</td>
                <td className="px-2 py-2 text-center font-semibold">
                  { (() => { const tw = row._totalWeight ?? r3((parseFloat(row.quantity)||0)*(parseFloat(row.weight)||0)); return r2(tw * (parseFloat(row.price)||0)).toFixed(2); })() }
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEditRow(row.id)} className="text-blue-500 text-xs p-1 rounded hover:bg-blue-50" title="تعديل">✏️</button>
                    <button onClick={() => onDeleteRow(row.id)} className="text-red-400 text-xs p-1 rounded hover:bg-red-50" title="حذف">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 font-semibold text-xs">
              <td colSpan={5} className="px-2 py-2 text-right text-gray-600">الإجمالي</td>
              <td className="px-2 py-2 text-center text-blue-700">{totalWeightAll.toFixed(3)} ك</td>
              <td></td>
              <td className="px-2 py-2 text-center text-blue-700">{totalAmount.toFixed(2)} ج.م</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
