// ─── hooks/useCustomerStatement.js ──────────────────────────────────────────
// Hook مسؤول عن جلب وإدارة كشف حساب العميل الكامل
// يدعم server-side pagination مع tab فلتر — يتحمل 10,000+ سجل
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const PAGE_SIZE = 200;

export function useCustomerStatement() {
  const [customer,  setCustomer]  = useState(null);
  const [seasonId,  setSeasonId]  = useState('');
  const [seasons,   setSeasons]   = useState([]);
  const [statement, setStatement] = useState(null);
  const [loading,   setLoading]   = useState(false);

  // server-side pagination
  const [serverPage, setServerPage] = useState(1);
  const [tab,        setTab]        = useState('all'); // 'all'|'invoices'|'returns'|'payments'

  // جلب المواسم مرة واحدة
  useEffect(() => {
    api.get('/seasons')
      .then(({ data }) => setSeasons(data))
      .catch(() => {});
  }, []);

  /**
   * جلب كشف الحساب مع pagination من السيرفر
   */
  const loadStatement = useCallback(async (c, sid, pg = 1, activeTab = 'all') => {
    if (!c) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/customers/${c._id || c.id}/statement`, {
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

  /** اختيار عميل جديد */
  const selectCustomer = (c) => {
    setCustomer(c);
    setStatement(null);
    setServerPage(1);
    setTab('all');
    if (c) loadStatement(c, seasonId, 1, 'all');
  };

  /** تغيير الموسم */
  const changeSeason = (sid) => {
    setSeasonId(sid);
    setServerPage(1);
    loadStatement(customer, sid, 1, tab);
  };

  /** تغيير tab الفلتر */
  const changeTab = (newTab) => {
    setTab(newTab);
    setServerPage(1);
    loadStatement(customer, seasonId, 1, newTab);
  };

  /** تغيير الصفحة */
  const changePage = (pg) => {
    setServerPage(pg);
    loadStatement(customer, seasonId, pg, tab);
  };

  /** إعادة تحميل (بعد إضافة دفعة) */
  const reload = () => loadStatement(customer, seasonId, serverPage, tab);

  const invoices = statement?.invoices  || [];
  const returns  = statement?.returns   || [];
  const payments = statement?.payments  || [];
  const pagination = statement?.pagination || {};

  return {
    // بيانات
    customer, seasonId, seasons, statement, loading,
    invoices, returns, payments,
    serverPage, tab, pagination,
    // actions
    selectCustomer, changeSeason, changeTab, changePage, reload,
  };
}
