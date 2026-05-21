// ─── hooks/useCustomerItemStatement.js ──────────────────────────────────────
// ✅ إضافة: changeSeason — يغير الموسم ويعيد الجلب
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../../../services/api';
import toast from 'react-hot-toast';

export function useCustomerItemStatement() {
  const { selectedSeasonId, activeSeason } = useSelector((s) => s.season);

  const [customer,  setCustomer]  = useState(null);
  const [item,      setItem]      = useState(null);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  // ✅ الموسم المختار يدوياً (null = كل المواسم)
  const [manualSeasonId, setManualSeasonId] = useState(selectedSeasonId || activeSeason?._id || null);

  const seasonId = manualSeasonId;

  const load = async (c, it, sid) => {
    if (!c || !it) return;
    setLoading(true);
    try {
      const { data: res } = await api.get(`/customers/${c._id}/item/${it._id}`, {
        params: sid ? { seasonId: sid } : {},
      });
      setData(res);
    } catch {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = (c) => {
    setCustomer(c);
    setData(null);
    load(c, item, seasonId);
  };

  const selectItem = (it) => {
    setItem(it);
    setData(null);
    load(customer, it, seasonId);
  };

  // ✅ تغيير الموسم وإعادة الجلب
  const changeSeason = (sid) => {
    setManualSeasonId(sid);
    if (customer && item) load(customer, item, sid);
  };

  const calcTotalWeight = (m) => (Number(m.quantity) || 0) * (Number(m.weight) || 0);
  const calcTotal       = (m) => calcTotalWeight(m) * (Number(m.price) || 0);

  return {
    customer, item, data, loading, seasonId,
    selectCustomer, selectItem, changeSeason,
    calcTotalWeight, calcTotal,
  };
}
