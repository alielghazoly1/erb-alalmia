// ─── hooks/useSupplierFilters.js ─────────────────────────────────────────────
// Hook مسؤول عن كل منطق الفلترة والبحث والـ pagination في قائمة الموردين
// ────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';

export const PAGE_SIZE = 50;

/** يرتب الموردين ترتيب رقمي صحيح بناءً على الكود */
const sortByCode = (a, b) => {
  const na = parseInt(a.code, 10);
  const nb = parseInt(b.code, 10);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return (a.code || '').localeCompare(b.code || '', 'ar');
};

export function useSupplierFilters(list = []) {
  const [search, setSearch] = useState('');
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [page, setPage] = useState(1);

  // إعادة الصفحة لـ 1 تلقائياً لما يتغير أي فلتر
  const handleSearch = (v) => {
    setSearch(v);
    setPage(1);
  };
  const handleDebtors = (v) => {
    setOnlyDebtors(v);
    setPage(1);
  };

  // ── الفلترة الكاملة ──────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      list
        .filter((s) => {
          if (search && !s.name.includes(search) && !s.code.includes(search))
            return false;
          if (onlyDebtors && !(s.balance > 0)) return false;
          return true;
        })
        .sort(sortByCode),
    [list, search, onlyDebtors],
  );

  // ── إجماليات الـ footer ──────────────────────────────────────────────────
  const totals = useMemo(
    () => ({
      purchases: filtered.reduce((s, sup) => s + (sup.totalPurchases || 0), 0),
      returns: filtered.reduce((s, sup) => s + (sup.totalReturns || 0), 0),
      paid: filtered.reduce((s, sup) => s + (sup.totalPaid || 0), 0),
      // balance موجب = عليهم فلوس (مستحق عليه)، سالب = دفعوا زيادة (مستحق له)
      owedByUs: filtered.reduce(
        (s, sup) => s + Math.max(0, sup.balance || 0),
        0,
      ), // مستحق عليه
      owedToUs: filtered.reduce(
        (s, sup) => s + Math.max(0, -(sup.balance || 0)),
        0,
      ), // مستحق له
    }),
    [filtered],
  );

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    search,
    onlyDebtors,
    page,
    setSearch: handleSearch,
    setOnlyDebtors: handleDebtors,
    setPage,
    filtered,
    paginated,
    totals,
    totalPages,
  };
}
