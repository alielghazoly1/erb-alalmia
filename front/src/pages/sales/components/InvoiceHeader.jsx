import CustomerSearch from './CustomerSearch';

export default function InvoiceHeader({
  docNumber, docError, docChecking,
  date, warehouse,
  notes, customer, customerError,
  docRef, customerRef,
  customerKey,
  onDocChange, onDocKeyDown,
  onDateChange, onWarehouseChange,
  onNotesChange,
  onCustomerSelect, onEnterEmpty,
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 pb-4 border-b border-gray-100">
      {/* رقم المستند */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">رقم المستند *</label>
        <input
          ref={docRef}
          className={`input-field ${docError ? 'border-red-500 ring-2 ring-red-100' : ''}`}
          placeholder="أدخل الرقم..."
          value={docNumber}
          onChange={e => onDocChange(e.target.value)}
          onKeyDown={onDocKeyDown}
        />
        {docChecking && <p className="text-xs text-gray-400 mt-0.5">جاري التحقق...</p>}
        {docError    && <p className="text-xs text-red-500 mt-0.5">{docError}</p>}
      </div>

      {/* التاريخ */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">التاريخ</label>
        <input
          type="date"
          className="input-field"
          value={date}
          onChange={e => onDateChange(e.target.value)}
        />
      </div>

      {/* المخزن */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">المخزن</label>
        <select className="input-field" value={warehouse} onChange={e => onWarehouseChange(e.target.value)}>
          <option value="ramses">رمسيس</option>
          <option value="october">أكتوبر</option>
        </select>
      </div>

      {/* العميل */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">العميل *</label>
        <CustomerSearch
          key={customerKey}
          inputRef={customerRef}
          onSelect={onCustomerSelect}
          onEnterEmpty={onEnterEmpty}
          error={customerError}
          defaultValue={customer?.name || ''}
        />
        {customer && (
          <p className="text-xs mt-0.5 font-medium text-green-600">✓ {customer.name}</p>
        )}
      </div>

      {/* ملاحظات */}
      <div className="md:col-span-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">ملاحظات (اختياري)</label>
        <input
          className="input-field"
          placeholder="أي ملاحظات إضافية..."
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
        />
      </div>
    </div>
  );
}
