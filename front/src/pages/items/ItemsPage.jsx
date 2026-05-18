// ─── front/src/pages/items/ItemsPage.jsx ─────────────────────────────────────
// صفحة الأصناف — معالجة آمنة للقيم العشرية (Decimal)
// ✅ UPDATED: All numeric fields use parseDecimalFromInput() for safe parsing
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../services/api';
import { parseDecimalFromInput, formatDecimal } from '../../utils/decimalHelper';

// ── Components ───────────────────────────────────────────────────────────────
import ItemCard from '../../components/items/ItemCard';
import ItemFormModal from '../../components/items/ItemFormModal';
import SearchBar from '../../components/common/SearchBar';
import Pagination from '../../components/common/Pagination';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const PAGE_SIZE = 100;

const ItemsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isRawMaterial, setIsRawMaterial] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // ── Fetch items ──────────────────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey: ['items', search, page, isRawMaterial],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('page', page);
      if (isRawMaterial) params.append('isRawMaterial', isRawMaterial);
      const res = await api.get(`/items?${params}`);
      return res.data;
    },
    keepPreviousData: true,
  });

  // ── Create item ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/items', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['items']);
      setShowModal(false);
      showToast('تم إضافة الصنف بنجاح', 'success');
    },
    onError: (err) => showToast(err.response?.data?.message || 'خطأ', 'error'),
  });

  // ── Update item ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['items']);
      setShowModal(false);
      setEditingItem(null);
      showToast('تم تحديث الصنف بنجاح', 'success');
    },
    onError: (err) => showToast(err.response?.data?.message || 'خطأ', 'error'),
  });

  // ── Delete item ──────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['items']);
      showToast('تم حذف الصنف بنجاح', 'success');
    },
    onError: (err) => showToast(err.response?.data?.message || 'خطأ', 'error'),
  });

  const handleDelete = (item) => {
    confirm({
      title: 'حذف الصنف',
      message: `هل أنت متأكد من حذف "${item.name}"؟`,
      onConfirm: () => deleteMutation.mutate(item.id),
    });
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleSave = (formData) => {
    // ✅ Decimal-safe: parse all numeric fields before sending
    const payload = {
      ...formData,
      defaultWeight: parseDecimalFromInput(formData.defaultWeight),
      lastPurchasePrice: parseDecimalFromInput(formData.lastPurchasePrice),
      lastSalePrice: parseDecimalFromInput(formData.lastSalePrice),
      minStockQty: parseDecimalFromInput(formData.minStockQty),
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (error) return <div className="text-red-500 p-4">خطأ: {error.message}</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">الأصناف</h1>
        <button
          onClick={() => { setEditingItem(null); setShowModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + إضافة صنف
        </button>
      </div>

      <div className="flex gap-4 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="بحث بالكود أو الاسم..." />
        <select
          value={isRawMaterial}
          onChange={(e) => setIsRawMaterial(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">كل الأصناف</option>
          <option value="true">خامات فقط</option>
          <option value="false">منتجات فقط</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid gap-2">
            {data?.items?.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDelete(item)}
                onViewMovements={() => navigate(`/items/${item.id}/movements`)}
              />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={Math.ceil((data?.total || 0) / PAGE_SIZE)}
            onPageChange={setPage}
          />
        </>
      )}

      {showModal && (
        <ItemFormModal
          item={editingItem}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          isLoading={createMutation.isLoading || updateMutation.isLoading}
        />
      )}
    </div>
  );
};

export default ItemsPage;
