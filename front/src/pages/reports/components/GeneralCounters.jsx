// ─── pages/reports/components/GeneralCounters.jsx ────────────────────────────
import React from 'react';

export function GeneralCounters({ totalCustomers, totalItems }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="card text-center">
        <span className="text-3xl">👥</span>
        <p className="text-3xl font-bold text-gray-700 mt-2">{totalCustomers}</p>
        <p className="text-sm text-gray-400">عميل نشط</p>
      </div>
      <div className="card text-center">
        <span className="text-3xl">📦</span>
        <p className="text-3xl font-bold text-gray-700 mt-2">{totalItems}</p>
        <p className="text-sm text-gray-400">صنف نشط</p>
      </div>
    </div>
  );
}
