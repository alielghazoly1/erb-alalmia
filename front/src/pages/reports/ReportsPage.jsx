// ─── pages/reports/ReportsPage.jsx ────────────────────────────────────────────
import React from 'react';

import { useReportStats }     from './hooks/useReportStats';
import { StatsHeader }        from './components/StatsHeader';
import { ProfitCards }        from './components/ProfitCards';
import { CollectionPanel }    from './components/CollectionPanel';
import { PendingBadges }      from './components/PendingBadges';
import { GeneralCounters }    from './components/GeneralCounters';
import { StatsLoadingState }  from './components/StatsLoadingState';
import { PrintHeader }        from './components/PrintHeader';

export default function ReportsPage() {
  const { stats, loading, refresh } = useReportStats();

  // ── loading: skeleton بدل spinner بسيط ──────────────────────────────────
  if (loading && !stats) {
    return <StatsLoadingState />;
  }

  return (
    <div>
      {/* رأس الصفحة */}
      <StatsHeader
        season={stats?.season}
        onRefresh={refresh}
        loading={loading}
      />

      {/* رأس الطباعة */}
      <PrintHeader title="تقرير الإحصائيات" />

      {stats && (
        <div className="space-y-5">
          {/* بطاقات المبيعات / التوريد / الأرباح */}
          <ProfitCards stats={stats} />

          {/* التحصيل والمديونيات */}
          <CollectionPanel stats={stats} />

          {/* في الانتظار (يظهر فقط لو فيه pending) */}
          <PendingBadges pending={stats.pending} />

          {/* عدد العملاء والأصناف */}
          <GeneralCounters
            totalCustomers={stats.totalCustomers}
            totalItems={stats.totalItems}
          />
        </div>
      )}

      {/* حالة خطأ */}
      {!loading && !stats && (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="font-medium">لم يتم تحميل البيانات</p>
          <button className="btn-secondary mt-4" onClick={refresh}>
            حاول مرة أخرى
          </button>
        </div>
      )}
    </div>
  );
}
