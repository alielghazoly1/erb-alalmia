// ─── components/WeightSummary.jsx ────────────────────────────────────────────
//  ملخص الأوزان (خامات ↔ منتجات ↔ فرق)
// ─────────────────────────────────────────────────────────────────────────────
import { fmtW } from '../hooks/useManufacturingItems';

export default function WeightSummary({ rawTotal, outTotal }) {
  const diff  = outTotal - rawTotal;
  const maxW  = Math.max(rawTotal, outTotal, 0.001);
  const rawPct = (rawTotal / maxW) * 100;
  const outPct = (outTotal / maxW) * 100;

  const diffColor =
    Math.abs(diff) < 0.001 ? 'text-gray-400'
    : diff > 0              ? 'text-red-400'
                            : 'text-green-400';
  const diffLabel =
    diff > 0 ? 'هالك' : diff < 0 ? 'زيادة' : 'متوازن';

  return (
    <div className="card bg-gray-800 text-white">

      {/* الأرقام */}
      <div className="grid grid-cols-3 gap-4 text-center mb-4">
        <div>
          <p className="text-gray-400 text-xs mb-1">وزن الخامات</p>
          <p className="text-2xl font-bold text-orange-400">{fmtW(rawTotal)} ك</p>
        </div>
        <div className="border-x border-gray-600 flex items-center justify-center">
          <div>
            <p className="text-gray-400 text-xs mb-1">الفرق</p>
            <p className={`text-2xl font-bold ${diffColor}`}>
              {diff >= 0 ? '+' : ''}{fmtW(diff)} ك
            </p>
            <p className="text-xs text-gray-500">{diffLabel}</p>
          </div>
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-1">وزن المنتجات</p>
          <p className="text-2xl font-bold text-green-400">{fmtW(outTotal)} ك</p>
        </div>
      </div>

      {/* Progress bars */}
      {(rawTotal > 0 || outTotal > 0) && (
        <div className="space-y-2">
          {[
            { label: '📤 خامات',  val: rawTotal, pct: rawPct,  color: 'bg-orange-400' },
            { label: '📦 منتجات', val: outTotal, pct: outPct,  color: 'bg-green-400'  },
          ].map(({ label, val, pct, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{label}</span>
                <span>{fmtW(val)} ك</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
