import ItemSearch from '../../../components/common/ItemSearch';

export default function AddItemModal({
  selectedListName, addItem, addPrices, setAddPrices,
  addOrigin, setAddOrigin, lastPurchase, loadingLP,
  onItemSelect, onSave, onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mb-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">إضافة صنف لـ "{selectedListName}"</h2>
            <p className="text-xs text-gray-500 mt-1">أدخل البيانات الكاملة للصنف</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* اختيار الصنف */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الصنف *</label>
            <ItemSearch onSelect={onItemSelect} placeholder="ابحث عن الصنف..." />
            {addItem && (
              <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                <span>✓</span>
                <span className="font-medium">{addItem.name}</span>
                <span className="text-gray-600">({addItem.code})</span>
              </div>
            )}
          </div>

          {loadingLP && (
            <div className="text-xs text-gray-500 text-center py-3 bg-gray-50 rounded-lg animate-pulse">
              جاري جلب آخر سعر توريد...
            </div>
          )}

          {lastPurchase && !loadingLP && (
            <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-blue-800">📦 آخر سعر توريد</p>
                <button
                  onClick={() =>
                    setAddPrices((prev) =>
                      prev.map((p, i) => i === 0 ? { ...p, price: String(lastPurchase.price) } : p),
                    )
                  }
                  className="text-xs text-blue-700 hover:text-blue-900 font-bold"
                >
                  استخدم السعر
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-2 rounded">
                  <p className="text-gray-600 font-bold">السعر</p>
                  <p className="text-blue-800 font-bold text-base">{lastPurchase.price?.toFixed(2)}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-gray-600">المورد</p>
                  <p className="text-gray-800 font-medium">{lastPurchase.supplierName}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-gray-600">التاريخ</p>
                  <p className="text-gray-800 font-medium">
                    {new Date(lastPurchase.date).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* بلد المنشأ */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">بلد المنشأ</label>
            <input
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="مثلاً: مصر، الهند..."
              value={addOrigin}
              onChange={(e) => setAddOrigin(e.target.value)}
            />
          </div>

          {/* الأسعار */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">
                الأسعار *
                <span className="text-xs text-gray-400 mr-2 font-normal">
                  (اسم السعر يظهر في فاتورة المبيعات)
                </span>
              </label>
              <button
                onClick={() => setAddPrices([...addPrices, { label: '', price: '' }])}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold"
              >
                ➕ سعر آخر
              </button>
            </div>
            <div className="space-y-2">
              {addPrices.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                    placeholder="اسم السعر (مثال: سعر الجملة)"
                    value={p.label}
                    onChange={(e) => {
                      const upd = [...addPrices];
                      upd[i] = { ...upd[i], label: e.target.value };
                      setAddPrices(upd);
                    }}
                  />
                  <div className="relative w-28">
                    <input
                      type="number"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-center text-sm"
                      placeholder="0.00"
                      value={p.price}
                      onChange={(e) => {
                        const upd = [...addPrices];
                        upd[i] = { ...upd[i], price: e.target.value };
                        setAddPrices(upd);
                      }}
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">ج</span>
                  </div>
                  {addPrices.length > 1 && (
                    <button
                      onClick={() => setAddPrices(addPrices.filter((_, j) => j !== i))}
                      className="text-red-600 hover:text-red-800 font-bold text-lg"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onSave} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors">
            ✅ إضافة للقائمة
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded-lg font-bold transition-colors">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
