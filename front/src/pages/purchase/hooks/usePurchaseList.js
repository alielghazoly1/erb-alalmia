// ─── pages/purchase/hooks/usePurchaseList.js ─────────────────────────────────
// يدير جلب البيانات مع infinite scroll + preload عند 80% من القائمة
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPurchaseInvoices,
  resetList,
} from '../../../store/slices/purchaseSlice';
import { useSelectedSeason } from '../../../hook/Useselectedseason';
import { useInfiniteScroll } from '../../../hook/useInfiniteScroll';

const PRELOAD_THRESHOLD = 0.8; // ابدأ تحمّل عند 80% من القائمة الحالية

export function usePurchaseList(apiFilters) {
  const dispatch = useDispatch();
  const { list, loading, loadingMore, error, hasMore, nextCursor } =
    useSelector((s) => s.purchase);
  const seasonId = useSelectedSeason();

  // تتبع آخر فلاتر استخدمناها — لنعرف لما تتغير
  const prevFiltersRef = useRef(null);

  // ── أول تحميل / إعادة التحميل عند تغيير الفلاتر ─────────────────────────
  useEffect(() => {
    if (!seasonId) return;

    const filtersKey = JSON.stringify({ ...apiFilters, seasonId });
    if (prevFiltersRef.current === filtersKey) return;
    prevFiltersRef.current = filtersKey;

    dispatch(resetList());
    dispatch(fetchPurchaseInvoices({ ...apiFilters, seasonId }));
  }, [dispatch, apiFilters, seasonId]);

  // ── تحميل الصفحة التالية ─────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore || !seasonId) return;
    dispatch(
      fetchPurchaseInvoices({
        ...apiFilters,
        seasonId,
        cursor: nextCursor,
      })
    );
  }, [dispatch, hasMore, loading, loadingMore, seasonId, apiFilters, nextCursor]);

  // ── Sentinel للـ IntersectionObserver ─────────────────────────────────────
  // threshold=0 — نلاحظ لما يظهر أي جزء منه
  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    loading: loadingMore,
    threshold: 0,
  });

  // ── Preload عند 80% (row-based) ──────────────────────────────────────────
  // بنستخدم ref على الـ row رقم 80% من القائمة
  const preloadRef = useRef(null);

  useEffect(() => {
    const el = preloadRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore, list.length]);

  // ── إعادة المحاولة عند الخطأ ──────────────────────────────────────────────
  const retry = useCallback(() => {
    if (!seasonId) return;
    dispatch(resetList());
    dispatch(fetchPurchaseInvoices({ ...apiFilters, seasonId }));
  }, [dispatch, apiFilters, seasonId]);

  // حساب index الـ preload (عند 80% من القائمة الحالية)
  const preloadIndex =
    list.length > 0 ? Math.floor(list.length * PRELOAD_THRESHOLD) : null;

  return {
    list,
    loading,
    loadingMore,
    error,
    hasMore,
    sentinelRef,
    preloadRef,
    preloadIndex,
    retry,
  };
}
