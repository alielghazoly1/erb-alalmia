// ─── useSupplierInitialBalance.js ─────────────────────────────────────────────
import { useState }    from 'react';
import { useSelector } from 'react-redux';
import api             from '../../../services/api';
import toast           from 'react-hot-toast';

export function useSupplierInitialBalance(onSuccess) {
  const seasonId = useSelector(s =>
    s.season?.selectedSeasonId || s.season?.activeSeason?._id || null
  );

  const [isOpen,     setIsOpen]     = useState(false);
  const [supplier,   setSupplier]   = useState(null);
  const [amount,     setAmount]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const open = (s) => {
    setSupplier(s);
    setAmount(String(Number(s.openingBalance ?? 0)));
    setIsOpen(true);
  };

  const close = () => { setIsOpen(false); setSupplier(null); setAmount(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (isNaN(value)) return toast.error('أدخل رقماً صحيحاً');
    if (!seasonId)    return toast.error('لا يوجد موسم محدد');

    setSubmitting(true);
    try {
      await api.patch(`/suppliers/${supplier._id}/initial-balance`, {
        openingBalance: value,
        seasonId,
      });
      toast.success(`✅ تم تعديل الرصيد الابتدائي إلى ${value.toFixed(2)} ج.م`);
      onSuccess?.();
      close();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ في الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  return { isOpen, supplier, amount, submitting, seasonId, open, close, setAmount, handleSubmit };
}
