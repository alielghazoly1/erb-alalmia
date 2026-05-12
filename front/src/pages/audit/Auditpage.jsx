import React, { useState } from 'react';
import { useAuditFilters } from './hooks/useAuditFilters';
import { useAuditData }    from './hooks/useAuditData';
import AuditSummaryCards   from './components/AuditSummaryCards';
import AuditFilters        from './components/AuditFilters';
import AuditTable          from './components/AuditTable';
import AuditPagination     from './components/AuditPagination';

export default function AuditPage() {
  const [showSummary, setShowSummary] = useState(true);

  const filters = useAuditFilters();
  const {
    userId, action, dateFrom, dateTo, showAll, page,
    setUserId, setAction, setDateFrom, setDateTo, setShowAll, setPage, setQuick,
  } = filters;

  const { logs, total, totalPages, loading, summary, users, refreshSummary } =
    useAuditData({ userId, action, dateFrom, dateTo, showAll, page });

  const handleRefresh = () => refreshSummary();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📋 سجل التدقيق</h1>
          <p className="text-gray-500 text-sm mt-1">كل العمليات المسجلة على النظام</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSummary((v) => !v)}
            className="btn-secondary text-sm"
          >
            {showSummary ? '▲ إخفاء الملخص' : '▼ عرض الملخص'}
          </button>
          <button onClick={handleRefresh} className="btn-secondary text-sm">
            🔄 تحديث
          </button>
        </div>
      </div>

      {/* Summary */}
      {showSummary && <AuditSummaryCards summary={summary} />}

      {/* Filters */}
      <AuditFilters
        users={users}
        userId={userId} action={action}
        dateFrom={dateFrom} dateTo={dateTo} showAll={showAll}
        total={total}
        setUserId={setUserId} setAction={setAction}
        setDateFrom={setDateFrom} setDateTo={setDateTo}
        setShowAll={setShowAll} setQuick={setQuick}
      />

      {/* Table */}
      <AuditTable logs={logs} loading={loading} page={page} />

      {/* Pagination */}
      <AuditPagination
        page={page} totalPages={totalPages} total={total}
        setPage={setPage}
      />
    </div>
  );
}
