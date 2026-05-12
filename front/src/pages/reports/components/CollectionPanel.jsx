// ─── pages/reports/components/CollectionPanel.jsx ────────────────────────────
import React from 'react';

export function CollectionPanel({ stats }) {
  const {
    cashSalesTotal, cashSalesCount,
    creditSales, creditSalesCount,
    collected, outstanding,
    totalCollectedAll,
  } = stats;

  const collectionRate = creditSales > 0
    ? Math.min(((collected || 0) / creditSales) * 100, 100)
    : 100;

  return (
    <div className="card">
      <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <span>💳</span> التحصيل والمديونيات
      </h3>

      {/* نقدي vs آجل */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs text-green-600 mb-0.5">💵 مبيعات نقدي</p>
          <p className="text-xl font-bold text-green-700">{(cashSalesTotal || 0).toFixed(2)}</p>
          <p className="text-xs text-green-400">{cashSalesCount || 0} فاتورة</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs text-blue-600 mb-0.5">📋 مبيعات آجل</p>
          <p className="text-xl font-bold text-blue-700">{(creditSales || 0).toFixed(2)}</p>
          <p className="text-xs text-blue-400">{creditSalesCount || 0} فاتورة</p>
        </div>
      </div>

      {/* تحصيل الآجل */}
      <div className="border-t pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          تحصيل الآجل
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* محصّل */}
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-xs text-green-600 mb-1">تم التحصيل (دفعات)</p>
            <p className="text-2xl font-bold text-green-700">{(collected || 0).toFixed(2)}</p>
            <p className="text-xs text-green-400">ج.م</p>
          </div>

          {/* مستحق */}
          <div className={`rounded-xl p-4 ${outstanding > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <p className={`text-xs mb-1 ${outstanding > 0 ? 'text-red-600' : 'text-gray-500'}`}>
              {outstanding > 0 ? '⚠️ مستحق من الآجل' : '✅ لا يوجد مستحق'}
            </p>
            <p className={`text-2xl font-bold ${outstanding > 0 ? 'text-red-700' : 'text-gray-500'}`}>
              {(outstanding || 0).toFixed(2)}
            </p>
            <p className="text-xs text-gray-400">ج.م — الآجل فقط</p>
          </div>

          {/* نسبة التحصيل */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">نسبة تحصيل الآجل</p>
            <p className="text-2xl font-bold text-gray-700">{collectionRate.toFixed(1)}%</p>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-700"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* إجمالي الوارد */}
      <div className="mt-4 bg-gray-800 rounded-xl p-4 flex justify-between items-center">
        <div>
          <p className="text-gray-300 text-sm">إجمالي الوارد (نقدي + دفعات آجل)</p>
          <p className="text-gray-400 text-xs mt-0.5">النقدي عند الفاتورة + دفعات العملاء الآجلين</p>
        </div>
        <p className="text-2xl font-bold text-green-400">{(totalCollectedAll || 0).toFixed(2)} ج.م</p>
      </div>
    </div>
  );
}
