// ─── pages/suppliers/SuppliersPage.jsx ───────────────────────────────────────
// الصفحة الرئيسية لإدارة الموردين — orchestrator نظيف
// كل المنطق موزع على hooks مستقلة — الصفحة نفسها قصيرة وواضحة
// ────────────────────────────────────────────────────────────────────────────
import { useEffect }          from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSuppliers, deleteSupplier } from '../../store/slices/supplierSlice';
import toast from 'react-hot-toast';
import { fmt } from './supplierUtils';

// Hooks
import { useSupplierFilters }       from './hooks/useSupplierFilters';
import { useSupplierForm }          from './hooks/useSupplierForm';
import { useSupplierInitialBalance } from './hooks/useSupplierInitialBalance';
import { useSupplierStatement }     from './hooks/useSupplierStatement';


// Components
import SupplierFilters              from './components/SupplierFilters';
import SupplierTable                from './components/SupplierTable';
import SupplierFormModal            from './components/SupplierFormModal';
import SupplierStatementModal       from './components/SupplierStatementModal';
import SupplierInitialBalanceModal  from './components/SupplierInitialBalanceModal';



export default function SuppliersPage() {
  const dispatch = useDispatch();
  const { list, loading } = useSelector((s) => s.suppliers);
  const { user }          = useSelector((s) => s.auth);
  const isAdmin           = user?.role === 'admin';

  // ── تحميل الموردين عند الدخول ────────────────────────────────────────────
  useEffect(() => { dispatch(fetchSuppliers()); }, [dispatch]);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const filters     = useSupplierFilters(list);
  const form        = useSupplierForm();
const initBalance = useSupplierInitialBalance(() =>
  dispatch(fetchSuppliers({ seasonId: undefined }))
);  const statement   = useSupplierStatement();

  // ── حذف المورد ───────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('هتحذف المورد ده؟')) return;
    await dispatch(deleteSupplier(id));
    toast.success('تم الحذف');
  };

  return (
    <div>

      {/* ── الهيدر ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">الموردين</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filters.filtered.length} مورد
            {filters.onlyDebtors && ' (عليهم فلوس)'}
            {' • '}المستحق له:{' '}
            <span className={`font-bold ml-1 ${filters.totals.owedToUs > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
              {fmt(filters.totals.owedToUs)} ج.م
            </span>
            {' • '}المستحق عليه:{' '}
            <span className={`font-bold ml-1 ${filters.totals.owedByUs > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {fmt(filters.totals.owedByUs)} ج.م
            </span>
          </p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={form.openCreate}>
            + إضافة مورد
          </button>
        )}
      </div>

      {/* ── الفلاتر ── */}
      <SupplierFilters
        search={filters.search}           setSearch={filters.setSearch}
        onlyDebtors={filters.onlyDebtors} setOnlyDebtors={filters.setOnlyDebtors}
      />

      {/* ── الجدول ── */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
        ) : (
          <SupplierTable
            paginated={filters.paginated}
            filtered={filters.filtered}
            totals={filters.totals}
            page={filters.page}
            totalPages={filters.totalPages}
            setPage={filters.setPage}
            isAdmin={isAdmin}
            onStatement={statement.open}
            onEdit={form.openEdit}
            onDelete={handleDelete}
            onEditBalance={initBalance.open}
          />
        )}
      </div>

      {/* ══ موديل الإضافة / التعديل ══ */}
      <SupplierFormModal
        isOpen={form.isOpen}
        onClose={form.close}
        editingId={form.editingId}
        form={form.form}
        setField={form.setField}
        onSubmit={form.handleSubmit}
        submitting={form.submitting}
      />

      {/* ══ موديل كشف الحساب السريع ══ */}
      <SupplierStatementModal
        isOpen={statement.isOpen}
        onClose={statement.close}
        supplier={statement.supplier}
        seasons={statement.seasons}
        loading={statement.loading}
      />

      {/* ══ موديل تعديل الرصيد الابتدائي ══ */}
      <SupplierInitialBalanceModal
        isOpen={initBalance.isOpen}
        seasonId={initBalance.seasonId}
        onClose={initBalance.close}
        supplier={initBalance.supplier}
        amount={initBalance.amount}
        setAmount={initBalance.setAmount}
        onSubmit={initBalance.handleSubmit}
        submitting={initBalance.submitting}
      />

    </div>
  );
}
