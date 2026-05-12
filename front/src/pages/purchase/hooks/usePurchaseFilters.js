// ─── pages/purchase/hooks/usePurchaseFilters.js ───────────────────────────────
// يدير حالة الفلاتر ويعكسها في الـ URL
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

export function usePurchaseFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── قراءة الفلاتر من الـ URL ─────────────────────────────────────────────
  const filters = useMemo(() => {
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';
    const showAllDates = searchParams.get('allDates') === '1';
    const dateFrom = searchParams.get('from') || todayStr();
    const dateTo = searchParams.get('to') || todayStr();
    return { status, search, showAllDates, dateFrom, dateTo };
  }, [searchParams]);

  // ── تحديث فلتر واحد ──────────────────────────────────────────────────────
  const setFilter = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === '' || value === null || value === undefined) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  // ── دوال سريعة للتواريخ ───────────────────────────────────────────────────
  const setToday = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('from', todayStr());
      next.set('to', todayStr());
      next.delete('allDates');
      return next;
    });
  }, [setSearchParams]);

  const setYesterday = useCallback(() => {
    const y = yesterdayStr();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('from', y);
      next.set('to', y);
      next.delete('allDates');
      return next;
    });
  }, [setSearchParams]);

  const setThisMonth = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('from', firstOfMonth());
      next.set('to', todayStr());
      next.delete('allDates');
      return next;
    });
  }, [setSearchParams]);

  const toggleAllDates = useCallback(
    (val) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) {
          next.set('allDates', '1');
        } else {
          next.delete('allDates');
          next.set('from', todayStr());
          next.set('to', todayStr());
        }
        return next;
      });
    },
    [setSearchParams]
  );

  // ── الفلاتر الفعلية المرسلة للـ API ─────────────────────────────────────
  const apiFilters = useMemo(() => {
    const { status, search, showAllDates, dateFrom, dateTo } = filters;
    return {
      ...(status ? { status } : {}),
      ...(search ? { search } : {}),
      ...(!showAllDates ? { startDate: dateFrom, endDate: dateTo } : {}),
    };
  }, [filters]);

  return {
    filters,
    apiFilters,
    setFilter,
    setToday,
    setYesterday,
    setThisMonth,
    toggleAllDates,
  };
}
