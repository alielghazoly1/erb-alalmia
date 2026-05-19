// ─── pages/customers/CustomersPage.jsx ───────────────────────────────────────
// الصفحة الرئيسية لإدارة العملاء — orchestrator يجمع الـ hooks والمكوّنات
// كل المنطق موزع على hooks مستقلة — الصفحة نفسها نظيفة وقصيرة
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState }        from 'react';
import { useDispatch, useSelector }    from 'react-redux';
import toast                           from 'react-hot-toast';

import {
  fetchCustomers,
  deleteCustomer,
  fetchCustomerStatement,
  fetchCustomerAllSeasons,
  clearStatement,
} from '../../store/slices/customerSlice';

import { useSelectedSeason }    from '../../hook/Useselectedseason';
import { useCustomerFilters }   from './hooks/useCustomerFilters';
import { useCustomerForm }      from './hooks/useCustomerForm';
import { useInitialBalance }    from './hooks/useInitialBalance';

import CustomerFilters          from './components/CustomerFilters';
import CustomerTable            from './components/CustomerTable';
import CustomerFormModal        from './components/CustomerFormModal';
import CustomerStatementModal   from './components/CustomerStatementModal';
import InitialBalanceModal      from './components/InitialBalanceModal';

// ─────────────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const dispatch  = useDispatch();
  const seasonId  = useSelectedSeason();

  const { list, loading } = useSelector((s) => s.customers);
  const { user }          = useSelector((s) => s.auth);
  const isAdmin           = user?.role === 'admin';

  // ── تحميل العملاء — يعيد التحميل عند تغيير الموسم ───────────────────────
  useEffect(() => {
    dispatch(fetchCustomers(seasonId ? { seasonId } : {}));
  }, [dispatch, seasonId]);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const filters = useCustomerFilters(list);
  const form    = useCustomerForm();

  // بعد حفظ الرصيد: نعيد تحميل القائمة بالموسم الحالي عشان الـ totals تتحدث
  const initBalance = useInitialBalance(() =>
    dispatch(fetchCustomers(seasonId ? { seasonId } : {})),
  );

  // ── حالة موديل الكشف السريع ───────────────────────────────────────────────
  const [statementCustomer, setStatementCustomer] = useState(null);
  const [isStatementOpen,   setIsStatementOpen]   = useState(false);

  // ── فتح كشف الحساب السريع ────────────────────────────────────────────────
  const openStatement = (customer) => {
    setStatementCustomer(customer);
    dispatch(clearStatement());
    dispatch(fetchCustomerStatement({ customerId: customer._id, seasonId }));
    dispatch(fetchCustomerAllSeasons(customer._id));
    setIsStatementOpen(true);
  };

  // ── حذف العميل ───────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('هتحذف العميل ده؟')) return;
    const res = await dispatch(deleteCustomer(id));
    if (!res.error) toast.success('تم الحذف');
    else toast.error(res.payload);
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── الهيدر ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">العملاء</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filters.filtered.length} عميل
            {filters.onlyDebtors && ' (عليهم فلوس)'}
            {' • '}إجمالي الديون:{' '}
            <span className={`font-bold mr-1 ${
              filters.totals.balance > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {filters.totals.balance?.toLocaleString('ar-EG', {
                minimumFractionDigits: 2, maximumFractionDigits: 2,
              })} ج.م
            </span>
          </p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={form.openCreate}>
            + إضافة عميل
          </button>
        )}
      </div>

      {/* ── الفلاتر ── */}
      <CustomerFilters
        search={filters.search}           setSearch={filters.setSearch}
        filterType={filters.filterType}   setFilterType={filters.setFilterType}
        onlyDebtors={filters.onlyDebtors} setOnlyDebtors={filters.setOnlyDebtors}
      />

      {/* ── الجدول ── */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
        ) : (
          <CustomerTable
            paginated={filters.paginated}
            filtered={filters.filtered}
            totals={filters.totals}
            page={filters.page}
            totalPages={filters.totalPages}
            setPage={filters.setPage}
            isAdmin={isAdmin}
            onStatement={openStatement}
            onEdit={form.openEdit}
            onDelete={handleDelete}
            onEditBalance={initBalance.open}
          />
        )}
      </div>

      {/* ══ موديل الإضافة / التعديل ══ */}
      <CustomerFormModal
        isOpen={form.isOpen}
        onClose={form.close}
        editingId={form.editingId}
        form={form.form}
        setField={form.setField}
        onSubmit={form.handleSubmit}
        submitting={form.submitting}
      />

      {/* ══ موديل كشف الحساب السريع ══ */}
      <CustomerStatementModal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        customer={statementCustomer}
      />

      {/* ══ موديل تعديل الرصيد الابتدائي ══ */}
      <InitialBalanceModal
        isOpen={initBalance.isOpen}
        seasonId={initBalance.seasonId}
        onClose={initBalance.close}
        customer={initBalance.customer}
        amount={initBalance.amount}
        setAmount={initBalance.setAmount}
        onSubmit={initBalance.handleSubmit}
        submitting={initBalance.submitting}
      />

    </div>
  );
}
