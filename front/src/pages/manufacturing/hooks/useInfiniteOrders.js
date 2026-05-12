// ─── hooks/useInfiniteOrders.js ───────────────────────────────────────────────
//  ✅ Preload عند 80% من القائمة (مش عند آخر عنصر)
//  ✅ Network error state مع زرار retry
//  ✅ Reset تلقائي عند تغيير الفلاتر
//  ✅ Guard — منع طلبين بالتوازي isFetchingRef
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback, useReducer } from 'react';
import { useDispatch } from 'react-redux';
import { fetchOrders } from '../../../store/slices/manufacturingSlice';

const LIMIT      = 100;   // حجم كل صفحة
const PRELOAD_AT = 0.80;  // ابدأ تحميل الصفحة الجاية لما نوصل 80%

// ── State ─────────────────────────────────────────────────────────────────────
const INIT = {
  items:       [],
  page:        0,
  total:       0,
  hasMore:     true,
  loading:     false,
  loadingMore: false,
  error:       null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...INIT };
    case 'LOADING_FIRST':
      return { ...state, loading: true, error: null };
    case 'LOADING_MORE':
      return { ...state, loadingMore: true, error: null };
    case 'LOADED': {
      const merged = action.page === 1
        ? action.orders
        : [...state.items, ...action.orders];
      return {
        ...state,
        loading:     false,
        loadingMore: false,
        error:       null,
        items:       merged,
        total:       action.total,
        page:        action.page,
        hasMore:     merged.length < action.total,
      };
    }
    case 'ERROR':
      return { ...state, loading: false, loadingMore: false, error: action.msg };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export function useInfiniteOrders(filters) {
  const dispatch               = useDispatch();
  const [state, localDispatch] = useReducer(reducer, INIT);
  const filtersRef             = useRef(filters);
  const isFetchingRef          = useRef(false);
  const nextPageRef            = useRef(1);

  // ── load page ─────────────────────────────────────────────────────────────
  const loadPage = useCallback(async (page) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    localDispatch({ type: page === 1 ? 'LOADING_FIRST' : 'LOADING_MORE' });
    try {
      const res = await dispatch(fetchOrders({
        ...filtersRef.current,
        page,
        limit: LIMIT,
      }));
      if (res.payload) {
        localDispatch({
          type:   'LOADED',
          orders: res.payload.orders ?? [],
          total:  res.payload.total  ?? 0,
          page,
        });
        nextPageRef.current = page + 1;
      } else {
        localDispatch({ type: 'ERROR', msg: 'فشل التحميل — حاول مرة تانية' });
      }
    } catch {
      localDispatch({
        type: 'ERROR',
        msg: navigator.onLine ? 'خطأ في السيرفر' : 'تحقق من الاتصال بالإنترنت',
      });
    } finally {
      isFetchingRef.current = false;
    }
  }, [dispatch]);

  // ── retry ─────────────────────────────────────────────────────────────────
  const retry = useCallback(() => loadPage(nextPageRef.current), [loadPage]);

  // ── Reset لما الفلاتر تتغير ───────────────────────────────────────────────
  useEffect(() => {
    filtersRef.current    = filters;
    nextPageRef.current   = 1;
    isFetchingRef.current = false;
    localDispatch({ type: 'RESET' });
    loadPage(1);
  }, [JSON.stringify(filters)]); // eslint-disable-line

  // ── triggerIndex — العنصر اللي لما يظهر نبدأ نحمل الجاي ──────────────────
  const triggerIndex = state.items.length > 0
    ? Math.floor(state.items.length * PRELOAD_AT) - 1
    : -1;

  // ── callback ref للعنصر الـ trigger ──────────────────────────────────────
  const observerRef = useRef(null);
  const sentinelCallbackRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingRef.current && state.hasMore && !state.error) {
          loadPage(nextPageRef.current);
        }
      },
      { rootMargin: '300px', threshold: 0 },
    );
    observerRef.current.observe(node);
  }, [state.hasMore, state.error, loadPage]);

  return {
    items:              state.items,
    total:              state.total,
    hasMore:            state.hasMore,
    loading:            state.loading,
    loadingMore:        state.loadingMore,
    error:              state.error,
    triggerIndex,
    sentinelCallbackRef,
    retry,
  };
}
