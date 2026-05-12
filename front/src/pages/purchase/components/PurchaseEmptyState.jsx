// ─── pages/purchase/components/PurchaseEmptyState.jsx ────────────────────────
import React from 'react';

export default function PurchaseEmptyState({ showAllDates, onShowAll }) {
  return (
    <div className="card">
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
        <span className="text-5xl">📭</span>
        <p className="font-medium text-gray-500">
          مفيش فواتير{!showAllDates ? ' في هذه الفترة' : ''}
        </p>
        {!showAllDates && (
          <button
            onClick={onShowAll}
            className="text-sm text-blue-600 hover:underline"
          >
            عرض كل التواريخ
          </button>
        )}
      </div>
    </div>
  );
}
