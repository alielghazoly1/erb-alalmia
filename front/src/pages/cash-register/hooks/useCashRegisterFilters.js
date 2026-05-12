import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { todayStr, yesterdayStr, monthStartStr } from '../cashRegisterConfig';

/**
 * useCashRegisterFilters
 * ─────────────────────
 * كل الفلاتر محفوظة في URL params فمش هتتفقد لو الصفحة اتفتحت في tab جديد
 * أو اتشيرت مع حد.
 */
export function useCashRegisterFilters() {
  const [params, setParams] = useSearchParams();

  // ── getters ──────────────────────────────────────────────────────────────
  const tab        = params.get('tab')        || 'summary';
  const dateFrom   = params.get('from')       || todayStr();
  const dateTo     = params.get('to')         || todayStr();
  const showAll    = params.get('all')        === '1';
  const summaryDate= params.get('sdate')      || todayStr();
  const selectedId = params.get('admin')      || '';
  const bankMethod = params.get('method')     || '';

  // computed
  const effectiveFrom = showAll ? '' : dateFrom;
  const effectiveTo   = showAll ? '' : dateTo;

  // ── setters (partial update — لا يمسح باقي الفلاتر) ─────────────────────
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

  // ── helpers ───────────────────────────────────────────────────────────────
  const setTab        = (v) => set({ tab: v });
  const setDateFrom   = (v) => set({ from: v });
  const setDateTo     = (v) => set({ to: v });
  const setShowAll    = (v) => set({ all: v ? '1' : null });
  const setSummaryDate= (v) => set({ sdate: v });
  const setSelectedId = (v) => set({ admin: v });
  const setBankMethod = (v) => set({ method: v });

  const setQuick = useCallback(
    (label) => {
      if (label === 'اليوم') {
        set({ from: todayStr(), to: todayStr(), all: null });
      } else if (label === 'أمس') {
        const s = yesterdayStr();
        set({ from: s, to: s, all: null });
      } else if (label === 'الشهر') {
        set({ from: monthStartStr(), to: todayStr(), all: null });
      }
    },
    [set],
  );

  // navigate to admin tab with a specific date
  const openAdminOnDate = useCallback(
    (adminId, date) => {
      set({ tab: 'admin', admin: adminId, from: date, to: date, all: null });
    },
    [set],
  );

  return {
    // values
    tab, dateFrom, dateTo, showAll, summaryDate, selectedId, bankMethod,
    effectiveFrom, effectiveTo,
    // setters
    setTab, setDateFrom, setDateTo, setShowAll, setSummaryDate,
    setSelectedId, setBankMethod, setQuick, openAdminOnDate,
  };
}
