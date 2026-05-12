import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { LIMIT } from '../auditConfig';

export function useAuditData({ userId, action, dateFrom, dateTo, showAll, page }) {
  const [logs,       setLogs]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [summary,    setSummary]    = useState(null);
  const [users,      setUsers]      = useState([]);

  const abortRef = useRef(null);

  // ── users + summary — once on mount ──────────────────────────────────────
  useEffect(() => {
    api.get('/audit/users').then(({ data }) => setUsers(data)).catch(() => {});
    api.get('/audit/summary').then(({ data }) => setSummary(data)).catch(() => {});
  }, []);

  // ── logs — refetch when any filter/page changes ───────────────────────────
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    const params = { page, limit: LIMIT };
    if (userId) params.userId = userId;
    if (action) params.action = action;
    if (!showAll) { params.startDate = dateFrom; params.endDate = dateTo; }

    api.get('/audit', { params, signal })
      .then(({ data }) => {
        setLogs(data.logs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      })
      .catch((err) => { if (err.name !== 'CanceledError') toast.error('خطأ في تحميل السجل'); })
      .finally(() => setLoading(false));
  }, [userId, action, dateFrom, dateTo, showAll, page]);

  const refreshSummary = () =>
    api.get('/audit/summary').then(({ data }) => setSummary(data)).catch(() => {});

  return { logs, total, totalPages, loading, summary, users, refreshSummary };
}
