// ─── pages/purchase/components/PurchaseLoadingSpinner.jsx ────────────────────
import React from 'react';

export default function PurchaseLoadingSpinner({ fullPage = false }) {
  if (fullPage) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm">جاري تحميل الفواتير...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-5 text-gray-400 text-sm">
      <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      <span>جاري تحميل المزيد...</span>
    </div>
  );
}
