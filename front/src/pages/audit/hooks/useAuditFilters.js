import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { todayStr, yesterdayStr, weekStartStr } from '../auditConfig';

export function useAuditFilters() {
  const [params, setParams] = useSearchParams();

  // ── getters ──────────────────────────────────────────────────────────────
  const userId   = params.get('user')   || '';
  const action   = params.get('action') || '';
  const dateFrom = params.get('from')   || todayStr();
  const dateTo   = params.get('to')     || todayStr();
  const showAll  = params.get('all')    === '1';
  const page     = Number(params.get('page') || '1');

  // ── partial setter ────────────────────────────────────────────────────────
  const set = useCallback(
    (updates) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(updates).forEach(([k, v]) => {
            if (v === '' || v === null || v === undefined) next.delete(k);
            else next.set(k, v);
          });
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const setUserId   = (v) => set({ user: v,   page: null });
  const setAction   = (v) => set({ action: v, page: null });
  const setDateFrom = (v) => set({ from: v,   page: null });
  const setDateTo   = (v) => set({ to: v,     page: null });
  const setShowAll  = (v) => set({ all: v ? '1' : null, page: null });
  const setPage     = (v) => set({ page: v === 1 ? null : String(v) });

  const setQuick = useCallback(
    (label) => {
      if (label === 'اليوم')   set({ from: todayStr(),     to: todayStr(),   all: null, page: null });
      if (label === 'أمس')    set({ from: yesterdayStr(), to: yesterdayStr(), all: null, page: null });
      if (label === 'الأسبوع') set({ from: weekStartStr(), to: todayStr(),   all: null, page: null });
    },
    [set],
  );

  return {
    userId, action, dateFrom, dateTo, showAll, page,
    setUserId, setAction, setDateFrom, setDateTo, setShowAll, setPage, setQuick,
  };
}
