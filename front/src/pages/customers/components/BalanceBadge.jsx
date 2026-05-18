import { toNum } from '../../../utils/fmt';
// ─── components/BalanceBadge.jsx ────────────────────────────────────────────
// Badge لعرض الرصيد المستحق — أحمر لو في رصيد، أخضر لو مفيش
// مشترك بين CustomerStatementPage وغيرها
// ────────────────────────────────────────────────────────────────────────────

export default function BalanceBadge({ balance, label, size = 'md' }) {
  const isDebt   = balance > 0;
  const numClass = size === 'lg' ? 'text-4xl' : 'text-3xl';

  return (
    <div className={`text-center px-6 py-3 rounded-xl border-2 ${
      isDebt ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
    }`}>
      <p className={`text-xs font-medium mb-1 ${isDebt ? 'text-red-600' : 'text-green-600'}`}>
        {label}
      </p>
      <p className={`${numClass} font-bold ${isDebt ? 'text-red-700' : 'text-green-700'}`}>
        {Math.abs(toNum(balance)).toFixed(2)}
      </p>
      <p className={`text-xs ${isDebt ? 'text-red-400' : 'text-green-400'}`}>ج.م</p>
    </div>
  );
}
