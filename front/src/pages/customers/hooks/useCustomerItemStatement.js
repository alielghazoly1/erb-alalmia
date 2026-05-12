// ─── hooks/useCustomerItemStatement.js ──────────────────────────────────────
// Hook مسؤول عن جلب كشف صنف معين عند عميل معين
// يُستخدم في CustomerItemStatementPage
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../../../services/api';
import toast from 'react-hot-toast';

export function useCustomerItemStatement() {
  const { selectedSeasonId, activeSeason } = useSelector((s) => s.season);
  // الموسم المختار أو الموسم النشط كـ fallback
  const seasonId = selectedSeasonId || activeSeason?._id;

  const [customer, setCustomer] = useState(null);
  const [item,     setItem]     = useState(null);
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  /**
   * جلب البيانات من الباك
   * @param {object} c  - العميل
   * @param {object} it - الصنف
   * @param {string} sid - seasonId
   */
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

  /** اختيار عميل */
  const selectCustomer = (c) => {
    setCustomer(c);
    setData(null);
    load(c, item, seasonId);
  };

  /** اختيار صنف */
  const selectItem = (it) => {
    setItem(it);
    setData(null);
    load(customer, it, seasonId);
  };

  // حسابات الوزن والإجمالي لكل حركة
  const calcTotalWeight = (m) => (Number(m.quantity) || 0) * (Number(m.weight) || 0);
  const calcTotal       = (m) => calcTotalWeight(m) * (Number(m.price) || 0);

  return {
    customer, item, data, loading, seasonId,
    selectCustomer, selectItem,
    calcTotalWeight, calcTotal,
  };
}
