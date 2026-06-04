// front/src/pages/stock/StockAdjustmentPage.jsx
// صفحة تسوية المخزون — معالجة آمنة للقيم العشرية (Decimal)
// ✅ UPDATED    : All qty/weight fields use parseDecimalFromInput() + formatQty()
// ✅ FIX-ADJ-UI-001: approveMutation — retry تلقائي عند 409 (Serializable conflict)
// ✅ FIX-ADJ-UI-002: عرض خطأ المخزون السالب (FIX-ADJ-003) بشكل واضح في الـ UI
// ✅ FIX-ADJ-UI-003: الفرق السالب يظهر بتحذير مرئي واضح قبل الإرسال

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
  { value: 'ramses',  label: 'رمسيس'  },
  { value: 'october', label: 'أكتوبر' },
];

// ── retry helper ──────────────────────────────────────────────────────────────
// ✅ FIX-ADJ-UI-001: retry تلقائي عند 409 (Serializable conflict)
const withRetry = async (fn, max = 3, delay = 150) => {
  for (let i = 1; i <= max; i++) {
    try { return await fn(); }
    catch (err) {
      if (err.response?.status === 409 && i < max) {
        await new Promise(r => setTimeout(r, delay * i));
        continue;
      }
      throw err;
    }
  }
};

const StockAdjustmentPage = () => {
  const { user }         = useAuth();
  const { showToast }    = useToast();
  const { confirm }      = useConfirm();
  const queryClient      = useQueryClient();

  const [warehouse,   setWarehouse]   = useState('ramses');
  const [search,      setSearch]      = useState('');
  const [lines,       setLines]       = useState([]);
  const [notes,       setNotes]       = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // ── Fetch items ──────────────────────────────────────────────────────────────
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
    queryFn:  async () => {
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
  // ✅ FIX-ADJ-UI-001: retry تلقائي عند 409 (Serializable conflict من السيرفر)
  const approveMutation = useMutation({
    mutationFn: (id) => withRetry(() => api.post(`/stock-adjustments/${id}/approve`)),
    onSuccess: () => {
      queryClient.invalidateQueries(['stock-adjustments']);
      queryClient.invalidateQueries(['items']);
      showToast('تم اعتماد التسوية بنجاح', 'success');
    },
    // ✅ FIX-ADJ-UI-002: خطأ المخزون السالب يظهر بدقة من السيرفر
    onError: (err) => showToast(err.response?.data?.message || 'خطأ في الاعتماد', 'error'),
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
    // منع التكرار
    if (lines.some(l => l.itemId === item.id)) {
      showToast(`"${item.name}" موجود بالفعل في التسوية`, 'warning');
      return;
    }
    const stock = item.stock?.[warehouse] || { quantity: 0, weight: 0 };
    setLines(prev => [...prev, {
      itemId:       item.id,
      itemCode:     item.code,
      itemName:     item.name,
      unit:         item.unit,
      systemQty:    safeNum(stock.quantity),
      systemWeight: safeNum(stock.weight),
      actualQty:    safeNum(stock.quantity),
      actualWeight: safeNum(stock.weight),
      diffQty:      0,
      diffWeight:   0,
      notes:        '',
    }]);
  };

  const updateLine = (index, field, value) => {
    setLines(prev => {
      const updated = [...prev];
      const line    = { ...updated[index] };
      const parsed  = parseDecimalFromInput(value);
      line[field]   = parsed;
      if (field === 'actualQty')    line.diffQty    = round3(parsed - line.systemQty);
      if (field === 'actualWeight') line.diffWeight = round3(parsed - line.systemWeight);
      updated[index] = line;
      return updated;
    });
  };

  const removeLine = (index) => setLines(lines.filter((_, i) => i !== index));

  // ✅ FIX-ADJ-UI-003: تحذير مرئي للفروق السالبة قبل الإرسال
  const hasNegativeDiff = lines.some(l => safeNum(l.diffWeight) < 0);

  const handleSubmit = () => {
    if (!lines.length) { showToast('أضف صنف واحد على الأقل', 'warning'); return; }

    const doSubmit = () => createMutation.mutate({
      warehouse,
      notes,
      lines: lines.map(line => ({
        itemId:       line.itemId,
        actualQty:    safeNum(line.actualQty),
        actualWeight: safeNum(line.actualWeight),
        notes:        line.notes,
      })),
    });

    // ✅ FIX-ADJ-UI-003: تأكيد إضافي لو في فروق سالبة
    if (hasNegativeDiff) {
      const negLines = lines
        .filter(l => safeNum(l.diffWeight) < 0)
        .map(l => `• ${l.itemName}: ${safeNum(l.diffWeight).toFixed(3)} ك`)
        .join('\n');
      confirm({
        title:   'تحذير — أصناف ستُطرح من المخزون',
        message: `الأصناف التالية سيُخفَّض مخزونها:\n${negLines}\n\nهل أنت متأكد؟`,
        onConfirm: doSubmit,
      });
    } else {
      doSubmit();
    }
  };

  const handleApprove = (adj) => {
    confirm({
      title:     'اعتماد التسوية',
      message:   `هل أنت متأكد من اعتماد التسوية "${adj.refNumber}"؟`,
      onConfirm: () => approveMutation.mutate(adj.id),
    });
  };

  const handleDelete = (adj) => {
    confirm({
      title:     'حذف التسوية',
      message:   `هل أنت متأكد من حذف التسوية "${adj.refNumber}"؟`,
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
            <SearchBar value={search} onChange={setSearch} placeholder="بحث بكود أو اسم الصنف..." />
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

          {/* ✅ FIX-ADJ-UI-003: تحذير مرئي للفروق السالبة */}
          {hasNegativeDiff && (
            <div className="mb-3 bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800">
              <span className="font-bold">⚠️ تنبيه:</span> بعض الأصناف ستُطرح من المخزون — تأكد من الأرقام قبل الحفظ.
            </div>
          )}

          {/* Lines table */}
          {lines.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">الكود</th>
                    <th className="p-2 border">الاسم</th>
                    <th className="p-2 border">الوحدة</th>
                    <th className="p-2 border">رصيد النظام (ك)</th>
                    <th className="p-2 border">الرصيد الفعلي (ك)</th>
                    <th className="p-2 border">الفرق (ك)</th>
                    <th className="p-2 border">ملاحظات</th>
                    <th className="p-2 border"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const isNeg = safeNum(line.diffWeight) < 0;
                    return (
                      <tr key={idx} className={isNeg ? 'bg-red-50' : ''}>
                        <td className="p-2 border">{line.itemCode}</td>
                        <td className="p-2 border">{line.itemName}</td>
                        <td className="p-2 border">{line.unit}</td>
                        <td className="p-2 border text-center">{formatQty(line.systemWeight)}</td>
                        <td className="p-2 border">
                          <input
                            type="number"
                            step="0.001"
                            value={line.actualWeight}
                            onChange={(e) => updateLine(idx, 'actualWeight', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-center"
                          />
                        </td>
                        <td className={`p-2 border text-center font-bold ${isNeg ? 'text-red-600' : safeNum(line.diffWeight) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {safeNum(line.diffWeight) > 0 ? '+' : ''}{formatQty(line.diffWeight)}
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
                          <button onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700">✕</button>
                        </td>
                      </tr>
                    );
                  })}
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
                          className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 disabled:bg-gray-400"
                        >
                          {approveMutation.isLoading ? 'جاري...' : 'اعتماد'}
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
                      {adj.lines?.map((line, i) => {
                        const diff = safeNum(line.diffWeight);
                        return (
                          <tr key={i}>
                            <td className="p-1 border">{line.itemCode}</td>
                            <td className="p-1 border">{line.itemName}</td>
                            <td className="p-1 border text-center">{formatQty(line.systemWeight)}</td>
                            <td className="p-1 border text-center">{formatQty(line.actualWeight)}</td>
                            <td className={`p-1 border text-center font-bold ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : ''}`}>
                              {diff > 0 ? '+' : ''}{formatQty(diff)}
                            </td>
                          </tr>
                        );
                      })}
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