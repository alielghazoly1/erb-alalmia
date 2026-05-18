// ─── components/BankTab.jsx ───────────────────────────────────────────────────
import React from 'react';
import { fmt, METHOD_LABEL } from '../cashRegisterConfig';
import DateFilter    from './DateFilter';
import MovementsTable from './MovementsTable';

const METHOD_OPTIONS = [
  { value: '',          label: 'الكل' },
  { value: 'instapay',  label: 'انستاباي' },
  { value: 'transfer',  label: 'تحويل بنكي' },
  { value: 'check',     label: 'شيك' },
];

const STAT_CARDS = (bankData) => [
  { label: 'إجمالي الوارد', value: bankData.totalIn,  bg: 'bg-blue-50 border-blue-200',   color: 'text-blue-700' },
  { label: 'المرتجعات',      value: bankData.totalOut, bg: 'bg-red-50 border-red-200',     color: 'text-red-600' },
  { label: 'الصافي',          value: bankData.net,     bg: 'bg-green-50 border-green-200', color: bankData.net >= 0 ? 'text-green-700' : 'text-red-600' },
];

export default function BankTab({
  bankData,
  loading,
  loadingMore,
  bankMethod,
  showAll,
  dateFrom,
  dateTo,
  setBankMethod,
  setShowAll,
  setDateFrom,
  setDateTo,
  setQuick,
  onLoadMore,
}) {
  return (
    <div className="space-y-4">
      {/* Filters card */}
      <div className="card space-y-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">طريقة الدفع</label>
            <select
              className="input-field w-44"
              value={bankMethod}
              onChange={(e) => setBankMethod(e.target.value)}
            >
              {METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <DateFilter
          showAll={showAll}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onShowAll={setShowAll}
          onFrom={setDateFrom}
          onTo={setDateTo}
          onQuick={setQuick}
        />
      </div>

      {/* States */}
      {loading ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="animate-spin text-3xl mb-2">⏳</div>
          جاري التحميل...
        </div>
      ) : bankData ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STAT_CARDS(bankData).map((c, i) => (
              <div key={i} className={`card border ${c.bg} text-center`}>
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{fmt(c.value)}</p>
                <p className="text-xs text-gray-400">ج.م</p>
              </div>
            ))}

            {/* By method breakdown */}
            <div className="card bg-gray-50 border border-gray-200">
              <p className="text-xs text-gray-400 mb-2 font-medium">تفاصيل حسب الطريقة</p>
              <div className="space-y-1.5">
                {Object.entries(bankData.byMethod || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">{METHOD_LABEL[k] || k}</span>
                    <span className={`font-bold ${v.in - v.out >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                      {fmt(v.in - v.out)} ج.م
                    </span>
                  </div>
                ))}
                {!Object.keys(bankData.byMethod || {}).length && (
                  <p className="text-gray-300 text-center">—</p>
                )}
              </div>
            </div>
          </div>

          {/* Movements table */}
          <div className="card">
            <div className="flex items-center justify-between mb-3 pb-2 border-b">
              <h3 className="font-semibold text-gray-700">🏦 حركات خزنة البنك</h3>
              <span className="text-xs text-gray-400">
                {bankData.count?.toLocaleString('ar-EG')} حركة
                {bankData.hasMore && (
                  <span className="text-orange-500 mr-1">
                    — عارض {bankData.movements?.length?.toLocaleString('ar-EG')}
                  </span>
                )}
              </span>
            </div>

            <MovementsTable
              movements={bankData.movements}
              emptyMsg="مفيش حركات بنكية في هذه الفترة"
              totalIn={bankData.totalIn}
              totalOut={bankData.totalOut}
              net={bankData.net}
              hasMore={bankData.hasMore}
              loadingMore={loadingMore}
              onLoadMore={onLoadMore}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
