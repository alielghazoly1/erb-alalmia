import React from 'react';
import { fmt } from '../cashRegisterConfig';
import DateFilter from './DateFilter';
import MovementsTable from './MovementsTable';

const STAT_CARDS = (adminData) => [
  { label: 'إجمالي الوارد', value: adminData.totalIn,  bg: 'bg-green-50 border-green-200',  color: 'text-green-700' },
  { label: 'مرتجعات (خصم)', value: adminData.totalOut, bg: 'bg-red-50 border-red-200',    color: 'text-red-600' },
  { label: 'الصافي',          value: adminData.net,     bg: 'bg-blue-50 border-blue-200',   color: adminData.net >= 0 ? 'text-blue-700' : 'text-red-600' },
];

export default function AdminTab({
  admins, adminData, loading,
  selectedId, showAll, dateFrom, dateTo,
  setSelectedId, setShowAll, setDateFrom, setDateTo, setQuick,
}) {
  const selectedAdmin = admins.find((a) => a._id === selectedId);

  return (
    <div className="space-y-4">
      {/* Filters card */}
      <div className="card space-y-4">
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">الأدمن</label>
            <select
              className="input-field w-56"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">— اختار أدمن —</option>
              {admins.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({a.username})
                </option>
              ))}
            </select>
          </div>
        </div>
        <DateFilter
          showAll={showAll} dateFrom={dateFrom} dateTo={dateTo}
          onShowAll={setShowAll} onFrom={setDateFrom} onTo={setDateTo} onQuick={setQuick}
        />
      </div>

      {/* States */}
      {!selectedId ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">👤</p>
          <p className="text-lg font-medium text-gray-500">اختار أدمن لعرض خزنته</p>
        </div>
      ) : loading ? (
        <div className="card text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : adminData ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {STAT_CARDS(adminData).map((c, i) => (
              <div key={i} className={`card border ${c.bg} text-center`}>
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{fmt(c.value)}</p>
                <p className="text-xs text-gray-400">ج.م</p>
              </div>
            ))}
          </div>

          {/* Movements table */}
          <div className="card">
            <div className="flex items-center justify-between mb-3 pb-2 border-b">
              <h3 className="font-semibold text-gray-700">
                خزنة: <span className="text-blue-600">{selectedAdmin?.name}</span>
              </h3>
              <span className="text-xs text-gray-400">{adminData.count} حركة</span>
            </div>
            <MovementsTable movements={adminData.movements} emptyMsg="مفيش حركات نقدية في هذه الفترة" />
          </div>
        </>
      ) : null}
    </div>
  );
}
