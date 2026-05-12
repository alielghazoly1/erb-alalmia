// ─── hooks/useWorkerStatement.js ─────────────────────────────────────────────
//  بيجيب الـ summary فقط (بيانات المعلم + الإجماليات)
//  الأوامر التفصيلية بتتجاب بـ useWorkerOrders منفصل
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector }         from 'react-redux';
import { fetchWorkerStatement }             from '../../../store/slices/workerSlice';

// ─── Date helpers ─────────────────────────────────────────────────────────────
export const todayStr = () => new Date().toISOString().split('T')[0];

const shiftDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

export const QUICK_RANGES = [
  { label: 'اليوم',   resolve: () => ({ from: todayStr(),    to: todayStr() }) },
  { label: 'أمس',    resolve: () => ({ from: shiftDays(-1), to: shiftDays(-1) }) },
  { label: 'الأسبوع', resolve: () => ({ from: shiftDays(-6), to: todayStr() }) },
  {
    label:   'الشهر',
    resolve: () => {
      const t = new Date();
      return {
        from: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`,
        to:   todayStr(),
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
export function useWorkerStatement(workerId) {
  const dispatch = useDispatch();
  const { statement, stmtLoading } = useSelector(s => s.workers);

  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [showAll,      setShowAll]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('approved');
  const [seasonId,     setSeasonId]     = useState('');

  // ── load summary ──────────────────────────────────────────────────────────
  const load = useCallback(() => {
    const params = { workerId };
    if (statusFilter) params.status   = statusFilter;
    if (seasonId)     params.seasonId = seasonId;
    if (!showAll) {
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo)   params.endDate   = dateTo;
    }
    dispatch(fetchWorkerStatement(params));
  }, [workerId, dateFrom, dateTo, showAll, statusFilter, seasonId, dispatch]);

  useEffect(() => { load(); }, [load]);

  const applyQuickRange = useCallback((range) => {
    const { from, to } = range.resolve();
    setDateFrom(from);
    setDateTo(to);
    setShowAll(false);
  }, []);

  // ── filters object لتمريره لـ useWorkerOrders ─────────────────────────────
  const ordersFilters = {
    status:    statusFilter || undefined,
    seasonId:  seasonId    || undefined,
    startDate: !showAll && dateFrom ? dateFrom : undefined,
    endDate:   !showAll && dateTo   ? dateTo   : undefined,
  };

  return {
    // data
    statement,
    stmtLoading,
    worker:  statement?.worker,
    summary: statement?.summary,
    // filters
    dateFrom,     setDateFrom,
    dateTo,       setDateTo,
    showAll,      setShowAll,
    statusFilter, setStatusFilter,
    seasonId,     setSeasonId,
    // actions
    applyQuickRange,
    reload: load,
    // للتمرير لـ useWorkerOrders
    ordersFilters,
  };
}
