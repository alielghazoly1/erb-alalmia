// ─── pages/purchase/hooks/usePurchaseActions.js ──────────────────────────────
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  approvePurchaseInvoice,
  suspendPurchaseInvoice,
  cancelPurchaseInvoice,
} from '../../../store/slices/purchaseSlice';
import toast from 'react-hot-toast';

export function usePurchaseActions() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';

  const handleApprove = useCallback(
    async (id) => {
      if (!window.confirm('هتوافق على الفاتورة دي وتحدث المخزن؟')) return;
      const res = await dispatch(approvePurchaseInvoice(id));
      if (!res.error) toast.success('تم الموافقة وتحديث المخزن ✅');
      else toast.error(res.payload || 'حدث خطأ');
    },
    [dispatch]
  );

  const handleSuspend = useCallback(
    async (id) => {
      const reason = prompt('سبب التعليق (اختياري):') ?? '';
      const res = await dispatch(suspendPurchaseInvoice({ id, reason }));
      if (!res.error) toast.success('تم التعليق');
      else toast.error(res.payload || 'حدث خطأ');
    },
    [dispatch]
  );

  const handleCancel = useCallback(
    async (id) => {
      if (!window.confirm('هتلغي الفاتورة دي نهائياً؟')) return;
      const res = await dispatch(cancelPurchaseInvoice(id));
      if (!res.error) toast.success('تم الإلغاء');
      else toast.error(res.payload || 'حدث خطأ');
    },
    [dispatch]
  );

  return { isAdmin, handleApprove, handleSuspend, handleCancel };
}
