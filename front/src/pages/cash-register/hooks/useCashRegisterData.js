// ─── hook/useCashRegisterData.js ─────────────────────────────────────────────
import { useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';

/**
 * useCashRegisterData
 * ───────────────────
 * يدعم lazy loading بـ cursor pagination.
 * بيجيب أول 100 حركة، وعند scroll للـ 80% بيجيب الـ 100 الجاية.
 * الإجماليات (totalIn/totalOut/net) بتيجي من أول request وبتفضل ثابتة.
 */
export function useCashRegisterData({
  tab,
  selectedId,
  effectiveFrom,
  effectiveTo,
  summaryDate,
  bankMethod,
}) {
  const [admins,    setAdmins]    = useState([]);
  const [adminData, setAdminData] = useState(null);   // { movements[], totalIn, totalOut, net, count, hasMore, nextCursor }
  const [bankData,  setBankData]  = useState(null);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const abortRef = useRef(null);

  const cancelPrev = () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  // ── جلب الأدمن (مرة واحدة) ────────────────────────────────────────────
  useEffect(() => {
    api.get('/cash-register/admins')
      .then(({ data }) => setAdmins(data))
      .catch(() => {});
  }, []);

  // ── ملخص يومي ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'summary') return;
    const signal = cancelPrev();
    setLoading(true);
    api.get('/cash-register/summary', { params: { date: summaryDate }, signal })
      .then(({ data }) => setSummary(data))
      .catch((err) => { if (err.name !== 'CanceledError') toast.error('خطأ في تحميل الملخص'); })
      .finally(() => setLoading(false));
  }, [tab, summaryDate]);

  // ── خزنة الأدمن — أول صفحة ────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'admin' || !selectedId) return;
    const signal = cancelPrev();
    setLoading(true);
    setAdminData(null); // reset عند تغيير الفلتر

    const params = {};
    if (effectiveFrom) params.startDate = effectiveFrom;
    if (effectiveTo)   params.endDate   = effectiveTo;

    api.get(`/cash-register/${selectedId}`, { params, signal })
      .then(({ data }) => setAdminData(data))
      .catch((err) => { if (err.name !== 'CanceledError') toast.error('خطأ في تحميل بيانات الأدمن'); })
      .finally(() => setLoading(false));
  }, [tab, selectedId, effectiveFrom, effectiveTo]);

  // ── خزنة البنك — أول صفحة ─────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'bank') return;
    const signal = cancelPrev();
    setLoading(true);
    setBankData(null);

    const params = {};
    if (effectiveFrom) params.startDate    = effectiveFrom;
    if (effectiveTo)   params.endDate      = effectiveTo;
    if (bankMethod)    params.paymentMethod = bankMethod;

    api.get('/cash-register/bank', { params, signal })
      .then(({ data }) => setBankData(data))
      .catch((err) => { if (err.name !== 'CanceledError') toast.error('خطأ في تحميل بيانات البنك'); })
      .finally(() => setLoading(false));
  }, [tab, effectiveFrom, effectiveTo, bankMethod]);

  // ── تحميل المزيد — Admin ───────────────────────────────────────────────
  const loadMoreAdmin = useCallback(async () => {
    if (!adminData?.hasMore || !adminData?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = { cursor: adminData.nextCursor };
      if (effectiveFrom) params.startDate = effectiveFrom;
      if (effectiveTo)   params.endDate   = effectiveTo;

      const { data } = await api.get(`/cash-register/${selectedId}`, { params });
      setAdminData(prev => ({
        ...prev,
        movements:  [...prev.movements, ...data.movements],
        nextCursor: data.nextCursor,
        hasMore:    data.hasMore,
      }));
    } catch {
      toast.error('خطأ في تحميل المزيد');
    } finally {
      setLoadingMore(false);
    }
  }, [adminData, loadingMore, selectedId, effectiveFrom, effectiveTo]);

  // ── تحميل المزيد — Bank ────────────────────────────────────────────────
  const loadMoreBank = useCallback(async () => {
    if (!bankData?.hasMore || !bankData?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = { cursor: bankData.nextCursor };
      if (effectiveFrom) params.startDate    = effectiveFrom;
      if (effectiveTo)   params.endDate      = effectiveTo;
      if (bankMethod)    params.paymentMethod = bankMethod;

      const { data } = await api.get('/cash-register/bank', { params });
      setBankData(prev => ({
        ...prev,
        movements:  [...prev.movements, ...data.movements],
        nextCursor: data.nextCursor,
        hasMore:    data.hasMore,
      }));
    } catch {
      toast.error('خطأ في تحميل المزيد');
    } finally {
      setLoadingMore(false);
    }
  }, [bankData, loadingMore, effectiveFrom, effectiveTo, bankMethod]);

  const resetAdminData = useCallback(() => setAdminData(null), []);

  return {
    admins,
    adminData,
    bankData,
    summary,
    loading,
    loadingMore,
    loadMoreAdmin,
    loadMoreBank,
    resetAdminData,
  };
}
