// ─── hooks/useWorkerOrders.js ─────────────────────────────────────────────────
//  Cursor-based infinite scroll للأوامر في كشف المعلم
//  ✅ preload عند 80% من القائمة
//  ✅ error state مع retry
//  ✅ reset تلقائي لما الفلاتر تتغير
//  ✅ guard — منع طلبين بالتوازي
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback, useReducer } from 'react';
import api from '../../../services/api';

const LIMIT      = 50;
const PRELOAD_AT = 0.80;   // ابدأ تحميل الصفحة الجاية عند 80%

// ── State ─────────────────────────────────────────────────────────────────────
const INIT = {
  items:       [],
  hasMore:     true,
  loading:     false,
  loadingMore: false,
  error:       null,
  nextCursor:  null,
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
      const merged = action.isFirst
        ? action.orders
        : [...state.items, ...action.orders];
      return {
        ...state,
        loading:     false,
        loadingMore: false,
        error:       null,
        items:       merged,
        hasMore:     action.hasMore,
        nextCursor:  action.nextCursor,
      };
    }
    case 'ERROR':
      return { ...state, loading: false, loadingMore: false, error: action.msg };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export function useWorkerOrders(workerId, filters) {
  const [state, dispatch] = useReducer(reducer, INIT);
  const isFetchingRef     = useRef(false);
  const cursorRef         = useRef(null);
  const filtersRef        = useRef(filters);
  const observerRef       = useRef(null);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (isFirst = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    dispatch({ type: isFirst ? 'LOADING_FIRST' : 'LOADING_MORE' });

    try {
      const params = { limit: LIMIT, ...filtersRef.current };
      if (!isFirst && cursorRef.current) params.cursor = cursorRef.current;

      const { data } = await api.get(`/workers/${workerId}/orders`, { params });

      cursorRef.current = data.nextCursor ?? null;
      dispatch({
        type:       'LOADED',
        orders:     data.orders,
        hasMore:    data.hasMore,
        nextCursor: data.nextCursor,
        isFirst,
      });
    } catch {
      dispatch({
        type: 'ERROR',
        msg:  navigator.onLine ? 'خطأ في السيرفر' : 'تحقق من الاتصال بالإنترنت',
      });
    } finally {
      isFetchingRef.current = false;
    }
  }, [workerId]);

  // ── retry ─────────────────────────────────────────────────────────────────
  const retry = useCallback(() => {
    if (cursorRef.current === null && state.items.length === 0) {
      fetchPage(true);
    } else {
      fetchPage(false);
    }
  }, [fetchPage, state.items.length]);

  // ── reset لما الفلاتر تتغير ───────────────────────────────────────────────
  useEffect(() => {
    filtersRef.current    = filters;
    cursorRef.current     = null;
    isFetchingRef.current = false;
    dispatch({ type: 'RESET' });
    fetchPage(true);
  }, [JSON.stringify(filters), workerId]); // eslint-disable-line

  // ── triggerIndex — عند 80% من القائمة ────────────────────────────────────
  const triggerIndex = state.items.length > 0
    ? Math.floor(state.items.length * PRELOAD_AT) - 1
    : -1;

  // ── sentinelCallbackRef — callback ref يُعلَّق على العنصر الـ 80% ─────────
  const sentinelCallbackRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          !isFetchingRef.current &&
          state.hasMore &&
          !state.error
        ) {
          fetchPage(false);
        }
      },
      { rootMargin: '300px', threshold: 0 },
    );
    observerRef.current.observe(node);
  }, [state.hasMore, state.error, fetchPage]);

  return {
    orders:             state.items,
    hasMore:            state.hasMore,
    loading:            state.loading,
    loadingMore:        state.loadingMore,
    error:              state.error,
    triggerIndex,
    sentinelCallbackRef,
    retry,
  };
}
