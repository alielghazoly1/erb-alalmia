// ─── useCustomerForm.js ──────────────────────────────────────────────────────
// Hook مسؤول عن حالة فورم الإضافة / التعديل + منطق الـ submit
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { createCustomer, updateCustomer } from '../../../store/slices/customerSlice';
import toast from 'react-hot-toast';

/** القيم الابتدائية للفورم */
export const EMPTY_FORM = {
  code:           '',
  name:           '',
  phone:          '',
  address:        '',
  type:           'credit',
  isSupplier:     false,
  notes:          '',
  initialBalance: '',
};

export function useCustomerForm(onSuccess) {
  const dispatch = useDispatch();

  const [isOpen,     setIsOpen]     = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  /** فتح الفورم لإضافة عميل جديد */
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setIsOpen(true);
  };

  /**
   * فتح الفورم لتعديل عميل موجود
   * @param {object} customer - بيانات العميل من الـ Redux store
   */
  const openEdit = (customer) => {
    // initialBalance مش موجود في التعديل — بس الرصيد الابتدائي يتعدل من updateInitialBalance
    setForm({ ...customer, initialBalance: '' });
    setEditingId(customer._id);
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  /** تحديث حقل واحد في الفورم */
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  /** إرسال الفورم — إضافة أو تعديل */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code?.trim() || !form.name?.trim())
      return toast.error('الكود والاسم مطلوبين');

    setSubmitting(true);
    try {
      const action = editingId
        ? updateCustomer({ id: editingId, ...form })
        : createCustomer(form);

      const res = await dispatch(action);
      if (res.error) return toast.error(res.payload || 'حدث خطأ');

      toast.success(editingId ? 'تم التعديل' : 'تم إضافة العميل');
      setIsOpen(false);
      onSuccess?.();
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
