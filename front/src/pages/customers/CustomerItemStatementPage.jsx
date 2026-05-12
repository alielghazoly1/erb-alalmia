// ─── CustomerItemStatementPage.jsx ──────────────────────────────────────────
// صفحة كشف صنف معين عند عميل — مع طباعة
// Orchestrator فقط — كل المنطق في الـ hook والمكوّنات
// ────────────────────────────────────────────────────────────────────────────
import { useRef }            from 'react';
import { Link }              from 'react-router-dom';
import { useReactToPrint }   from 'react-to-print';

// Hook
import { useCustomerItemStatement } from './hooks/useCustomerItemStatement';

// مكوّنات مشتركة من المشروع
import CustomerSearch from '../../components/common/CustomerSearch';
import ItemSearch     from '../../components/common/ItemSearch';

// مكوّنات محلية
import PrintHeader           from './components/PrintHeader';
import ItemStatementSummary  from './components/ItemStatementSummary';
import ItemMovementsTable    from './components/ItemMovementsTable';

export default function CustomerItemStatementPage() {
  const stmt = useCustomerItemStatement();

  // ── الطباعة ───────────────────────────────────────────────────────────────
  const printRef  = useRef(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `كشف صنف — ${stmt.customer?.name || ''} — ${stmt.item?.name || ''}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 10mm; }
      @media print { body { font-size: 10px; direction: rtl; } }
    `,
  });

  return (
    <div>

      {/* ── هيدر الصفحة ── */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/customers" className="text-gray-400 hover:text-gray-600">
          ← العملاء
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">كشف صنف عند عميل</h1>
      </div>

      {/* ── اختيار العميل والصنف ── */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* العميل */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اختر العميل
            </label>
            <CustomerSearch
              value={stmt.customer}
              onSelect={stmt.selectCustomer}
            />
          </div>

          {/* الصنف */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              اختر الصنف
            </label>
            <ItemSearch
              value={stmt.item}
              onSelect={stmt.selectItem}
            />
          </div>
        </div>
      </div>

      {/* ── زر الطباعة — يظهر بعد اختيار العميل والصنف ── */}
      {stmt.customer && stmt.item && (
        <div className="flex justify-end mb-4 print:hidden">
          <button onClick={handlePrint} className="btn-secondary text-sm">
            🖨️ طباعة
          </button>
        </div>
      )}

      {/* ── منطقة الطباعة ── */}
      <div ref={printRef}>

        {/* رأس الكشف في الطباعة */}
        {stmt.customer && stmt.item && (
          <PrintHeader
            customer={stmt.customer}
            seasonName={null}
          />
        )}

        {/* ── اسم الصنف والعميل (شاشة وطباعة) ── */}
        {stmt.customer && stmt.item && (
          <div className="card mb-4 print:shadow-none print:border">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-gray-400 text-xs">العميل</span>
                <p className="font-bold text-gray-800 text-base">
                  {stmt.customer.name}
                  <span className="text-gray-400 font-normal mr-2 text-sm">
                    ({stmt.customer.code})
                  </span>
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">الصنف</span>
                <p className="font-bold text-gray-800 text-base">
                  {stmt.item.name}
                  <span className="text-gray-400 font-normal mr-2 text-sm">
                    ({stmt.item.code})
                  </span>
                </p>
              </div>
              {stmt.item.unit && (
                <div>
                  <span className="text-gray-400 text-xs">الوحدة</span>
                  <p className="font-medium text-gray-700">{stmt.item.unit}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── تحميل ── */}
        {stmt.loading && (
          <div className="text-center py-16 text-gray-400 text-lg">
            جاري التحميل...
          </div>
        )}

        {/* ── النتائج ── */}
        {!stmt.loading && stmt.data && (
          <>
            {/* كروت الملخص */}
            <ItemStatementSummary data={stmt.data} />

            {/* جدول الحركات */}
            <div className="card print:shadow-none print:border">
              <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b flex items-center justify-between">
                <span>
                  الحركات
                  <span className="text-gray-400 font-normal text-sm mr-2">
                    ({stmt.data.movements?.length || 0} حركة)
                  </span>
                </span>
              </h3>
              <ItemMovementsTable
                movements={stmt.data.movements}
                calcTotalWeight={stmt.calcTotalWeight}
                calcTotal={stmt.calcTotal}
              />
            </div>

            {/* تذييل الطباعة */}
            <div className="hidden print:block mt-6 pt-4 border-t text-center text-xs text-gray-400">
              تم الطباعة بتاريخ {new Date().toLocaleDateString('ar-EG')}
            </div>
          </>
        )}

        {/* ── حالة لم يتم الاختيار بعد ── */}
        {!stmt.loading && !stmt.data && stmt.customer && stmt.item && (
          <div className="text-center py-12 text-gray-400">
            لا يوجد حركات لهذا الصنف عند هذا العميل
          </div>
        )}

        {/* ── لم يتم اختيار العميل أو الصنف بعد ── */}
        {(!stmt.customer || !stmt.item) && !stmt.loading && (
          <div className="text-center py-16 text-gray-400">
            اختر العميل والصنف لعرض الكشف
          </div>
        )}
      </div>
    </div>
  );
}
