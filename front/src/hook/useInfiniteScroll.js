// ─── hook/useInfiniteScroll.js ────────────────────────────────────────────────
// Hook عام للـ infinite scroll — يراقب عنصر sentinel ويستدعي onLoadMore
import { useEffect, useRef, useCallback } from 'react';

/**
 * @param {function} onLoadMore  - الدالة اللي تتنادى لما نوصل للـ threshold
 * @param {boolean}  hasMore     - هل فيه صفحات تانية؟
 * @param {boolean}  loading     - هل في تحميل دلوقتي؟
 * @param {number}   threshold   - نسبة مئوية (0-1) للـ intersection قبل الـ trigger
 * @returns {ref}   sentinelRef  - ضعه على div فاضي في آخر القائمة
 */
export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  loading,
  threshold = 0.1,
}) {
  const sentinelRef = useRef(null);
  const stableLoad  = useCallback(onLoadMore, []); // eslint-disable-line

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, threshold]);

  return sentinelRef;
}
