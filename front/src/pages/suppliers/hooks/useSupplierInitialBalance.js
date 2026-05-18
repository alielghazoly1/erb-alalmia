// ─── hooks/useSupplierInitialBalance.js ──────────────────────────────────────
// Hook مخصص لتعديل الرصيد الابتدائي لمورد موجود
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { fetchSuppliers } from '../../../store/slices/supplierSlice';

export function useSupplierInitialBalance() {
  const dispatch = useDispatch();

  const [isOpen,     setIsOpen]     = useState(false);
  const [supplier,   setSupplier]   = useState(null);
  const [amount,     setAmount]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const open = (s) => {
    setSupplier(s);
    // pre-fill with current opening balance
    const current = s.openingBalance ?? s.initialBalance ?? 0;
    setAmount(String(Number(current)));
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  /**
   * PATCH /suppliers/:id/initial-balance
   * يعدّل فاتورة الرصيد الابتدائي بدون إنشاء فاتورة جديدة
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (isNaN(value)) return toast.error('أدخل رقماً صحيحاً');

    setSubmitting(true);
    try {
      await api.patch(`/suppliers/${supplier._id}/initial-balance`, {
        openingBalance: value,
      });
      toast.success('تم تعديل الرصيد الابتدائي');
      dispatch(fetchSuppliers());
      setIsOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    isOpen, supplier, amount, submitting,
    open, close,
    setAmount, handleSubmit,
  };
}
