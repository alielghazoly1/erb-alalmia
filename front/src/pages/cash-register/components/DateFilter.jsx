import React from 'react';

const QUICK = ['اليوم', 'أمس', 'الشهر'];

export default function DateFilter({ showAll, dateFrom, dateTo, onShowAll, onFrom, onTo, onQuick }) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          className="w-4 h-4 rounded"
          checked={showAll}
          onChange={(e) => onShowAll(e.target.checked)}
        />
        كل التواريخ
      </label>

      {!showAll && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">من</span>
            <input
              type="date"
              className="input-field py-1.5 text-sm w-40"
              value={dateFrom}
              onChange={(e) => onFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">إلى</span>
            <input
              type="date"
              className="input-field py-1.5 text-sm w-40"
              value={dateTo}
              onChange={(e) => onTo(e.target.value)}
            />
          </div>
          {QUICK.map((l) => (
            <button
              key={l}
              onClick={() => onQuick(l)}
              className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
            >
              {l}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
