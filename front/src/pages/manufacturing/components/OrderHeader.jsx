// ─── components/OrderHeader.jsx ──────────────────────────────────────────────
//  بيانات رأس الأمر (التاريخ، العنبر، المعلم، الموسم، الملاحظات)
// ─────────────────────────────────────────────────────────────────────────────
import SeasonSelector from './SeasonSelector';

export default function OrderHeader({
  isEdit, date, docNumber, warehouse, workerId, notes, seasonId,
  filteredWorkers, whLabel,
  setDate, setDocNumber, setWarehouse, setWorkerId, setNotes, setSeasonId,
}) {
  return (
    <div className="card mb-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
        بيانات الأمر
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

        {/* التاريخ */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">التاريخ</label>
          <input
            type="date"
            className="input-field"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* رقم المستند */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            رقم المستند <span className="text-xs text-gray-400">(اختياري)</span>
          </label>
          <input
            className="input-field font-mono"
            placeholder="مثال: 1234"
            value={docNumber}
            onChange={e => setDocNumber(e.target.value)}
          />
        </div>

        {/* العنبر */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">العنبر *</label>
          <select
            className="input-field"
            value={warehouse}
            onChange={e => { setWarehouse(e.target.value); setWorkerId(''); }}
          >
            <option value="ramses">🏭 رمسيس</option>
            <option value="october">🏭 أكتوبر</option>
          </select>
        </div>

        {/* المعلم */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            معلم العنبر <span className="text-xs text-gray-400">({whLabel})</span>
          </label>
          <select
            className="input-field"
            value={workerId}
            onChange={e => setWorkerId(e.target.value)}
          >
            <option value="">— بدون تحديد —</option>
            {filteredWorkers.map(w => (
              <option key={w._id} value={w._id}>{w.name} ({w.code})</option>
            ))}
          </select>
          {filteredWorkers.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">⚠️ مفيش معلمين لعنبر {whLabel}</p>
          )}
        </div>

        {/* الموسم — فقط في الإنشاء */}
        {!isEdit && (
          <div>
            <SeasonSelector value={seasonId} onChange={setSeasonId} />
            <p className="text-xs text-gray-400 mt-1">فاضي = الموسم النشط</p>
          </div>
        )}

        {/* الملاحظات */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">ملاحظات</label>
          <input
            className="input-field"
            placeholder="اختياري..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

      </div>

      {/* تنبيه العنبر */}
      <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg inline-flex items-center gap-2">
        <span className="text-amber-600">🏭</span>
        <span className="text-xs text-amber-700">
          الخامات ستُخصم من <b>{whLabel}</b> والمنتجات ستُضاف إلى <b>{whLabel}</b>
        </span>
      </div>
    </div>
  );
}
