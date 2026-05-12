import { useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';

/**
 * useCashRegisterData
 * ───────────────────
 * Handles all API calls. Cancels in-flight requests when params change
 * to prevent stale data from overwriting fresh data.
 */
export function useCashRegisterData({ tab, selectedId, effectiveFrom, effectiveTo, summaryDate, bankMethod }) {
  const [admins,    setAdmins]    = useState([]);
  const [adminData, setAdminData] = useState(null);
  const [bankData,  setBankData]  = useState(null);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(false);

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

  // ── خزنة الأدمن ───────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'admin' || !selectedId) return;
    const signal = cancelPrev();
    setLoading(true);
    const params = {};
    if (effectiveFrom) params.startDate = effectiveFrom;
    if (effectiveTo)   params.endDate   = effectiveTo;
    api.get(`/cash-register/${selectedId}`, { params, signal })
      .then(({ data }) => setAdminData(data))
      .catch((err) => { if (err.name !== 'CanceledError') toast.error('خطأ في تحميل بيانات الأدمن'); })
      .finally(() => setLoading(false));
  }, [tab, selectedId, effectiveFrom, effectiveTo]);

  // ── خزنة البنك ────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'bank') return;
    const signal = cancelPrev();
    setLoading(true);
    const params = {};
    if (effectiveFrom) params.startDate    = effectiveFrom;
    if (effectiveTo)   params.endDate      = effectiveTo;
    if (bankMethod)    params.paymentMethod = bankMethod;
    api.get('/cash-register/bank', { params, signal })
      .then(({ data }) => setBankData(data))
      .catch((err) => { if (err.name !== 'CanceledError') toast.error('خطأ في تحميل بيانات البنك'); })
      .finally(() => setLoading(false));
  }, [tab, effectiveFrom, effectiveTo, bankMethod]);

  const resetAdminData = useCallback(() => setAdminData(null), []);

  return { admins, adminData, bankData, summary, loading, resetAdminData };
}
