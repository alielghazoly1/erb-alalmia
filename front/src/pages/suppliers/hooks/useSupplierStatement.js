// ─── hooks/useSupplierStatement.js ───────────────────────────────────────────
// Hook مسؤول عن جلب بيانات كشف الحساب السريع لمورد
// ────────────────────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

export function useSupplierStatement() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [supplier,  setSupplier]  = useState(null);
  const [seasons,   setSeasons]   = useState([]);
  const [loading,   setLoading]   = useState(false);

  const open = useCallback(async (s) => {
    setSupplier(s);
    setSeasons([]);
    setIsOpen(true);
    setLoading(true);
    try {
      const { data } = await api.get(`/suppliers/${s._id}/all-seasons`);
      setSeasons(data);
    } catch {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSupplier(null);
    setSeasons([]);
  }, []);

  return { isOpen, supplier, seasons, loading, open, close };
}
