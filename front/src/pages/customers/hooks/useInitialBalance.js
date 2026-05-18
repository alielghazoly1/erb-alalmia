// ─── useInitialBalance.js ────────────────────────────────────────────────────
import { useState } from 'react';
import api          from '../../../services/api';
import toast        from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { fetchCustomers } from '../../../store/slices/customerSlice';

export function useInitialBalance() {
  const dispatch = useDispatch();
  const [isOpen,     setIsOpen]     = useState(false);
  const [customer,   setCustomer]   = useState(null);
  const [amount,     setAmount]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const open = (c) => {
    setCustomer(c);
    // pre-fill current opening balance (accepts negative = دائن)
    const current = c.openingBalance ?? c.initialBalance ?? 0;
    setAmount(String(Number(current)));
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (isNaN(value)) return toast.error('أدخل رقماً صحيحاً');

    setSubmitting(true);
    try {
      await api.patch(`/customers/${customer._id}/initial-balance`, {
        openingBalance: value,   // يقبل سالب (دائن) وموجب (مدين)
      });
      toast.success(`تم تعديل الرصيد الابتدائي إلى ${value} ج.م`);
      dispatch(fetchCustomers());
      setIsOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  return { isOpen, customer, amount, submitting, open, close, setAmount, handleSubmit };
}
