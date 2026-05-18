// ─── front/src/pages/stock/StockAdjustmentPage.jsx ───────────────────────────
// صفحة تسوية المخزون — معالجة آمنة للقيم العشرية (Decimal)
// ✅ UPDATED: All qty/weight fields use parseDecimalFromInput() + formatQty()
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../services/api';
import { parseDecimalFromInput, formatQty, safeNum, round3 } from '../../utils/decimalHelper';

import SearchBar from '../../components/common/SearchBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const WAREHOUSES = [
  { value: 'ramses', label: 'رمسيس' },
  { value: 'october', label: 'أكتوبر' },
];

const StockAdjustmentPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();

  const [warehouse, setWarehouse] = useState('ramses');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // ── Fetch items for selection ────────────────────────────────────────────────
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', search, 1, ''],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('page', 1);
      const res = await api.get(`/items?${params}`);
      return res.data;
    },
    enabled: !showHistory,
  });

  // ── Fetch adjustments history ────────────────────────────────────────────────
  const { data: adjustmentsData, isLoading: adjLoading } = useQuery({
    queryKey: ['stock-adjustments', warehouse],
    queryFn: async () => {
      const res = await api.get(`/stock-adjustments?warehouse=${warehouse}`);
      return res.data;
    },
    enabled: showHistory,
  });

  // ── Create adjustment ────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/stock-adjustments', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['stock-adjustments']);
      queryClient.invalidateQueries(['items']);
      setLines([]);
      setNotes('');
      showToast('تم إنشاء التسوية بنجاح', 'success');
    },
    onError: (err) => showToast(err.response?.data?.message || 'خطأ', 'error'),
  });

  // ── Approve adjustment ────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: (id) => api.post(`/stock-adjustments/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries(['stock-adjustments']);
      queryClient.invalidateQueries(['items']);
      showToast('تم اعتماد التسوية بنجاح', 'success');
    },
    onError: (err) => showToast(err.response?.data?.message || 'خطأ', 'error'),
  });

  // ── Delete adjustment ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/stock-adjustments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['stock-adjustments']);
      showToast('تم حذف التسوية بنجاح', 'success');
    },
    onError: (err) => showToast(err.response?.data?.message || 'خطأ', 'error'),
  });

  const addLine = (item) => {
    // ✅ Decimal-safe: get current stock values
    const stock = item.stock?.[warehouse] || { quantity: 0, weight: 0 };

    const newLine = {
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      unit: item.unit,
      systemQty: safeNum(stock.quantity),      // ✅ Decimal from backend
      systemWeight: safeNum(stock.weight),      // ✅ Decimal from backend
      actualQty: safeNum(stock.quantity),      // Default to system qty
      actualWeight: safeNum(stock.weight),      // Default to system weight
      diffQty: 0,
      diffWeight: 0,
      notes: '',
    };
    setLines([...lines, newLine]);
  };

  const updateLine = (index, field, value) => {
    const updated = [...lines];
    const line = updated[index];

    // ✅ Decimal-safe: parse input before storing
    const parsedValue = parseDecimalFromInput(value);
    line[field] = parsedValue;

    // Recalculate diffs
    if (field === 'actualQty') {
      line.diffQty = round3(parsedValue - line.systemQty);
    }
    if (field === 'actualWeight') {
      line.diffWeight = round3(parsedValue - line.systemWeight);
    }

    updated[index] = line;
    setLines(updated);
  };

  const removeLine = (index) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!lines.length) {
      showToast('أضف صنف واحد على الأقل', 'warning');
      return;
    }

    // ✅ Decimal-safe: ensure all qty values are numbers before sending
    const payload = {
      warehouse,
      notes,
      lines: lines.map(line => ({
        itemId: line.itemId,
        actualQty: safeNum(line.actualQty),
        actualWeight: safeNum(line.actualWeight),
        notes: line.notes,
      })),
    };

    createMutation.mutate(payload);
  };

  const handleApprove = (adj) => {
    confirm({
      title: 'اعتماد التسوية',
      message: `هل أنت متأكد من اعتماد التسوية "${adj.refNumber}"؟`,
      onConfirm: () => approveMutation.mutate(adj.id),
    });
  };

  const handleDelete = (adj) => {
    confirm({
      title: 'حذف التسوية',
      message: `هل أنت متأكد من حذف التسوية "${adj.refNumber}"؟`,
      onConfirm: () => deleteMutation.mutate(adj.id),
    });
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">تسوية المخزون</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(false)}
            className={`px-4 py-2 rounded ${!showHistory ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            تسوية جديدة
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`px-4 py-2 rounded ${showHistory ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            سجل التسويات
          </button>
        </div>
      </div>

      {!showHistory ? (
        <>
          {/* Warehouse selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">المخزن</label>
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className="border rounded px-3 py-2 w-full md:w-64"
            >
              {WAREHOUSES.map(w => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* Item search */}
          <div className="mb-4">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="بحث بكود أو اسم الصنف..."
            />
            {itemsLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded">
                {itemsData?.items?.map(item => (
                  <div
                    key={item.id}
                    onClick={() => addLine(item)}
                    className="p-2 hover:bg-gray-100 cursor-pointer border-b flex justify-between"
                  >
                    <span>{item.code} — {item.name}</span>
                    <span className="text-gray-500 text-sm mr-2">
                      رمسيس: {formatQty(item.stock?.ramses?.quantity)} | 
                      أكتوبر: {formatQty(item.stock?.october?.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lines table */}
          {lines.length > 0 && (
            <div className="mb-4">
              <table className="w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">الكود</th>
                    <th className="p-2 border">الاسم</th>
                    <th className="p-2 border">الوحدة</th>
                    <th className="p-2 border">رصيد النظام</th>
                    <th className="p-2 border">الرصيد الفعلي</th>
                    <th className="p-2 border">الفرق</th>
                    <th className="p-2 border">ملاحظات</th>
                    <th className="p-2 border"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border">{line.itemCode}</td>
                      <td className="p-2 border">{line.itemName}</td>
                      <td className="p-2 border">{line.unit}</td>
                      <td className="p-2 border text-center">
                        {formatQty(line.systemQty)}
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          step="0.001"
                          value={line.actualQty}
                          onChange={(e) => updateLine(idx, 'actualQty', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-center"
                        />
                      </td>
                      <td className={`p-2 border text-center font-bold ${line.diffQty !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {line.diffQty > 0 ? '+' : ''}{formatQty(line.diffQty)}
                      </td>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={line.notes}
                          onChange={(e) => updateLine(idx, 'notes', e.target.value)}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <button
                          onClick={() => removeLine(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes & Submit */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">ملاحظات عامة</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              rows={2}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={createMutation.isLoading || !lines.length}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {createMutation.isLoading ? 'جاري الحفظ...' : 'حفظ التسوية'}
          </button>
        </>
      ) : (
        /* History view */
        <>
          {adjLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-4">
              {adjustmentsData?.adjustments?.map(adj => (
                <div key={adj.id} className="border rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold">{adj.refNumber}</span>
                      <span className="text-gray-500 text-sm mr-2">
                        {new Date(adj.date).toLocaleDateString('ar-EG')}
                      </span>
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">
                        {WAREHOUSES.find(w => w.value === adj.warehouse)?.label || adj.warehouse}
                      </span>
                      {adj.approvedAt && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">
                          معتمد
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!adj.approvedAt && (
                        <button
                          onClick={() => handleApprove(adj)}
                          disabled={approveMutation.isLoading}
                          className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                        >
                          اعتماد
                        </button>
                      )}
                      {!adj.approvedAt && (
                        <button
                          onClick={() => handleDelete(adj)}
                          disabled={deleteMutation.isLoading}
                          className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-1 border">الكود</th>
                        <th className="p-1 border">الاسم</th>
                        <th className="p-1 border">رصيد النظام</th>
                        <th className="p-1 border">الرصيد الفعلي</th>
                        <th className="p-1 border">الفرق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adj.lines?.map((line, i) => (
                        <tr key={i}>
                          <td className="p-1 border">{line.itemCode}</td>
                          <td className="p-1 border">{line.itemName}</td>
                          <td className="p-1 border text-center">{formatQty(line.systemQty)}</td>
                          <td className="p-1 border text-center">{formatQty(line.actualQty)}</td>
                          <td className={`p-1 border text-center font-bold ${safeNum(line.diffQty) !== 0 ? 'text-red-600' : ''}`}>
                            {safeNum(line.diffQty) > 0 ? '+' : ''}{formatQty(line.diffQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {adj.notes && (
                    <p className="text-gray-500 text-sm mt-2">ملاحظات: {adj.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StockAdjustmentPage;
