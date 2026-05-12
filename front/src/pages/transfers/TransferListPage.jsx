import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTransfers, approveTransfer, rejectTransfer } from '../../store/slices/transferSlice';
//  مكتبة lucide-react

import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const statusMap = {
  pending:  { text: 'معلق',   cls: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
  approved: { text: 'مُوافق', cls: 'bg-green-100 text-green-800 border border-green-200' },
  rejected: { text: 'مرفوض', cls: 'bg-red-100 text-red-800 border border-red-200' },
};

const dirMap = {
  R2O: { text: 'رمسيس - الي - أكتوبر', cls: 'bg-blue-100 text-blue-800',   icon: '🔵' },
  O2R: { text: 'أكتوبر - الي - رمسيس', cls: 'bg-purple-100 text-purple-800', icon: '🟣' },
};

const todayStr = () => new Date().toISOString().split('T')[0];
const monthStart = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
};

export default function TransferListPage() {
  const dispatch = useDispatch();
  const { list, loading } = useSelector(s => s.transfers);
  const { user } = useSelector(s => s.auth);
  const isAdmin = user?.role === 'admin';

  // فلاتر
  const [search,      setSearch]      = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDir,    setFilterDir]    = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  const loadData = () => {
    const params = {};
    if (filterStatus) params.status    = filterStatus;
    if (filterDir)    params.direction = filterDir;
    if (dateFrom)     params.startDate = dateFrom;
    if (dateTo)       params.endDate   = dateTo;
    dispatch(fetchTransfers(params));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, [filterStatus, filterDir, dateFrom, dateTo]);

  const filtered = list.filter(t =>
    !search || t.transferNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const setQuick = (label) => {
    if (label === 'اليوم') { setDateFrom(todayStr()); setDateTo(todayStr()); }
    else if (label === 'أمس') {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const s = y.toISOString().split('T')[0];
      setDateFrom(s); setDateTo(s);
    } else if (label === 'الشهر') { setDateFrom(monthStart()); setDateTo(todayStr()); }
    else { setDateFrom(''); setDateTo(''); }
  };

  const clearFilters = () => {
    setSearch(''); setFilterStatus(''); setFilterDir('');
    setDateFrom(''); setDateTo('');
  };

  const activeFiltersCount = [filterStatus, filterDir, dateFrom, dateTo, search].filter(Boolean).length;

  const handleApprove = async (id) => {
    if (!window.confirm('هتوافق على التحويل وتحدث المخزنين؟')) return;
    const res = await dispatch(approveTransfer(id));
    if (!res.error) toast.success('تم التحويل وتحديث المخزنين ✅');
    else toast.error(res.payload);
  };

  const handleReject = async (id) => {
    if (!window.confirm('هترفض التحويل ده؟')) return;
    const res = await dispatch(rejectTransfer(id));
    if (!res.error) toast.success('تم الرفض');
    else toast.error(res.payload);
  };

  const totalWeight = filtered.reduce((s, t) => s + (t.totalWeight || 0), 0);

  return (
    <div className="space-y-4">
      {/* هيدر */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إذونات التحويل</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} تحويل
            {filtered.length > 0 && (
              <span className="mr-2 text-blue-600 font-medium">
                — {totalWeight.toFixed(2)} ك إجمالي
              </span>
            )}
          </p>
        </div>
        <Link to="/transfers/new" className="btn-primary">+ إذن تحويل جديد</Link>
      </div>

      {/* شريط الفلاتر */}
      <div className="card space-y-3">
        {/* سطر البحث + زر الفلاتر */}
        <div className="flex gap-3 flex-wrap items-center">
          <input
            className="input-field flex-1 min-w-48"
            placeholder="🔍 بحث برقم الإذن..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
              showFilters || activeFiltersCount > 0
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            ⚙️ فلاتر
            {activeFiltersCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          {activeFiltersCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-red-500 hover:underline">
              مسح الكل ✕
            </button>
          )}
        </div>

        {/* الفلاتر التفصيلية */}
        {showFilters && (
          <div className="pt-3 border-t border-gray-100 space-y-3">
            <div className="flex gap-3 flex-wrap">
              {/* الحالة */}
              <div className="flex-1 min-w-36">
                <label className="block text-xs font-medium text-gray-500 mb-1">الحالة</label>
                <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">الكل</option>
                  <option value="pending">معلق</option>
                  <option value="approved">مُوافق</option>
                  <option value="rejected">مرفوض</option>
                </select>
              </div>
              {/* الاتجاه */}
              <div className="flex-1 min-w-36">
                <label className="block text-xs font-medium text-gray-500 mb-1">الاتجاه</label>
                <select className="input-field" value={filterDir} onChange={e => setFilterDir(e.target.value)}>
                  <option value="">الكل</option>
                  <option value="R2O">🔵 رمسيس → أكتوبر</option>
                  <option value="O2R">🟣 أكتوبر → رمسيس</option>
                </select>
              </div>
              {/* من تاريخ */}
              <div className="flex-1 min-w-36">
                <label className="block text-xs font-medium text-gray-500 mb-1">من تاريخ</label>
                <input type="date" className="input-field" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              {/* إلى تاريخ */}
              <div className="flex-1 min-w-36">
                <label className="block text-xs font-medium text-gray-500 mb-1">إلى تاريخ</label>
                <input type="date" className="input-field" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
            {/* اختصارات التواريخ */}
            <div className="flex gap-2 flex-wrap">
              {['اليوم', 'أمس', 'الشهر', 'الكل'].map(l => (
                <button
                  key={l}
                  onClick={() => setQuick(l)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 font-medium transition-colors"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* الجدول */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-3xl mb-2">⏳</p>
            <p>جاري التحميل...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-lg font-medium text-gray-500">مفيش تحويلات</p>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="mt-2 text-sm text-blue-600 hover:underline">
                امسح الفلاتر لعرض الكل
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <th className="text-right px-4 py-3 font-medium">رقم الإذن</th>
                <th className="text-right px-4 py-3 font-medium">رقم المستند</th>
                <th className="text-right px-4 py-3 font-medium">الاتجاه</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium">الأصناف</th>
                <th className="text-right px-4 py-3 font-medium">الوزن الكلي</th>
                {/* <th className='text-right px-4 py-3 font-medium'>الموسم</th> */}
                <th className="text-right px-4 py-3 font-medium">بواسطة</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => {
                const st  = statusMap[t.status] || statusMap.pending;
                const dir = dirMap[t.direction]  || dirMap.R2O;

                const canEdit =
                  t.status === 'pending' ||
                  (t.status === 'approved' && isAdmin);

                return (
                  <tr key={t._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-purple-700">
                      {t.transferNumber}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-600">
                      {t.docNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${dir.cls}`}>
                        {dir.icon} {dir.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(t.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-center font-medium">
                      {t.items?.length || 0}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {(t.totalWeight || 0).toFixed(2)} ك
                    </td>
                    {/* <td className="px-4 py-3 text-gray-600 text-center font-medium">
                      {t.season?.name || '—'}
                    </td> */}
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {t.createdBy?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>
                        {st.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 items-center flex-wrap">
                        <Link
                          to={`/transfers/${t._id}`}
                          className="text-gray-500 hover:text-gray-700 text-xs hover:underline"
                        >
                          عرض
                        </Link>
                        {canEdit && (
                          <Link
                            to={`/transfers/${t._id}/edit`}
                            className={`text-xs hover:underline font-medium ${
                              t.status === 'approved' ? 'text-red-500' : 'text-blue-600'
                            }`}
                          >
                            {t.status === 'approved' ? '⚠️ تعديل' : 'تعديل'}
                          </Link>
                        )}
                        {isAdmin && t.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(t._id)}
                              className="text-green-600 hover:underline text-xs font-medium"
                            >
                              موافقة
                            </button>
                            <button
                              onClick={() => handleReject(t._id)}
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
            {/* فوتر الإجمالي */}
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-sm">
                <td colSpan={4} className="px-4 py-3 text-right text-gray-500">
                  الإجمالي ({filtered.length} تحويل)
                </td>
                <td></td>
                <td className="px-4 py-3 text-gray-800">
                  {totalWeight.toFixed(2)} ك
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}