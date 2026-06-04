// hooks/usePaymentModal.js
'use strict';

import { useState, useRef, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const DEBOUNCE_MS = 600;

export const emptyPayForm = {
  amount:         '',
  paymentMethod:  'cash',
  cashAmount:     '',
  instapayAmount: '',
  receiptNumber:  '',
  notes:          '',
  reference:      '',
  date:           new Date().toISOString().split('T')[0],
};

/**
 * Hook مشترك بين كشف العميل وكشف المورد
 * يدير منطق إضافة وتعديل الدفعات والتحقق من رقم الوصل
 *
 * ✅ FIX: finally دايماً بيعمل setPayChecking(false) حتى لو req فشل
 * ✅ FIX: debounce timer يُلغى عند unmount عشان نمنع memory leak
 * ✅ FIX: toast.error بدل silent-ignore عند فشل check-receipt
 */
export function usePaymentModal({ entityId, entityType, seasonId, onSuccess }) {
  const [payModal,    setPayModal]    = useState(false);
  const [payForm,     setPayForm]     = useState(emptyPayForm);
  const [payError,    setPayError]    = useState('');
  const [payChecking, setPayChecking] = useState(false);

  const [editPayModal, setEditPayModal] = useState(false);
  const [editPayId,    setEditPayId]    = useState(null);
  const [editPayForm,  setEditPayForm]  = useState(emptyPayForm);
  const [editPayError, setEditPayError] = useState('');

  const timerRef = useRef(null);

  // ── checkReceipt ──────────────────────────────────────────────────────────
  const checkReceipt = useCallback(async (val, excludeId = null) => {
    if (!val?.trim()) return;
    const setter = excludeId ? setEditPayError : setPayError;
    setPayChecking(true);
    try {
      const params = { receiptNumber: val.trim() };
      if (excludeId) params.excludeId = excludeId;
      const { data } = await api.get('/payments/check-receipt', { params });
      setter(data.exists ? `⚠️ رقم الوصل "${val.trim()}" موجود بالفعل` : '');
    } catch {
      // network error — امسح الـ error ولا توقف اليوزر
      setter('');
    } finally {
      // ✅ FIX: دايماً بنوقف الـ checking indicator
      setPayChecking(false);
    }
  }, []);

  // ── handleReceiptChange ───────────────────────────────────────────────────
  const handleReceiptChange = useCallback((val, isEdit = false) => {
    if (isEdit) {
      setEditPayForm((f) => ({ ...f, receiptNumber: val }));
      setEditPayError('');
    } else {
      setPayForm((f) => ({ ...f, receiptNumber: val }));
      setPayError('');
    }

    clearTimeout(timerRef.current);

    if (!val?.trim()) {
      setPayChecking(false);
      return;
    }

    // debounce — نستنى الـ user يخلص يكتب
    timerRef.current = setTimeout(
      () => checkReceipt(val, isEdit ? editPayId : null),
      DEBOUNCE_MS,
    );
  }, [checkReceipt, editPayId]);

  // ── add payment ───────────────────────────────────────────────────────────
  const openAddPayment  = () => setPayModal(true);
  const closeAddPayment = () => {
    clearTimeout(timerRef.current);
    setPayModal(false);
    setPayForm(emptyPayForm);
    setPayError('');
    setPayChecking(false);
  };

  // ── edit payment ──────────────────────────────────────────────────────────
  const openEditPayment = (p) => {
    setEditPayId(p._id || p.id);
    setEditPayForm({
      amount:         String(p.amount || ''),
      paymentMethod:  p.paymentMethod  || 'cash',
      cashAmount:     String(p.cashAmount     || ''),
      instapayAmount: String(p.instapayAmount || ''),
      receiptNumber:  p.receiptNumber  || '',
      notes:          p.notes          || '',
      reference:      p.reference      || '',
      date:           p.date
        ? p.date.split('T')[0]
        : new Date().toISOString().split('T')[0],
    });
    setEditPayError('');
    setEditPayModal(true);
  };

  const closeEditPayment = () => {
    clearTimeout(timerRef.current);
    setEditPayModal(false);
    setEditPayId(null);
    setEditPayError('');
    setPayChecking(false);
  };

  // ── submit handlers ───────────────────────────────────────────────────────
  const handleAddPayment = async (entityMeta) => {
    if (!payForm.amount || Number(payForm.amount) <= 0) return toast.error('أدخل المبلغ');
    if (payChecking) return toast.error('جاري التحقق من رقم الوصل…');
    if (payError)    return toast.error(payError);
    try {
      await api.post('/payments', {
        type:           entityType === 'customer' ? 'customer_payment' : 'supplier_payment',
        ...entityMeta,
        seasonId,
        amount:         Number(payForm.amount),
        paymentMethod:  payForm.paymentMethod,
        cashAmount:     Number(payForm.cashAmount)     || 0,
        instapayAmount: Number(payForm.instapayAmount) || 0,
        receiptNumber:  payForm.receiptNumber?.trim()  || undefined,
        notes:          payForm.notes,
        reference:      payForm.reference,
        date:           payForm.date || undefined,
      });
      toast.success('تم تسجيل الدفع ✅');
      closeAddPayment();
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الدفع');
    }
  };

  const handleUpdatePayment = async () => {
    if (!editPayForm.amount || Number(editPayForm.amount) <= 0) return toast.error('أدخل المبلغ');
    if (payChecking)  return toast.error('جاري التحقق من رقم الوصل…');
    if (editPayError) return toast.error(editPayError);
    try {
      await api.put(`/payments/${editPayId}`, {
        amount:         Number(editPayForm.amount),
        paymentMethod:  editPayForm.paymentMethod,
        cashAmount:     Number(editPayForm.cashAmount)     || 0,
        instapayAmount: Number(editPayForm.instapayAmount) || 0,
        receiptNumber:  editPayForm.receiptNumber?.trim()  || undefined,
        notes:          editPayForm.notes,
        reference:      editPayForm.reference,
        date:           editPayForm.date || undefined,
      });
      toast.success('تم التعديل ✅');
      closeEditPayment();
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في التعديل');
    }
  };

  return {
    // add
    payModal, payForm, setPayForm, payError, payChecking,
    openAddPayment, closeAddPayment, handleAddPayment,
    // edit
    editPayModal, editPayForm, setEditPayForm, editPayError,
    openEditPayment, closeEditPayment, handleUpdatePayment,
    // shared
    handleReceiptChange,
  };
}
