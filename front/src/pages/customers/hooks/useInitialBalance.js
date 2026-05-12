// ─── useInitialBalance.js ────────────────────────────────────────────────────
// Hook مخصص لتعديل الرصيد الابتدائي لعميل موجود
// يفتح موديل مستقل بعيد عن فورم التعديل العادي
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { fetchCustomers } from '../../../store/slices/customerSlice';

export function useInitialBalance() {
  const dispatch = useDispatch();

  const [isOpen,     setIsOpen]     = useState(false);
  const [customer,   setCustomer]   = useState(null);  // العميل المختار
  const [amount,     setAmount]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  /** فتح موديل تعديل الرصيد لعميل معين */
  const open = (c) => {
    setCustomer(c);
    setAmount('');
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  /**
   * إرسال التعديل إلى الباك — يستدعي endpoint مخصص
   * PATCH /customers/:id/initial-balance
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (isNaN(value) || value < 0)
      return toast.error('أدخل مبلغ صحيح');

    setSubmitting(true);
    try {
      await api.patch(`/customers/${customer._id}/initial-balance`, {
        initialBalance: value,
      });
      toast.success('تم تعديل الرصيد الابتدائي');
      dispatch(fetchCustomers()); // تحديث القائمة
      setIsOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    isOpen, customer, amount, submitting,
    open, close,
    setAmount, handleSubmit,
  };
}
