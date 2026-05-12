export default function ListFormModal({ title, name, setName, desc, setDesc, onSave, onClose, saveLabel = '✅ حفظ' }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">اسم القائمة *</label>
            <input
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="قائمة رمضان 2026..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">الوصف</label>
            <input
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="وصف اختياري..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onSave} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors">
              {saveLabel}
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-colors">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
