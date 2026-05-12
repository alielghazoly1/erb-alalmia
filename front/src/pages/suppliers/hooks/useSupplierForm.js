// ─── hooks/useSupplierForm.js ─────────────────────────────────────────────────
// Hook مسؤول عن حالة فورم الإضافة / التعديل + منطق الـ submit
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { createSupplier, updateSupplier } from '../../../store/slices/supplierSlice';
import toast from 'react-hot-toast';

export const EMPTY_FORM = {
  code:           '',
  name:           '',
  phone:          '',
  address:        '',
  notes:          '',
  isCustomer:     false,
  initialBalance: '',
};

export function useSupplierForm() {
  const dispatch = useDispatch();

  const [isOpen,     setIsOpen]     = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setIsOpen(true);
  };

  const openEdit = (supplier) => {
    setForm({ ...supplier, initialBalance: '' });
    setEditingId(supplier._id);
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code?.trim() || !form.name?.trim())
      return toast.error('الكود والاسم مطلوبين');

    setSubmitting(true);
    try {
      const action = editingId
        ? updateSupplier({ id: editingId, ...form })
        : createSupplier(form);

      const res = await dispatch(action);
      if (res.error) return toast.error(res.payload || 'حدث خطأ');

      const bal = !editingId ? Number(form.initialBalance) : 0;
      toast.success(
        editingId
          ? 'تم التعديل'
          : `تم الإضافة${bal > 0 ? ` — رصيد ابتدائي ${bal.toFixed(2)} ج.م` : ''}`,
      );
      setIsOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    isOpen, editingId, form, submitting,
    openCreate, openEdit, close,
    setField, handleSubmit,
  };
}
