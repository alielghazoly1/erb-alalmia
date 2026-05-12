// ─── components/WorkerCardsBar.jsx ───────────────────────────────────────────
//  بطاقات المعلمين — بيحسب الإجماليات من الأوامر المحملة
// ─────────────────────────────────────────────────────────────────────────────
import { fmt, sumWeight } from '../manufacturingConfig';

export default function WorkerCardsBar({ workers, orders, onWorkerClick }) {
  if (workers.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        معلمو العنابر
      </p>
      <div className="flex gap-3 flex-wrap">
        {workers.map(w => {
          const wOrders    = orders.filter(
            o => (o.worker?._id || o.worker)?.toString() === w._id.toString(),
          );
          const approved   = wOrders.filter(o => o.status === 'approved');
          const outWt      = approved.reduce((s, o) => s + sumWeight(o.outputProducts), 0);
          const pendingCnt = wOrders.filter(o => o.status === 'pending').length;

          return (
            <button
              key={w._id}
              onClick={() => onWorkerClick(w)}
              className="card hover:shadow-md transition-all cursor-pointer text-right border-2 border-transparent hover:border-amber-300 min-w-44"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {w.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{w.name}</p>
                  <p className="text-xs text-gray-400">{wOrders.length} أمر</p>
                </div>
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>منتجات:</span>
                <span className="font-bold text-green-600">{fmt(outWt, 1)} ك</span>
              </div>

              {pendingCnt > 0 && (
                <div className="mt-1.5 text-xs text-amber-600 bg-amber-50 rounded px-2 py-0.5 text-center">
                  {pendingCnt} معلق
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
