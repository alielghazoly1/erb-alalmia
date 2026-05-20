// ─── hooks/useSupplierTimelineData.js ────────────────────────────────────────
// نفس نهج useTimelineStatement — cursor pagination للموردين
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const PAGE_SIZE = 100;

export function useSupplierTimelineData() {
  const { selectedSeasonId, activeSeason } = useSelector((s) => s.season);
  const defaultSeasonId = selectedSeasonId || activeSeason?._id || '';

  const [supplier,   setSupplier]   = useState(null);
  const [seasonId,   setSeasonId]   = useState(defaultSeasonId);
  const [seasons,    setSeasons]    = useState([]);
  const [totals,     setTotals]     = useState(null);
  const [counts,     setCounts]     = useState(null);
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [loadingMore,setLoadingMore] = useState(false);
  const [hasMore,    setHasMore]    = useState(false);

  const cursorRef       = useRef(null);
  const runningAtEndRef = useRef(0);

  const loadFirst = useCallback(async (s, sid) => {
    if (!s) return;
    setLoading(true);
    setRows([]);
    cursorRef.current       = null;
    runningAtEndRef.current = 0;

    try {
      const { data } = await api.get(`/suppliers/${s._id || s.id}/timeline`, {
        params: { ...(sid ? { seasonId: sid } : {}), limit: PAGE_SIZE },
      });

      setTotals(data.totals);
      setCounts(data.counts);
      setRows(data.rows || []);
      setHasMore(data.hasMore);
      cursorRef.current       = data.nextCursor;
      runningAtEndRef.current = data.runningAtEnd;

      if (data.seasons?.length) setSeasons(data.seasons);
    } catch {
      toast.error('خطأ في تحميل الكشف');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!supplier || !hasMore || loadingMore || !cursorRef.current) return;
    setLoadingMore(true);

    try {
      const { data } = await api.get(`/suppliers/${supplier._id || supplier.id}/timeline`, {
        params: {
          ...(seasonId ? { seasonId } : {}),
          limit:         PAGE_SIZE,
          cursor:        cursorRef.current,
          runningBefore: runningAtEndRef.current,
        },
      });

      setRows(prev => [...prev, ...(data.rows || [])]);
      setHasMore(data.hasMore);
      cursorRef.current       = data.nextCursor;
      runningAtEndRef.current = data.runningAtEnd;
    } catch {
      toast.error('خطأ في تحميل المزيد');
    } finally {
      setLoadingMore(false);
    }
  }, [supplier, seasonId, hasMore, loadingMore]);

  const selectSupplier = useCallback((s) => {
    setSupplier(s);
    setTotals(null);
    setCounts(null);
    setRows([]);
    setHasMore(false);
    if (s) loadFirst(s, seasonId);
  }, [seasonId, loadFirst]);

  const changeSeason = useCallback((sid) => {
    setSeasonId(sid);
    if (supplier) loadFirst(supplier, sid);
  }, [supplier, loadFirst]);

  const reload = useCallback(() => {
    if (supplier) loadFirst(supplier, seasonId);
  }, [supplier, seasonId, loadFirst]);

  return {
    supplier, seasonId, seasons,
    totals, counts, rows,
    loading, loadingMore, hasMore,
    selectSupplier, changeSeason, reload, loadMore,
  };
}
