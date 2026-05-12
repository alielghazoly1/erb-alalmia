// ─── WorkerStatementPage.jsx ─────────────────────────────────────────────────
//  ✅ كود نظيف — كل المنطق في الـ hook والكمبوننتات
//  ✅ زرارين طباعة: ملخص / كامل مع الأوامر
//  ✅ فلتر موسم — كل موسم كشف مستقل
//  ✅ docNumber بدل orderNumber
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState, useEffect } from 'react';
import { useParams, Link }             from 'react-router-dom';
import api                             from '../../services/api';

import { useWorkerStatement }               from './hooks/useWorkerStatement';
import StatementFilters                     from './components/StatementFilters';
import SummaryCards                         from './components/SummaryCards';
import SummaryTables                        from './components/SummaryTables';
import OrdersTable                          from './components/OrdersTable';
import PrintButtons                         from './components/PrintButtons';
import { PrintSummaryDoc, PrintFullDoc }    from './components/PrintDocuments';

const WH_LABEL = { ramses: 'رمسيس', october: 'أكتوبر', both: 'الاثنين' };

// ─────────────────────────────────────────────────────────────────────────────
export default function WorkerStatementPage() {
  const { id } = useParams();

  // ── seasons لعرض الاسم في الطباعة ────────────────────────────────────────
  const [seasons, setSeasons] = useState([]);
  useEffect(() => {
    api.get('/manufacturing/seasons')
      .then(({ data }) => setSeasons(data))
      .catch(() => {});
  }, []);

  // ── كل منطق الفلاتر + جلب البيانات في الـ hook ───────────────────────────
  const {
    stmtLoading, worker, summary, orders,
    dateFrom,     setDateFrom,
    dateTo,       setDateTo,
    showAll,      setShowAll,
    statusFilter, setStatusFilter,
    seasonId,     setSeasonId,
    applyQuickRange,
  } = useWorkerStatement(id);

  // ── print refs ────────────────────────────────────────────────────────────
  const summaryRef = useRef(null);
  const fullRef    = useRef(null);

  // ── season label ──────────────────────────────────────────────────────────
  const seasonLabel = seasons.find(s => s._id === seasonId)?.name || 'كل المواسم';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">

      {/* ── هيدر ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 no-print">
        <div className="flex items-center gap-3">
          <Link to="/workers" className="text-gray-400 hover:text-gray-600 text-sm">
            ← المعلمون
          </Link>

          {worker && (
            <>
              <span className="text-gray-300">/</span>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {worker.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-800">{worker.name}</h1>
                  <p className="text-xs text-gray-400">
                    {worker.code} — 🏭 {WH_LABEL[worker.warehouse] || worker.warehouse}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <PrintButtons
          summaryRef={summaryRef}
          fullRef={fullRef}
          workerName={worker?.name}
          seasonLabel={seasonLabel}
        />
      </div>

      {/* ── فلاتر ────────────────────────────────────────────────────────── */}
      <StatementFilters
        dateFrom={dateFrom}           setDateFrom={setDateFrom}
        dateTo={dateTo}               setDateTo={setDateTo}
        showAll={showAll}             setShowAll={setShowAll}
        statusFilter={statusFilter}   setStatusFilter={setStatusFilter}
        seasonId={seasonId}           setSeasonId={setSeasonId}
        applyQuickRange={applyQuickRange}
      />

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {stmtLoading && (
        <div className="card text-center py-16 text-gray-400">
          <div className="flex gap-1 justify-center mb-3">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-sm">جاري التحميل...</p>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {!stmtLoading && summary && (
        <>
          <SummaryCards  summary={summary} />
          <SummaryTables summary={summary} />
          <OrdersTable   orders={orders} summary={summary} />
        </>
      )}

      {/* ── وثائق الطباعة المخفية ─────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none opacity-0 -z-10" aria-hidden="true">
        <PrintSummaryDoc
          ref={summaryRef}
          worker={worker}
          summary={summary}
          seasonLabel={seasonLabel}
        />
      </div>
      <div className="fixed inset-0 pointer-events-none opacity-0 -z-10" aria-hidden="true">
        <PrintFullDoc
          ref={fullRef}
          worker={worker}
          summary={summary}
          orders={orders}
          seasonLabel={seasonLabel}
        />
      </div>
    </div>
  );
}
