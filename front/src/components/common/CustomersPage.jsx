// ─── components/common/CustomersPage.jsx ─────────────────────────────────────
import { useEffect, useState }        from 'react';
import { useDispatch, useSelector }    from 'react-redux';
import { fmtFixed }                    from '../../utils/fmt';
import toast                           from 'react-hot-toast';

import Modal                           from '../../components/common/Modal';
import InitialBalanceModal             from './InitialBalanceModal';
import { useInitialBalance }           from '../../pages/customers/hooks/useInitialBalance';
import { useSelectedSeason }           from '../../hook/Useselectedseason';

import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCustomerStatement,
  fetchCustomerAllSeasons,
  clearStatement,
} from '../../store/slices/customerSlice';

// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  code: '', name: '', phone: '', address: '',
  type: 'credit', isSupplier: false, notes: '',
};

// ─────────────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const dispatch  = useDispatch();
  const seasonId  = useSelectedSeason();

  const { list, loading, statement, statementLoading, allSeasons } =
    useSelector((s) => s.customers);
  const { user } = useSelector((s) => s.auth);
  const isAdmin   = user?.role === 'admin';

  // ── state ──────────────────────────────────────────────────────────────────
  const [isFormOpen,       setIsFormOpen]       = useState(false);
  const [isStatementOpen,  setIsStatementOpen]  = useState(false);
  const [editingId,        setEditingId]        = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form,             setForm]             = useState(EMPTY_FORM);
  const [search,           setSearch]           = useState('');

  // ── رصيد ابتدائي via hook ─────────────────────────────────────────────────
  const balanceHook = useInitialBalance(() => {
    // بعد الحفظ: نعيد تحميل القائمة بالموسم الحالي عشان الـ balance يتحدث
    dispatch(fetchCustomers(seasonId ? { seasonId } : {}));
  });

  // ── تحميل أولي ────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchCustomers(seasonId ? { seasonId } : {}));
  }, [dispatch, seasonId]);

  // ── فلترة ─────────────────────────────────────────────────────────────────
  const filtered = list.filter(
    (c) => c.name.includes(search) || c.code.includes(search),
  );

  // ── handlers ───────────────────────────────────────────────────────────────
  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setIsFormOpen(true); };
  const openEdit   = (c) => { setForm(c);         setEditingId(c._id); setIsFormOpen(true); };

  const openStatement = (customer) => {
    setSelectedCustomer(customer);
    dispatch(clearStatement());
    dispatch(fetchCustomerStatement({ customerId: customer._id, seasonId }));
    dispatch(fetchCustomerAllSeasons(customer._id));
    setIsStatementOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) return toast.error('الكود والاسم مطلوبين');

    const action = editingId
      ? updateCustomer({ id: editingId, ...form })
      : createCustomer(form);

    const res = await dispatch(action);
    if (!res.error) {
      toast.success(editingId ? 'تم التعديل' : 'تم الإضافة');
      setIsFormOpen(false);
    } else {
      toast.error(res.payload);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هتحذف العميل ده؟')) return;
    const res = await dispatch(deleteCustomer(id));
    if (!res.error) toast.success('تم الحذف');
    else toast.error(res.payload);
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── موديل الرصيد الابتدائي ── */}
      {balanceHook.isOpen && (
        <InitialBalanceModal
          entity={balanceHook.customer}
          entityType="customer"
          onSave={async (id, amount) => {
            if (!seasonId) { toast.error('اختر موسماً أولاً'); return; }
            await balanceHook.handleSubmit({ preventDefault: () => {} });
          }}
          onClose={balanceHook.close}
        />
      )}

      {/* ── هيدر ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">العملاء</h1>
          <p className="text-gray-500 text-sm mt-1">إجمالي {list.length} عميل</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={openCreate}>
            + إضافة عميل
          </button>
        )}
      </div>

      {/* ── بحث ── */}
      <div className="card mb-4 flex gap-3">
        <input
          className="input-field flex-1"
          placeholder="بحث بالاسم أو الكود..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── جدول ── */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">مفيش عملاء</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="text-right px-4 py-3 font-medium">الكود</th>
                  <th className="text-right px-4 py-3 font-medium">الاسم</th>
                  <th className="text-right px-4 py-3 font-medium">التليفون</th>
                  <th className="text-right px-4 py-3 font-medium">النوع</th>
                  <th className="text-right px-4 py-3 font-medium">الرصيد</th>
                  <th className="text-right px-4 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-blue-600">{c.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        c.type === 'cash'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {c.type === 'cash' ? 'نقدي' : 'آجل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${
                        (c.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {fmtFixed(c.balance ?? 0)} ج.م
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => openStatement(c)}
                          className="text-purple-600 hover:underline text-sm"
                        >
                          كشف حساب
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => balanceHook.open(c)}
                              className="text-yellow-600 hover:underline text-sm"
                            >
                              رصيد
                            </button>
                            <button
                              onClick={() => openEdit(c)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => handleDelete(c._id)}
                              className="text-red-500 hover:underline text-sm"
                            >
                              حذف
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── فورم الإضافة / التعديل ── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? 'تعديل عميل' : 'إضافة عميل جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الكود *</label>
              <input
                className="input-field"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                disabled={!!editingId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم *</label>
              <input
                className="input-field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التليفون</label>
              <input
                className="input-field"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع العميل</label>
              <select
                className="input-field"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="credit">آجل</option>
                <option value="cash">نقدي</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
            <input
              className="input-field"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
            <textarea
              className="input-field"
              rows={2}
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isSupplier}
              onChange={(e) => setForm({ ...form, isSupplier: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">العميل ده مورد أيضاً</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">
              {editingId ? 'حفظ التعديلات' : 'إضافة'}
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setIsFormOpen(false)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* ── كشف الحساب السريع ── */}
      <Modal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        title={`كشف حساب — ${selectedCustomer?.name}`}
      >
        {statementLoading ? (
          <div className="text-center py-8 text-gray-400">جاري التحميل...</div>
        ) : statement ? (
          <div className="space-y-4">

            {/* ملخص الموسم الحالي */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">إجمالي المبيعات</p>
                <p className="text-lg font-bold text-blue-700">
                  {fmtFixed(statement.totals?.totalSales ?? statement.totalSales)}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 mb-1">إجمالي المدفوع</p>
                <p className="text-lg font-bold text-green-700">
                  {fmtFixed(statement.totals?.totalPaid ?? statement.totalPaid)}
                </p>
              </div>
              <div className={`rounded-lg p-3 text-center ${
                (statement.totals?.balance ?? statement.balance ?? 0) > 0
                  ? 'bg-red-50'
                  : 'bg-gray-50'
              }`}>
                <p className={`text-xs mb-1 ${
                  (statement.totals?.balance ?? statement.balance ?? 0) > 0
                    ? 'text-red-600'
                    : 'text-gray-500'
                }`}>
                  الرصيد المتبقي
                </p>
                <p className={`text-lg font-bold ${
                  (statement.totals?.balance ?? statement.balance ?? 0) > 0
                    ? 'text-red-700'
                    : 'text-gray-700'
                }`}>
                  {fmtFixed(statement.totals?.balance ?? statement.balance)}
                </p>
              </div>
            </div>

            {/* كل المواسم */}
            {allSeasons.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">سجل المواسم</h3>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {allSeasons.map((s) => (
                    <div
                      key={s.season._id}
                      className="flex justify-between items-center text-sm py-2 border-b border-gray-100"
                    >
                      <span className={`font-medium ${s.season.isActive ? 'text-blue-600' : 'text-gray-700'}`}>
                        {s.season.name} {s.season.isActive && '(الحالي)'}
                      </span>
                      <span className="text-gray-500">مبيعات: {fmtFixed(s.totalSales)}</span>
                      <span className="text-green-600">مدفوع: {fmtFixed(s.totalPaid)}</span>
                      <span className={`font-bold ${s.balance > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        باقي: {fmtFixed(s.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">مفيش بيانات</div>
        )}
      </Modal>

    </div>
  );
}
