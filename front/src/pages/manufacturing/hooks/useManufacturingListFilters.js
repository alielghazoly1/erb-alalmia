import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useManufacturingListFilters() {
  const [params, setParams] = useSearchParams();

  const status   = params.get('status')  || '';
  const warehouse= params.get('wh')      || '';
  const workerId = params.get('worker')  || '';
  const seasonId = params.get('season')  || '';
  const search   = params.get('search')  || '';
  const page     = Number(params.get('page') || '1');

  const set = useCallback(
    (updates) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(updates).forEach(([k, v]) => {
            if (v === '' || v == null) next.delete(k);
            else next.set(k, v);
          });
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return {
    status, warehouse, workerId, seasonId, search, page,
    setStatus:    (v) => set({ status: v,  page: null }),
    setWarehouse: (v) => set({ wh: v,      page: null }),
    setWorkerId:  (v) => set({ worker: v,  page: null }),
    setSeasonId:  (v) => set({ season: v,  page: null }),
    setSearch:    (v) => set({ search: v,  page: null }),
    setPage:      (v) => set({ page: v === 1 ? null : String(v) }),
    clearAll:     ()  => setParams({}, { replace: true }),
  };
}
