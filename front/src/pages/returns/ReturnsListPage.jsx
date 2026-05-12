import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchReturns, approveReturn, rejectReturn } from '../../store/slices/returnSlice';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const statusMap = {
  pending:  { text: 'معلق',   cls: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'مُوافق', cls: 'bg-green-100 text-green-700' },
  rejected: { text: 'مرفوض', cls: 'bg-red-100 text-red-700' },
};

const typeMap = {
  customer_return: { text: 'مرتجع عميل', cls: 'bg-orange-100 text-orange-700' },
  supplier_return: { text: 'مرتجع مورد', cls: 'bg-blue-100 text-blue-700' },
};

export default function ReturnsListPage() {
  const dispatch = useDispatch();
  const { list, loading } = useSelector((s) => s.returns);
  const { user }  = useSelector((s) => s.auth);
  const isAdmin   = user?.role === 'admin';

  const [search,       setSearch]       = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    dispatch(fetchReturns({ type: filterType, status: filterStatus }));
  }, [dispatch, filterType, filterStatus]);

  const filtered = list.filter(
    (r) =>
      r.invoiceNumber?.includes(search) ||
      r.customerName?.includes(search) ||
      r.supplierName?.includes(search),
  );

  const handleApprove = async (id) => {
    if (!window.confirm('هتوافق على المرتجع وتحدث المخزن؟')) return;
    const res = await dispatch(approveReturn(id));
    if (!res.error) toast.success('تم الموافقة وتحديث المخزن ✅');
    else toast.error(res.payload);
  };

  const handleReject = async (id) => {
    if (!window.confirm('هترفض المرتجع ده؟')) return;
    const res = await dispatch(rejectReturn(id));
    if (!res.error) toast.success('تم الرفض');
    else toast.error(res.payload);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">المرتجعات</h1>
          <p className="text-sm text-gray-500 mt-1">{list.length} مرتجع</p>
        </div>
        <div className="flex gap-2">
          <Link to="/returns/customer/new" className="btn-primary">+ مرتجع عميل</Link>
          <Link to="/returns/supplier/new" className="btn-secondary">+ مرتجع مورد</Link>
        </div>
      </div>

      <div className="card mb-4 flex gap-3 flex-wrap">
        <input
          className="input-field flex-1 min-w-48"
          placeholder="بحث برقم المرتجع أو الاسم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input-field w-auto"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">كل الأنواع</option>
          <option value="customer_return">مرتجع عميل</option>
          <option value="supplier_return">مرتجع مورد</option>
        </select>
        <select
          className="input-field w-auto"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="pending">معلق</option>
          <option value="approved">مُوافق</option>
          <option value="rejected">مرفوض</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">مفيش مرتجعات</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="text-right px-4 py-3 font-medium">الرقم</th>
                <th className="text-right px-4 py-3 font-medium">النوع</th>
                <th className="text-right px-4 py-3 font-medium">الاسم</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium">الإجمالي</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((ret) => {
                const st   = statusMap[ret.status];
                const tp   = typeMap[ret.type];
                const name = ret.customerName || ret.supplierName;

                // تعديل: pending → الكل | approved → أدمن فقط | rejected → لا
                const canEdit =
                  ret.status === 'pending' ||
                  (ret.status === 'approved' && isAdmin);

                const editPath = `/returns/${
                  ret.type === 'customer_return' ? 'customer' : 'supplier'
                }/${ret._id}/edit`;

                return (
                  <tr key={ret._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-orange-600">
                      {ret.invoiceNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${tp.cls}`}>
                        {tp.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(ret.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {ret.totalAmount?.toFixed(2)} ج.م
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.cls}`}>
                        {st.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap items-center">
                        {canEdit && (
                          <Link
                            to={editPath}
                            className={`text-xs font-medium hover:underline ${
                              ret.status === 'approved'
                                ? 'text-red-500'   // أحمر للمعتمد
                                : 'text-blue-600'
                            }`}
                          >
                            {ret.status === 'approved' ? '⚠️ تعديل' : 'تعديل'}
                          </Link>
                        )}
                        <Link
                          to={`/returns/${ret._id}`}
                          className="text-gray-600 hover:underline text-xs"
                        >
                          عرض
                        </Link>
                        {isAdmin && ret.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(ret._id)}
                              className="text-green-600 hover:underline text-xs"
                            >
                              موافقة
                            </button>
                            <button
                              onClick={() => handleReject(ret._id)}
                              className="text-red-500 hover:underline text-xs"
                            >
                              رفض
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}