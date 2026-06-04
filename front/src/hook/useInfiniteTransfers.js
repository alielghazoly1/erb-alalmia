// ─── hook/useInfiniteTransfers.js ────────────────────────────────────────────
// IntersectionObserver يحمّل الـ batch التالي لما الـ sentinel يظهر في الـ viewport
// بيتفعّل عند 80% من عمق القائمة (threshold + rootMargin)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector }        from 'react-redux';
import { fetchTransfers }                  from '../store/slices/transferSlice';

/**
 * @param {object} filters  — نفس الفلاتر المُرسلة للـ API (status, direction, ...)
 * @param {boolean} ready   — هل الفلاتر جاهزة للتطبيق (امنع الـ fetch قبل التحميل)
 */
export function useInfiniteTransfers(filters = {}, ready = true) {
  const dispatch                             = useDispatch();
  const { nextCursor, hasMore, loadingMore } = useSelector(s => s.transfers);
  const sentinelRef                          = useRef(null);
  const observerRef                          = useRef(null);

  // ── تحميل البيانات ─────────────────────────────────────────────────────────
  const load = useCallback((cursor = null, reset = true) => {
    if (!ready) return;
    dispatch(fetchTransfers({ ...filters, cursor, reset }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, ready, JSON.stringify(filters)]);

  // ── عند تغيير الفلاتر → reset ─────────────────────────────────────────────
  useEffect(() => {
    load(null, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // ── IntersectionObserver ─────────────────────────────────────────────────
  useEffect(() => {
    if (!sentinelRef.current) return;

    observerRef.current?.disconnect();

    if (!hasMore || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          load(nextCursor, false);
        }
      },
      {
        // rootMargin: يبدأ التحميل لما يكون على بُعد 200px من نهاية القائمة
        rootMargin: '200px',
        threshold:  0,
      }
    );
    observerRef.current.observe(sentinelRef.current);

    return () => observerRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, nextCursor, load]);

  return { sentinelRef, loadingMore };
}
