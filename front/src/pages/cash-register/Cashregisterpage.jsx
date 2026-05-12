import React from 'react';
import { TABS } from './cashRegisterConfig';
import { useCashRegisterFilters } from './hooks/useCashRegisterFilters';
import { useCashRegisterData }    from './hooks/useCashRegisterData';
import SummaryTab from './components/SummaryTab';
import AdminTab   from './components/AdminTab';
import BankTab    from './components/BankTab';

export default function CashRegisterPage() {
  const {
    tab, dateFrom, dateTo, showAll, summaryDate, selectedId, bankMethod,
    effectiveFrom, effectiveTo,
    setTab, setDateFrom, setDateTo, setShowAll, setSummaryDate,
    setSelectedId, setBankMethod, setQuick, openAdminOnDate,
  } = useCashRegisterFilters();

  const { admins, adminData, bankData, summary, loading } = useCashRegisterData({
    tab, selectedId, effectiveFrom, effectiveTo, summaryDate, bankMethod,
  });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">💵 الخزنة</h1>
        <p className="text-gray-500 text-sm mt-1">متابعة كل الحركات المالية — نقدي وبنكي</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white shadow text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <SummaryTab
          summary={summary}
          loading={loading}
          summaryDate={summaryDate}
          setSummaryDate={setSummaryDate}
          setTab={setTab}
          openAdminOnDate={openAdminOnDate}
        />
      )}

      {tab === 'admin' && (
        <AdminTab
          admins={admins}
          adminData={adminData}
          loading={loading}
          selectedId={selectedId}
          showAll={showAll}
          dateFrom={dateFrom}
          dateTo={dateTo}
          setSelectedId={setSelectedId}
          setShowAll={setShowAll}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          setQuick={setQuick}
        />
      )}

      {tab === 'bank' && (
        <BankTab
          bankData={bankData}
          loading={loading}
          bankMethod={bankMethod}
          showAll={showAll}
          dateFrom={dateFrom}
          dateTo={dateTo}
          setBankMethod={setBankMethod}
          setShowAll={setShowAll}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          setQuick={setQuick}
        />
      )}
    </div>
  );
}
