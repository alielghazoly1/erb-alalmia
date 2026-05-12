// ─── pages/purchase/components/PurchaseHeader.jsx ────────────────────────────
import React from 'react';
import { Link } from 'react-router-dom';

export default function PurchaseHeader({ count, total, filters }) {
  const { showAllDates, dateFrom, dateTo } = filters;
  const dateLabel = showAllDates
    ? 'كل التواريخ'
    : dateFrom === dateTo
    ? dateFrom
    : `${dateFrom} → ${dateTo}`;

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">فواتير التوريد</h1>
       <p className="text-sm text-gray-400 mt-0.5">
  {typeof total === 'number'
    ? `${total.toLocaleString('ar-EG')} فاتورة`
    : count > 0
    ? `${count.toLocaleString('ar-EG')}+ فاتورة محملة`
    : ''}
  {' • '}
  {dateLabel}
</p>
      </div>
      <Link to="/purchase/new" className="btn-primary">
        + فاتورة جديدة
      </Link>
    </div>
  );
}
