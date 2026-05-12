// ─── hooks/useSupplierStatementData.js ──────────────────────────────────────
// Hook مسؤول عن جلب وإدارة كشف حساب المورد الكامل
// يدعم pagination من السيرفر مع cache محلي للـ totals
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const PAGE_SIZE = 200; // عدد السجلات في كل صفحة (من الباك)

export function useSupplierStatementData() {
  const [supplier,  setSupplier]  = useState(null);
  const [seasonId,  setSeasonId]  = useState('');
  const [seasons,   setSeasons]   = useState([]);
  const [statement, setStatement] = useState(null);
  const [loading,   setLoading]   = useState(false);

  // ── pagination من الباك ────────────────────────────────────────────────
  const [serverPage, setServerPage] = useState(1);
  const [tab,        setTab]        = useState('all'); // 'all'|'invoices'|'returns'|'payments'

  // ── جلب المواسم عند التحميل الأول ──────────────────────────────────────
  useEffect(() => {
    api.get('/seasons')
      .then(({ data }) => setSeasons(data))
      .catch(() => {});
  }, []);

  /**
   * جلب كشف الحساب للمورد في موسم معين مع pagination من السيرفر
   */
  const loadStatement = useCallback(async (s, sid, pg = 1, activeTab = 'all') => {
    if (!s) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/suppliers/${s._id || s.id}/statement`, {
        params: {
          ...(sid ? { seasonId: sid } : {}),
          page: pg,
          pageSize: PAGE_SIZE,
          tab: activeTab,
        },
      });
      setStatement(data);
      if (data.seasons?.length) setSeasons(data.seasons);
    } catch {
      toast.error('خطأ في تحميل الكشف');
    } finally {
      setLoading(false);
    }
  }, []);

  /** اختيار مورد جديد */
  const selectSupplier = useCallback((s) => {
    setSupplier(s);
    setStatement(null);
    setServerPage(1);
    setTab('all');
    if (s) loadStatement(s, seasonId, 1, 'all');
  }, [seasonId, loadStatement]);

  /** تغيير الموسم */
  const changeSeason = useCallback((sid) => {
    setSeasonId(sid);
    setServerPage(1);
    loadStatement(supplier, sid, 1, tab);
  }, [supplier, tab, loadStatement]);

  /** تغيير الـ tab */
  const changeTab = useCallback((newTab) => {
    setTab(newTab);
    setServerPage(1);
    loadStatement(supplier, seasonId, 1, newTab);
  }, [supplier, seasonId, loadStatement]);

  /** تغيير الصفحة */
  const changePage = useCallback((pg) => {
    setServerPage(pg);
    loadStatement(supplier, seasonId, pg, tab);
  }, [supplier, seasonId, tab, loadStatement]);

  /** إعادة تحميل */
  const reload = useCallback(() => {
    loadStatement(supplier, seasonId, serverPage, tab);
  }, [supplier, seasonId, serverPage, tab, loadStatement]);

  // ── بيانات مشتقة ────────────────────────────────────────────────────────
  const invoices = useMemo(() => statement?.invoices  || [], [statement]);
  const returns  = useMemo(() => statement?.returns   || [], [statement]);
  const payments = useMemo(() => statement?.payments  || [], [statement]);
  const pagination = statement?.pagination || {};

  return {
    // بيانات
    supplier, seasonId, seasons, statement, loading,
    invoices, returns, payments,
    pagination, serverPage, tab,
    // actions
    selectSupplier, changeSeason, changeTab, changePage, reload,
    setSeasons,
  };
}
