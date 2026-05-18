import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

import { useSaleInvoiceForm } from './hooks/useSaleInvoiceForm';
import InvoiceHeader         from './components/InvoiceHeader';
import PaymentSection        from './components/PaymentSection';
import ItemsTable            from './components/ItemsTable';
import ItemInputRow          from './components/ItemInputRow';
import InvoiceTotals         from './components/InvoiceTotals';
import AdminSearchPanel      from './components/AdminSearchPanel';
import CustomerBalanceCard   from './components/CustomerBalanceCard';
import InvoicePrintView      from './components/InvoicePrintView';

const statusLabel = {
  approved:  { text: 'مُوافق',  cls: 'bg-green-100 text-green-700' },
  pending:   { text: 'معلق',    cls: 'bg-yellow-100 text-yellow-700' },
  suspended: { text: 'موقوف',   cls: 'bg-orange-100 text-orange-700' },
  cancelled: { text: 'ملغي',    cls: 'bg-red-100 text-red-700' },
};

export default function SaleInvoicePage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const location   = useLocation();
  const isViewMode = !!id;

  // ── قراءة back URL من location.state (لما بنيجي من كشف حساب عميل) ────────
  const backTo    = location.state?.backTo;
  const backLabel = location.state?.backLabel || 'رجوع';

  const handleBack = () => {
    if (backTo) navigate(backTo);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/sales');
  };

  // ── view mode ─────────────────────────────────────────────────────────────
  const [existingInvoice, setExistingInvoice] = useState(null);
  useEffect(() => {
    if (!isViewMode) return;
    api.get(`/sales/${id}`)
      .then(({ data }) => setExistingInvoice(data))
      .catch(() => toast.error('خطأ في تحميل الفاتورة'));
  }, [isViewMode, id]);

  const form = useSaleInvoiceForm();

  // ── view mode: عرض الفاتورة في صفحة بـ URL مستقل ──────────────────────────
  if (isViewMode) {
    if (!existingInvoice) return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400 gap-4">
        <svg className="animate-spin w-10 h-10 text-blue-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p>جاري تحميل الفاتورة...</p>
      </div>
    );
    return (
      <div>
        {/* شريط العودة */}
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors font-medium"
          >
            ← {backLabel}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-mono">{existingInvoice.invoiceNumber}</span>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              🖨️ طباعة
            </button>
          </div>
        </div>
        <InvoicePrintView
          invoice={{
            ...existingInvoice,
            customerName: existingInvoice.customerName || existingInvoice.customer?.name,
            customerCode: existingInvoice.customerCode || existingInvoice.customer?.code,
          }}
          onBack={handleBack}
          backLabel={backLabel}
          embedded
        />
      </div>
    );
  }

  // ── print preview ─────────────────────────────────────────────────────────
  if (form.showPrint && form.savedRows.length > 0) {
    return (
      <InvoicePrintView
        invoice={{
          invoiceNumber: form.editingInvoice ? form.editingInvoice.invoiceNumber : `[مسودة] ${form.docNumber}`,
          docNumber: form.docNumber, date: form.date, warehouse: form.warehouse,
          customerName: form.customer?.name, customerCode: form.customer?.code,
          items: form.savedRows.map(r => ({
            itemCode: r.itemCode, itemName: r.itemName,
            quantity: Number(r.quantity), weight: Number(r.weight), price: Number(r.price),
          })),
          totalAmount: form.totalAmount,
          paymentMethod: form.paymentMethod,
          cashAmount: form.cashAmount, instapayAmount: form.instapayAmount, paidAmount: form.paidAmount,
          createdAt: new Date().toISOString(), createdBy: form.user,
        }}
        onBack={() => form.setShowPrint(false)}
      />
    );
  }

  const inputRows = form.rows.filter(r => !r.saved);

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── هيدر الصفحة ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {form.editingInvoice ? `✏️ تعديل — ${form.editingInvoice.invoiceNumber}` : 'فاتورة مبيعات جديدة'}
          </h1>
          {form.editingInvoice && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel[form.editingInvoice.status]?.cls || 'bg-gray-100 text-gray-500'}`}>
                {statusLabel[form.editingInvoice.status]?.text || form.editingInvoice.status}
              </span>
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                ⚠️ بعد الحفظ ستصبح معلقة وتحتاج موافقة جديدة
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {form.editingInvoice && (
            <button onClick={form.cancelEdit} className="btn-secondary text-sm">× إلغاء</button>
          )}

          <button className="btn-secondary" onClick={() => form.setShowPrint(true)}>🖨️ معاينة</button>
          <button
            className={`btn-primary ${form.editingInvoice ? '!bg-amber-600 hover:!bg-amber-700' : ''}`}
            onClick={form.handleSubmit}
            disabled={form.saving || form.savedRows.length === 0 || !!form.docError}
          >
            {form.saving ? 'جاري الحفظ...'
              : form.editingInvoice ? `💾 حفظ التعديل (${form.savedRows.length} صنف)`
              : `💾 حفظ (${form.savedRows.length} صنف)`}
          </button>
        </div>
      </div>

      {/* ── بطاقة البيع بالسالب ──────────────────────────────────────────── */}
      {/* تظهر لأي شخص عنده الصلاحية (أدمن أو يوزر) — القيمة الفعلية من الـ permissions */}
      {form.canNegativeSale && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
          <span className="text-base">➖</span>
          <span>البيع بالسالب <strong>مفعّل</strong></span>
        </div>
      )}

      {/* ── بحث عن فاتورة للتعديل — للأدمن واليوزر اللي عنده canEditInvoice ── */}
      {form.canEditInvoice && !form.editingInvoice && (
        <AdminSearchPanel
          show={form.showAdminSearch}
          onToggle={() => form.setShowAdminSearch(v => !v)}
          searchQuery={form.searchQuery}
          searchResults={form.searchResults}
          searchLoading={form.searchLoading}
          onSearchChange={form.handleSearchChange}
          onLoadForEdit={form.loadForEdit}
        />
      )}

      {/* ── سبب التعديل ───────────────────────────────────────────────────── */}
      {form.editingInvoice && (
        <div className="card mb-4 border-2 border-amber-200 bg-amber-50">
          <label className="block text-sm font-semibold text-amber-700 mb-1">📝 سبب التعديل (اختياري)</label>
          <input className="input-field" placeholder="مثلاً: تصحيح سعر..."
            value={form.editNotes} onChange={e => form.setEditNotes(e.target.value)} />
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {/* ── بطاقة الفاتورة الرئيسية ─────────────────────────────────── */}
          <div className="card mb-4 border-2 border-blue-100">
            <InvoiceHeader
              docNumber={form.docNumber}   docError={form.docError}  docChecking={form.docChecking}
              date={form.date}             warehouse={form.warehouse}
              notes={form.notes}           customer={form.customer}  customerError={form.customerError}
              docRef={form.docRef}         customerRef={form.customerRef}
              customerKey={form.customerKey.current}
              onDocChange={form.handleDocChange}
              onDocKeyDown={form.handleDocKeyDown}
              onDateChange={form.setDate}
              onWarehouseChange={form.setWarehouse}
              onNotesChange={form.setNotes}
              onCustomerSelect={form.handleCustomerSelect}
              onEnterEmpty={form.focusItemSearch}
            />

            <PaymentSection
              isCash={form.isCash}         isMixed={form.isMixed}
              paymentMethod={form.paymentMethod}
              cashAmount={form.cashAmount} instapayAmount={form.instapayAmount}
              totalAmount={form.totalAmount} paidAmount={form.paidAmount} remaining={form.remaining}
              customer={form.customer}
              onMethodChange={(v) => { form.setPaymentMethod(v); form.setCashAmount(''); form.setInstapayAmount(''); }}
              onCashChange={form.setCashAmount}
              onInstapayChange={form.setInstapayAmount}
            />

            <ItemsTable
              savedRows={form.savedRows}
              totalAmount={form.totalAmount}
              totalWeightAll={form.totalWeightAll}
              onEditRow={form.handleEditRow}
              onDeleteRow={form.handleDeleteRow}
            />

            {inputRows.map(row => (
              <ItemInputRow
                key={row.id}
                row={row}
                totalWeightInput={form.totalWeightInput}
                itemRefs={form.itemRefs}
                qtyRefs={form.qtyRefs}
                wtRefs={form.wtRefs}
                prRefs={form.prRefs}
                onItemSelect={form.handleItemSelect}
                onUpdateRow={form.updateRow}
                onTotalWeightChange={form.handleTotalWeightChange}
                onKeyDown={form.handleKeyDown}
                onSaveRow={form.handleSaveRow}
                onCancelRow={form.handleCancelRow}
              />
            ))}
          </div>

          <InvoiceTotals
            savedRows={form.savedRows}
            totalAmount={form.totalAmount}   totalWeightAll={form.totalWeightAll}
            isCash={form.isCash}             isMixed={form.isMixed}
            paymentMethod={form.paymentMethod}
            cashAmount={form.cashAmount}     instapayAmount={form.instapayAmount}
            paidAmount={form.paidAmount}     remaining={form.remaining}
          />
        </div>

        {/* ── كشف حساب العميل الآجل ───────────────────────────────────────── */}
        {!form.isCash && (
          <CustomerBalanceCard customer={form.customer} balance={form.customerBalance} />
        )}
      </div>
    </div>
  );
}
