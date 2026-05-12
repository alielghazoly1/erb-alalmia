// ─── hooks/useTimelineStatement.js ───────────────────────────────────────────
// Hook بيجيب كشف الحساب بـ cursor pagination (lazy loading حقيقي)
// • أول طلب: يجيب totals + أول 100 سجل
// • كل ما الـ user يوصل للآخر: يجيب 100 تاني (append)
// • الـ totals (إجمالي مبيعات/مرتجعات/مدفوعات) محسوبة مرة واحدة من الباك
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const PAGE_SIZE = 100;

export function useTimelineStatement() {
  const [customer,   setCustomer]   = useState(null);
  const [seasonId,   setSeasonId]   = useState('');
  const [seasons,    setSeasons]    = useState([]);
  const [totals,     setTotals]     = useState(null);
  const [counts,     setCounts]     = useState(null);
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [loadingMore,setLoadingMore] = useState(false);
  const [hasMore,    setHasMore]    = useState(false);
  const [error,      setError]      = useState(null);

  // cursor state — نحتاجه للصفحة التالية
  const cursorRef       = useRef(null);
  const runningAtEndRef = useRef(0);

  // ── جلب الصفحة الأولى ─────────────────────────────────────────────────
  const loadFirst = useCallback(async (c, sid) => {
    if (!c) return;
    setLoading(true);
    setError(null);
    setRows([]);
    cursorRef.current       = null;
    runningAtEndRef.current = 0;

    try {
      const { data } = await api.get(`/customers/${c._id || c.id}/timeline`, {
        params: {
          ...(sid ? { seasonId: sid } : {}),
          limit: PAGE_SIZE,
        },
      });

      setTotals(data.totals);
      setCounts(data.counts);
      setRows(data.rows || []);
      setHasMore(data.hasMore);
      cursorRef.current       = data.nextCursor;
      runningAtEndRef.current = data.runningAtEnd;

      if (data.seasons?.length) setSeasons(data.seasons);
    } catch (err) {
      setError('خطأ في تحميل الكشف');
      toast.error('خطأ في تحميل الكشف');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── جلب صفحة إضافية (append) ──────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!customer || !hasMore || loadingMore || !cursorRef.current) return;
    setLoadingMore(true);

    try {
      const { data } = await api.get(`/customers/${customer._id || customer.id}/timeline`, {
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
  }, [customer, seasonId, hasMore, loadingMore]);

  // ── اختيار عميل ───────────────────────────────────────────────────────
  const selectCustomer = useCallback((c) => {
    setCustomer(c);
    setTotals(null);
    setCounts(null);
    setRows([]);
    setHasMore(false);
    if (c) loadFirst(c, seasonId);
  }, [seasonId, loadFirst]);

  // ── تغيير الموسم ──────────────────────────────────────────────────────
  const changeSeason = useCallback((sid) => {
    setSeasonId(sid);
    if (customer) loadFirst(customer, sid);
  }, [customer, loadFirst]);

  // ── reload (بعد إضافة دفعة) ───────────────────────────────────────────
  const reload = useCallback(() => {
    if (customer) loadFirst(customer, seasonId);
  }, [customer, seasonId, loadFirst]);

  return {
    customer, seasonId, seasons,
    totals, counts, rows,
    loading, loadingMore, hasMore, error,
    selectCustomer, changeSeason, reload, loadMore,
  };
}
