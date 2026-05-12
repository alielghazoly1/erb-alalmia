// ─── pages/purchase/PurchaseListPage.jsx ─────────────────────────────────────
// الصفحة الرئيسية للتوريدات — Infinite scroll + URL filters + Error handling
import React from 'react';
import { useSelector } from 'react-redux';

import { usePurchaseFilters } from './hooks/usePurchaseFilters';
import { usePurchaseList } from './hooks/usePurchaseList';
import { usePurchaseActions } from './hooks/usePurchaseActions';

import PurchaseHeader from './components/PurchaseHeader';
import PurchaseFilters from './components/PurchaseFilters';
import PurchaseTable from './components/PurchaseTable';
import PurchaseLoadingSpinner from './components/PurchaseLoadingSpinner';
import PurchaseEmptyState from './components/PurchaseEmptyState';
import PurchaseErrorState from './components/PurchaseErrorState';

export default function PurchaseListPage() {
  // ── فلاتر مربوطة بالـ URL ────────────────────────────────────────────────
  const { filters, apiFilters, setFilter, setToday, setYesterday, setThisMonth, toggleAllDates } =
    usePurchaseFilters();

  // ── بيانات + infinite scroll ────────────────────────────────────────────
  const {
    list,
    loading,
    loadingMore,
    error,
    hasMore,
    sentinelRef,
    preloadRef,
    preloadIndex,
    retry,
  } = usePurchaseList(apiFilters);

  // ── الإجراءات ─────────────────────────────────────────────────────────────
  const { isAdmin, handleApprove, handleSuspend, handleCancel } =
    usePurchaseActions();

  const { total } = useSelector((s) => s.purchase);

  return (
    <div>
      {/* هيدر */}
      <PurchaseHeader count={list.length} total={total} filters={filters} />

      {/* فلاتر */}
      <PurchaseFilters
        filters={filters}
        onFilter={{ setFilter, setToday, setYesterday, setThisMonth, toggleAllDates }}
      />

      {/* المحتوى */}
      {loading ? (
        <PurchaseLoadingSpinner fullPage />
      ) : error ? (
        <PurchaseErrorState message={error} onRetry={retry} />
      ) : list.length === 0 ? (
        <PurchaseEmptyState
          showAllDates={filters.showAllDates}
          onShowAll={() => toggleAllDates(true)}
        />
      ) : (
        <PurchaseTable
          list={list}
          isAdmin={isAdmin}
          onApprove={handleApprove}
          onSuspend={handleSuspend}
          onCancel={handleCancel}
          loadingMore={loadingMore}
          hasMore={hasMore}
          sentinelRef={sentinelRef}
          preloadRef={preloadRef}
          preloadIndex={preloadIndex}
        />
      )}
    </div>
  );
}
