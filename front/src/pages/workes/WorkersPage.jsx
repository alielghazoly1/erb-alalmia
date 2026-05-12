import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
} from '../../store/slices/workerSlice';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const whLabel = {
  ramses:  { text: 'رمسيس',  cls: 'bg-blue-100 text-blue-700'   },
  october: { text: 'أكتوبر', cls: 'bg-purple-100 text-purple-700' },
  both:    { text: 'الاثنين', cls: 'bg-gray-100 text-gray-700'   },
};

const emptyForm = { name: '', code: '', warehouse: 'ramses', phone: '', notes: '' };

function WorkerFormModal({ initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial || emptyForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error('اسم المعلم مطلوب');
    if (!form.code.trim()) return toast.error('كود المعلم مطلوب');
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            {initial?._id ? '✏️ تعديل المعلم' : '➕ إضافة معلم جديد'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">الاسم *</label>
              <input className="input-field" placeholder="اسم المعلم" value={form.name}
                onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">الكود *</label>
              <input className="input-field font-mono uppercase" placeholder="مثال: W001"
                value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">العنبر</label>
            <select className="input-field" value={form.warehouse} onChange={e => set('warehouse', e.target.value)}>
              <option value="ramses">🏭 رمسيس</option>
              <option value="october">🏭 أكتوبر</option>
              <option value="both">🏭 الاثنين</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">التليفون</label>
            <input className="input-field" placeholder="اختياري" value={form.phone}
              onChange={e => set('phone', e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ملاحظات</label>
            <textarea className="input-field resize-none" rows={2} placeholder="اختياري"
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          {initial?._id && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" className="w-4 h-4"
                checked={form.isActive !== false}
                onChange={e => set('isActive', e.target.checked)} />
              <label htmlFor="isActive" className="text-sm text-gray-600">نشط</label>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={handleSubmit} disabled={saving}
            className="btn-primary flex-1 py-2.5">
            {saving ? 'جاري الحفظ...' : '💾 حفظ'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

export default function WorkersPage() {
  const dispatch = useDispatch();
  const { list, loading } = useSelector(s => s.workers);
  const [modal,   setModal]   = useState(null); // null | 'add' | {worker}
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState('');
  const [whFilter, setWhFilter] = useState('');

  useEffect(() => { dispatch(fetchWorkers()); }, [dispatch]);

  const filtered = list.filter(w => {
    const matchSearch = !search || w.name.includes(search) || w.code.includes(search.toUpperCase());
    const matchWh     = !whFilter || w.warehouse === whFilter || w.warehouse === 'both';
    return matchSearch && matchWh;
  });

  const handleSave = async (form) => {
    setSaving(true);
    const isEdit = !!modal?._id;
    const action = isEdit
      ? updateWorker({ id: modal._id, ...form })
      : createWorker(form);
    const res = await dispatch(action);
    setSaving(false);
    if (!res.error) {
      toast.success(isEdit ? 'تم التعديل ✅' : 'تم الإضافة ✅');
      setModal(null);
    } else {
      toast.error(res.payload || 'خطأ في الحفظ');
    }
  };

  const handleDelete = async (worker) => {
if (!window.confirm(`هتحذف "${worker.name}"؟`)) return;    const res = await dispatch(deleteWorker(worker._id));
    if (!res.error) toast.success('تم الحذف');
    else toast.error(res.payload || 'مش ممكن تحذف المعلم');
  };

  const ramsesCount   = list.filter(w => w.warehouse === 'ramses' || w.warehouse === 'both').length;
  const octoberCount  = list.filter(w => w.warehouse === 'october' || w.warehouse === 'both').length;

  return (
    <div className="max-w-5xl mx-auto">
      {/* هيدر */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">👷 معلمو العنابر</h1>
          <p className="text-sm text-gray-500 mt-0.5">إدارة معلمي التصنيع في العنابر</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary">+ إضافة معلم</button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center py-3">
          <p className="text-xs text-gray-400 mb-1">إجمالي المعلمين</p>
          <p className="text-2xl font-bold text-gray-800">{list.length}</p>
        </div>
        <div className="card text-center py-3 bg-blue-50 border-blue-100">
          <p className="text-xs text-blue-500 mb-1">🏭 رمسيس</p>
          <p className="text-2xl font-bold text-blue-700">{ramsesCount}</p>
        </div>
        <div className="card text-center py-3 bg-purple-50 border-purple-100">
          <p className="text-xs text-purple-500 mb-1">🏭 أكتوبر</p>
          <p className="text-2xl font-bold text-purple-700">{octoberCount}</p>
        </div>
      </div>

      {/* فلاتر */}
      <div className="card mb-4 flex flex-wrap gap-3 items-center">
        <input className="input-field flex-1 min-w-[180px]"
          placeholder="ابحث بالاسم أو الكود..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input-field w-44" value={whFilter} onChange={e => setWhFilter(e.target.value)}>
          <option value="">كل العنابر</option>
          <option value="ramses">رمسيس</option>
          <option value="october">أكتوبر</option>
        </select>
      </div>

      {/* الجدول */}
      {loading ? (
        <div className="card text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">👷</p>
          <p>{list.length === 0 ? 'مفيش معلمين مضافين بعد' : 'مفيش نتائج'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-right px-4 py-3">الكود</th>
                <th className="text-right px-4 py-3">الاسم</th>
                <th className="text-center px-4 py-3">العنبر</th>
                <th className="text-center px-4 py-3">التليفون</th>
                <th className="text-center px-4 py-3">الحالة</th>
                <th className="text-center px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(worker => {
                const wh = whLabel[worker.warehouse] || whLabel.ramses;
                return (
                  <tr key={worker._id} className={`hover:bg-gray-50 transition-colors ${worker.isActive === false ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded font-bold text-gray-700">
                        {worker.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {worker.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{worker.name}</p>
                          {worker.notes && <p className="text-xs text-gray-400 truncate max-w-[160px]">{worker.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${wh.cls}`}>
                        {wh.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs font-mono">
                      {worker.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${worker.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {worker.isActive !== false ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          to={`/workers/${worker._id}/statement`}
                          className="text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          📊 كشف
                        </Link>
                        <button
                          onClick={() => setModal({ ...worker })}
                          className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(worker)}
                          className="text-xs bg-red-50 text-red-500 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <WorkerFormModal
          initial={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}