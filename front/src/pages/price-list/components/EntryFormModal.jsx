import { useState } from 'react';
import ItemSearch from '../../../components/common/ItemSearch';
import api from '../../../services/api';

/**
 * EntryFormModal
 * مودال إنشاء/تعديل صف في قائمة الأسعار
 *
 * entry (اختياري) = الصف الموجود عند التعديل
 */
export default function EntryFormModal({ selectedListName, listDescription, entry, onSave, onClose }) {
  const isEdit = !!entry;

  const [displayName, setDisplayName] = useState(entry?.displayName || '');
  const [origin,      setOrigin]      = useState(entry?.origin || '');
  const [unit,        setUnit]        = useState(entry?.unit || '');
  const [notes,       setNotes]       = useState(entry?.notes || '');
  const [prices,      setPrices]      = useState(
    entry?.prices?.length ? entry.prices.map(p => ({ label: p.label, price: String(p.price) }))
                          : [{ label: 'سعر البيع', price: '' }],
  );
  // الأصناف المرتبطة [{itemId, itemName, itemCode}]
  const [linkedItems, setLinkedItems] = useState(
    entry?.linkedItems?.map(li => ({ itemId: String(li.item), itemName: li.itemName, itemCode: li.itemCode })) || [],
  );
  const [saving, setSaving] = useState(false);
  const [lpInfo, setLpInfo] = useState(null);   // آخر سعر توريد

  // لما بيختار صنف جديد نجلب آخر سعر توريده
  const handleAddItem = async (item) => {
    if (!item) return;
    if (linkedItems.some(li => li.itemId === item._id)) return; // مكررة
    setLinkedItems(prev => [...prev, { itemId: item._id, itemName: item.name, itemCode: item.code }]);
    // جلب آخر سعر توريد للصنف الأول فقط (hint)
    if (linkedItems.length === 0) {
      try {
        const { data } = await api.get(`/price-list/item-with-purchase/${item._id}`,
          selectedListName ? { params: { listName: selectedListName } } : {},
        );
        if (data?.lastPurchaseInfo) setLpInfo(data.lastPurchaseInfo);
        if (data?.priceEntry && !isEdit) {
          setPrices(data.priceEntry.prices.map(p => ({ label: p.label, price: String(p.price) })));
          setOrigin(data.priceEntry.origin || origin);
        }
      } catch {}
    }
  };

  const removeItem = (itemId) => setLinkedItems(prev => prev.filter(li => li.itemId !== itemId));

  const handleSave = async () => {
    if (!displayName.trim()) return alert('أدخل الاسم الظاهر في القائمة');
    if (prices.some(p => p.price === '' || p.price === undefined)) return alert('أكمل الأسعار');
    setSaving(true);
    try {
      await onSave({
        entryId:       isEdit ? entry._id : undefined,
        priceListName: selectedListName,
        description:   listDescription,
        displayName:   displayName.trim(),
        origin:        origin.trim(),
        unit:          unit.trim(),
        notes:         notes.trim(),
        prices:        prices.map(p => ({ label: p.label, price: Number(p.price) })),
        linkedItems:   linkedItems.map(li => ({ itemId: li.itemId })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-12 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mb-12">

        {/* ─── header ─── */}
        <div className="sticky top-0 bg-white rounded-t-2xl flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? '✏️ تعديل صف' : '➕ إضافة صف جديد'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">في قائمة "{selectedListName}"</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
        </div>

        {/* ─── body ─── */}
        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* الاسم الظاهر */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              الاسم الظاهر في القائمة <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-sm font-medium"
              placeholder="مثال: قمرالدين وفير، كاجو فيتنامي 320 ..."
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoFocus
            />
          </div>

          {/* صف: منشأ + وحدة */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">المنشأ</label>
              <input
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                placeholder="سوريا، مصر، الهند..."
                value={origin}
                onChange={e => setOrigin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">الوحدة</label>
              <input
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                placeholder="20لفة، 10ك، 25ك..."
                value={unit}
                onChange={e => setUnit(e.target.value)}
              />
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">ملاحظات</label>
            <input
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
              placeholder="أي ملاحظة إضافية..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* الأسعار */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-gray-700">
                الأسعار <span className="text-red-500">*</span>
              </label>
              <button
                onClick={() => setPrices(p => [...p, { label: '', price: '' }])}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold"
              >
                ➕ أضف سعر
              </button>
            </div>

            {lpInfo && (
              <div className="mb-2 text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-blue-700">📦 آخر سعر توريد: <strong>{lpInfo.price?.toFixed(2)} ج</strong> — {lpInfo.supplierName}</span>
                <button
                  onClick={() => setPrices(p => p.map((x, i) => i === 0 ? { ...x, price: String(lpInfo.price) } : x))}
                  className="text-blue-600 hover:text-blue-900 font-bold"
                >
                  استخدم
                </button>
              </div>
            )}

            <div className="space-y-2">
              {prices.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                    placeholder="اسم السعر (مثال: سعر الجملة)"
                    value={p.label}
                    onChange={e => {
                      const u = [...prices]; u[i] = { ...u[i], label: e.target.value }; setPrices(u);
                    }}
                  />
                  <div className="relative w-32">
                    <input
                      type="number"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-center text-sm font-bold"
                      placeholder="0"
                      value={p.price}
                      onChange={e => {
                        const u = [...prices]; u[i] = { ...u[i], price: e.target.value }; setPrices(u);
                      }}
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">ج</span>
                  </div>
                  {prices.length > 1 && (
                    <button onClick={() => setPrices(prices.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 text-lg">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ربط الأصناف */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              الأصناف المرتبطة
              <span className="text-xs font-normal text-gray-500 mr-2">
                (لما بيُباع أي صنف من دول هيجيب سعره تلقائياً في فاتورة المبيعات)
              </span>
            </label>

            <ItemSearch
              onSelect={handleAddItem}
              placeholder="ابحث عن صنف وأضفه..."
            />

            {linkedItems.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {linkedItems.map(li => (
                  <div
                    key={li.itemId}
                    className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    <span className="font-mono text-blue-500">{li.itemCode}</span>
                    <span>{li.itemName}</span>
                    <button onClick={() => removeItem(li.itemId)} className="text-blue-400 hover:text-red-500 font-bold">✕</button>
                  </div>
                ))}
              </div>
            )}

            {linkedItems.length === 0 && (
              <p className="text-xs text-gray-400 mt-1.5">
                يمكن ترك هذا فارغاً — الصف سيظهر في القائمة للطباعة فقط دون ربط بفاتورة
              </p>
            )}
          </div>
        </div>

        {/* ─── footer ─── */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 bg-gray-50 rounded-b-2xl">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold transition-colors"
          >
            {saving ? '⏳ جاري الحفظ...' : isEdit ? '✅ حفظ التعديل' : '✅ إضافة للقائمة'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
