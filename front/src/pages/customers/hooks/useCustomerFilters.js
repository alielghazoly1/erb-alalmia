// ─── useCustomerFilters.js ───────────────────────────────────────────────────
// Hook مسؤول عن كل منطق الفلترة والبحث والـ pagination في قائمة العملاء
// مفصول تماماً عن الـ UI عشان يسهل الاختبار والتعديل
// ────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';

export const PAGE_SIZE = 50; // عدد العملاء في كل صفحة

/** يرتب العملاء ترتيب رقمي صحيح بناءً على الكود */
const sortByCode = (a, b) => {
  const na = parseInt(a.code, 10);
  const nb = parseInt(b.code, 10);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return (a.code || '').localeCompare(b.code || '', 'ar');
};

export function useCustomerFilters(list = []) {
  const [search,      setSearch]      = useState('');
  const [filterType,  setFilterType]  = useState(''); // '' | 'credit' | 'cash'
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [page,        setPage]        = useState(1);

  // إعادة الصفحة لـ 1 تلقائياً لما يتغير أي فلتر
  const handleSearch     = (v) => { setSearch(v);      setPage(1); };
  const handleFilterType = (v) => { setFilterType(v);  setPage(1); };
  const handleDebtors    = (v) => { setOnlyDebtors(v); setPage(1); };

  // ── الفلترة الكاملة — بيتحسب بس لما تتغير الـ deps ────────────────────
  const filtered = useMemo(() => {
    return list
      .filter((c) => {
        if (search && !c.name.includes(search) && !c.code.includes(search))
          return false;
        if (filterType && c.type !== filterType) return false;
        if (onlyDebtors && !(c.balance > 0)) return false;
        return true;
      })
      .sort(sortByCode);
  }, [list, search, filterType, onlyDebtors]);

  // ── إجماليات الـ footer ──────────────────────────────────────────────────
  const totals = useMemo(() => ({
    balance: filtered.reduce((s, c) => s + (c.balance    || 0), 0),
    sales:   filtered.reduce((s, c) => s + (c.totalSales || 0), 0),
    paid:    filtered.reduce((s, c) => s + (c.totalPaid  || 0), 0),
  }), [filtered]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    search, filterType, onlyDebtors, page,
    setSearch: handleSearch,
    setFilterType: handleFilterType,
    setOnlyDebtors: handleDebtors,
    setPage,
    filtered, paginated, totals, totalPages,
  };
}
