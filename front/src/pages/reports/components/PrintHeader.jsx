// ─── pages/reports/components/PrintHeader.jsx ────────────────────────────────
import React from 'react';

export function PrintHeader({ title }) {
  return (
    <div className="hidden print:block text-center mb-6">
      <h1 className="text-2xl font-bold">الشركة العالمية للاستيراد والتصدير</h1>
      <h2 className="text-lg mt-1">{title}</h2>
      <p className="text-sm text-gray-500">
        {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      <div className="border-b-2 border-gray-800 mt-3" />
    </div>
  );
}
