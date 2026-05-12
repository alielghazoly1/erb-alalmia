// hooks/useSaleFilters.js
// يحفظ الفلاتر في الـ URL عشان لما ترجع من الفاتورة تلاقيها زي ما هي
import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';

const todayStr = () => new Date().toISOString().split('T')[0];

export function useSaleFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => ({
    search:      params.get('search')      || '',
    status:      params.get('status')      || '',
    dateFrom:    params.get('dateFrom')    || todayStr(),
    dateTo:      params.get('dateTo')      || todayStr(),
    showAllDates: params.get('showAllDates') === '1',
  }), [params]);

  const setFilters = (next) => {
    const p = new URLSearchParams();
    if (next.search)       p.set('search',       next.search);
    if (next.status)       p.set('status',       next.status);
    if (next.dateFrom)     p.set('dateFrom',     next.dateFrom);
    if (next.dateTo)       p.set('dateTo',       next.dateTo);
    if (next.showAllDates) p.set('showAllDates', '1');
    setParams(p, { replace: true });
  };

  // القيم الفعلية المبعوتة للـ API — useMemo عشان يكون stable reference
  // ويمنع إعادة الـ fetch غير الضرورية في useEffect
  // showAllDates → limit=0 (جيب الكل) | غيره → limit=500
  const apiParams = useMemo(() => ({
    status:    filters.status,
    startDate: filters.showAllDates ? '' : filters.dateFrom,
    endDate:   filters.showAllDates ? '' : filters.dateTo,
    limit:     filters.showAllDates ? 0 : 500,
  }), [filters.status, filters.showAllDates, filters.dateFrom, filters.dateTo]);

  return { filters, setFilters, apiParams };
}
