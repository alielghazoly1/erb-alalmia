// ─── pages/reports/hooks/useReportStats.js ───────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { useSelectedSeason } from '../../../hook/Useselectedseason';

/**
 * useReportStats
 * يجيب إحصائيات الموسم المختار ويعيد fetch تلقائي لو الموسم اتغير
 */
export function useReportStats() {
  const seasonId = useSelectedSeason();

  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = seasonId ? { seasonId } : {};
      const { data } = await api.get('/reports/stats', { params });
      setStats(data);
    } catch (err) {
      setError(err.message || 'خطأ في تحميل البيانات');
      toast.error('خطأ في تحميل إحصائيات الموسم');
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  // يعيد fetch تلقائي لو اتغير الموسم
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}
