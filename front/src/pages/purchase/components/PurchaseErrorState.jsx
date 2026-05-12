// ─── pages/purchase/components/PurchaseErrorState.jsx ────────────────────────
import React from 'react';

export default function PurchaseErrorState({ message, onRetry }) {
  return (
    <div className="card">
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <span className="text-5xl">⚠️</span>
        <div>
          <p className="font-semibold text-red-600 mb-1">حدث خطأ في التحميل</p>
          <p className="text-sm text-gray-500">
            {message || 'تعذّر الاتصال بالسيرفر. تحقق من اتصالك وحاول مرة أخرى.'}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
