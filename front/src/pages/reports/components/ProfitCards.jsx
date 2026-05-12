// ─── pages/reports/components/ProfitCards.jsx ────────────────────────────────
import React from 'react';

function MetaRow({ label, value, color = 'text-gray-500', prefix = '' }) {
  return (
    <div className="flex justify-between text-xs">
      <span className={color}>{label}</span>
      <span className={`font-medium ${color}`}>{prefix}{value}</span>
    </div>
  );
}

export function ProfitCards({ stats }) {
  const { netSales, totalSales, customerReturns, salesCount,
          netPurchases, totalPurchases, supplierReturns, purchasesCount,
          grossProfit, profitMargin } = stats;

  const cards = [
    {
      label:  'صافي المبيعات',
      value:  netSales,
      color:  'text-green-700',
      border: 'border-green-500',
      icon:   '🧾',
      sub: [
        { label: 'إجمالي المبيعات',    value: totalSales?.toFixed(2) },
        { label: 'مرتجعات العملاء',   value: `- ${customerReturns?.toFixed(2)}`, color: 'text-orange-500' },
        { label: 'عدد الفواتير',       value: salesCount, color: 'text-gray-400' },
      ],
    },
    {
      label:  'صافي التوريد',
      value:  netPurchases,
      color:  'text-blue-700',
      border: 'border-blue-500',
      icon:   '🚚',
      sub: [
        { label: 'إجمالي التوريد',     value: totalPurchases?.toFixed(2) },
        { label: 'مرتجعات الموردين',  value: `- ${supplierReturns?.toFixed(2)}`, color: 'text-orange-500' },
        { label: 'عدد الفواتير',       value: purchasesCount, color: 'text-gray-400' },
      ],
    },
    {
      label:  'إجمالي الأرباح',
      value:  grossProfit,
      color:  grossProfit >= 0 ? 'text-purple-700' : 'text-red-700',
      border: grossProfit >= 0 ? 'border-purple-500' : 'border-red-500',
      icon:   grossProfit >= 0 ? '📈' : '📉',
      sub: [
        { label: 'هامش الربح', value: `${profitMargin}%`,
          color: grossProfit >= 0 ? 'text-purple-600 font-bold text-sm' : 'text-red-600 font-bold text-sm' },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c, i) => (
        <div key={i} className={`card border-r-4 ${c.border}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{c.label}</p>
              <p className={`text-3xl font-bold ${c.color}`}>{c.value?.toFixed(0)}</p>
              <p className="text-xs text-gray-400 mt-1">ج.م</p>
            </div>
            <span className="text-3xl">{c.icon}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
            {c.sub.map((s, j) => (
              <MetaRow key={j} label={s.label} value={s.value} color={s.color} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
