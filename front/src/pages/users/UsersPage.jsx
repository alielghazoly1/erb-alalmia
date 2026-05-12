import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { fetchMe } from '../../store/slices/authSlice';

// ── تعريف الصلاحيات ───────────────────────────────────────────
// لو أضفت صلاحية جديدة في User.js — أضف هنا سطر واحد بس
// هذه الصلاحيات بتُقرأ من الـ DB حتى للأدمن (يعني الأدمن يقدر يتحكم فيها لنفسه وللأدمن التاني)
// لازم تتطابق مع ADMIN_DB_PERMISSIONS في authController.js في الباك
const ADMIN_DB_PERMISSIONS = new Set(['allowNegativeSale']);

const PERMISSION_LABELS = {
  allowNegativeSale: {
    label: 'بيع بالسالب',
    desc:  'يسمح بالبيع حتى لو المخزون وصل صفر أو أقل',
    icon:  '➖',
  },
  canEditInvoice: {
    label: 'تعديل الفاتورة',
    desc:  'يسمح بتعديل الفاتورة بعد حفظها (pending/approved)',
    icon:  '✏️',
  },
};

const emptyForm = {
  name: '', username: '', password: '',
  role: 'user', warehouse: 'ramses', isActive: true,
  permissions: Object.fromEntries(Object.keys(PERMISSION_LABELS).map(k => [k, false])),
};

const warehouseLabel = { ramses: 'رمسيس', october: 'أكتوبر', both: 'الاثنين' };

export default function UsersPage() {
  const dispatch              = useDispatch();
  const { user: currentUser } = useSelector(s => s.auth);
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [form,         setForm]         = useState(emptyForm);
  // إعدادات الأدمن الخاصة
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  const permKeys = Object.keys(PERMISSION_LABELS);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/users');
      setUsers(data);
    } catch {
      toast.error('خطأ في تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (u) => {
    setForm({
      ...u,
      password: '',
      permissions: Object.fromEntries(
        permKeys.map(k => [k, u.permissions?.[k] === true])
      ),
    });
    setEditingId(u._id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.username) return toast.error('الاسم واسم المستخدم مطلوبين');
    if (!editingId && !form.password)  return toast.error('كلمة المرور مطلوبة للمستخدم الجديد');

    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;

      if (editingId) {
        await api.put(`/auth/users/${editingId}`, payload);
        toast.success('تم التعديل ✅');
      } else {
        await api.post('/auth/users', payload);
        toast.success('تم الإضافة ✅');
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ');
    }
  };

  // toggle سريع للصلاحية من الجدول مباشرة
  const handleTogglePermission = async (u, permKey) => {
    if (u.role === 'admin') {
      toast('الأدمن عنده كل الصلاحيات دايماً', { icon: 'ℹ️' });
      return;
    }
    const newVal = !(u.permissions?.[permKey] === true);
    try {
      await api.put(`/auth/users/${u._id}`, { permissions: { [permKey]: newVal } });
      toast.success(`${PERMISSION_LABELS[permKey].label}: ${newVal ? 'مفعّل ✅' : 'معطّل ❌'}`);
      loadUsers();
    } catch {
      toast.error('خطأ في التحديث');
    }
  };

  const handleToggleActive = async (u) => {
    if (u._id === currentUser._id) return toast.error('مينفعش تعطل حسابك الحالي');
    try {
      await api.put(`/auth/users/${u._id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? 'تم التعطيل' : 'تم التفعيل');
      loadUsers();
    } catch {
      toast.error('خطأ');
    }
  };

  // ── تحديث صلاحية الأدمن لنفسه ───────────────────────────────
  // الأدمن تقنياً عنده كل الصلاحيات — بس نقدر نخزنها في الـ DB صريح عشان الـ UI
  const adminSelfPerm = (key) => currentUser?.permissions?.[key] === true;

  const handleAdminToggleSelf = async (permKey) => {
    // الأدمن يتحكم في صلاحياته في المخزن — بيأثر على زر الفاتورة
    const newVal = !adminSelfPerm(permKey);
    try {
      await api.put(`/auth/users/${currentUser._id}`, { permissions: { [permKey]: newVal } });
      // نحدث الـ Redux state عشان التغيير يتعكس فوراً في الفواتير
      await dispatch(fetchMe());
      toast.success(`${PERMISSION_LABELS[permKey].label}: ${newVal ? 'مفعّل ✅' : 'معطّل ❌'}`);
      loadUsers();
    } catch {
      toast.error('خطأ في التحديث');
    }
  };

  return (
    <div>
      {/* هيدر */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">المستخدمين</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} مستخدم</p>
        </div>
        <div className="flex gap-2">
          {/* إعدادات الأدمن الخاصة */}
          <button
            className="btn-secondary text-sm"
            onClick={() => setAdminPanelOpen(v => !v)}
          >
            ⚙️ إعداداتي
          </button>
          <button className="btn-primary" onClick={openCreate}>+ إضافة مستخدم</button>
        </div>
      </div>

      {/* ── بانيل إعدادات الأدمن ─────────────────────────────────────────── */}
      {adminPanelOpen && (
        <div className="mb-6 card border-2 border-blue-100 bg-blue-50/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-blue-800">⚙️ إعداداتي الخاصة</h2>
              <p className="text-xs text-blue-500 mt-0.5">تحكم في صلاحياتك أنت كأدمن داخل الفواتير</p>
            </div>
            <button onClick={() => setAdminPanelOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
          <div className="space-y-3">
            {permKeys.map(k => {
              const isOn = adminSelfPerm(k);
              return (
                <div key={k} className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {PERMISSION_LABELS[k].icon} {PERMISSION_LABELS[k].label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{PERMISSION_LABELS[k].desc}</p>
                  </div>
                  <button
                    onClick={() => handleAdminToggleSelf(k)}
                    className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${isOn ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${isOn ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-blue-400 mt-3 text-center">
            💡 هذه الإعدادات تؤثر على تصرفك أنت فقط داخل الفواتير
          </p>
        </div>
      )}

      {/* ── جدول المستخدمين ──────────────────────────────────────────────── */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="text-right px-4 py-3 font-medium">الاسم</th>
                <th className="text-right px-4 py-3 font-medium">اسم المستخدم</th>
                <th className="text-right px-4 py-3 font-medium">الدور</th>
                <th className="text-right px-4 py-3 font-medium">المخزن</th>
                {permKeys.map(k => (
                  <th key={k} className="text-center px-3 py-3 font-medium text-xs" title={PERMISSION_LABELS[k].desc}>
                    {PERMISSION_LABELS[k].icon} {PERMISSION_LABELS[k].label}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u._id} className={`hover:bg-gray-50 ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {u.name}
                    {u._id === currentUser._id && (
                      <span className="mr-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">أنت</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.role === 'admin' ? '👑 أدمن' : 'مستخدم'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{warehouseLabel[u.warehouse] || u.warehouse}</td>

                  {permKeys.map(k => {
                    // أدمن: الصلاحيات الثابتة = true دايماً | الصلاحيات من DB = قيمتها الفعلية
                    const isOn = u.role === 'admin' && !ADMIN_DB_PERMISSIONS.has(k)
                      ? true
                      : u.permissions?.[k] === true;
                    const isAdminRow = u.role === 'admin';
                    return (
                      <td key={k} className="px-3 py-3 text-center">
                        <button
                          onClick={() => {
                            if (u._id === currentUser._id && isAdminRow) {
                              // أدمن يعدّل نفسه — بس الصلاحيات اللي في ADMIN_DB_PERMISSIONS
                              ADMIN_DB_PERMISSIONS.has(k)
                                ? handleAdminToggleSelf(k)
                                : toast('هذه الصلاحية ثابتة للأدمن', { icon: 'ℹ️' });
                            } else if (isAdminRow) {
                              // أدمن يعدّل أدمن تاني — بس الصلاحيات اللي في ADMIN_DB_PERMISSIONS
                              ADMIN_DB_PERMISSIONS.has(k)
                                ? handleTogglePermission(u, k)
                                : toast('هذه الصلاحية ثابتة للأدمن', { icon: 'ℹ️' });
                            } else {
                              handleTogglePermission(u, k);
                            }
                          }}
                          title={
                            isAdminRow && !ADMIN_DB_PERMISSIONS.has(k)
                              ? 'الأدمن عنده هذه الصلاحية ثابتاً'
                              : `${isOn ? 'تعطيل' : 'تفعيل'} ${PERMISSION_LABELS[k].label}`
                          }
                          className={`w-10 h-5 rounded-full transition-colors relative ${
                            isOn ? 'bg-green-500' : 'bg-gray-300'
                          } ${isAdminRow && !ADMIN_DB_PERMISSIONS.has(k) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isOn ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                      </td>
                    );
                  })}

                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.isActive ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline text-xs">تعديل</button>
                      {u._id !== currentUser._id && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`text-xs hover:underline ${u.isActive ? 'text-red-500' : 'text-green-600'}`}
                        >
                          {u.isActive ? 'تعطيل' : 'تفعيل'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── مودال الإنشاء / التعديل ───────────────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingId ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم *</label>
              <input className="input-field" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم *</label>
              <input className="input-field" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                disabled={!!editingId} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              كلمة المرور{' '}
              {editingId && <span className="text-gray-400 text-xs">(اتركها فاضية للإبقاء على نفس الباسورد)</span>}
            </label>
            <input type="password" className="input-field" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder={editingId ? 'اتركها فاضية' : 'كلمة المرور'} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
              <select className="input-field" value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="user">مستخدم</option>
                <option value="admin">أدمن</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المخزن</label>
              <select className="input-field" value={form.warehouse}
                onChange={e => setForm({ ...form, warehouse: e.target.value })}>
                <option value="ramses">رمسيس</option>
                <option value="october">أكتوبر</option>
                <option value="both">الاثنين</option>
              </select>
            </div>
          </div>

          {/* الصلاحيات — بتتخفى للأدمن */}
          {form.role !== 'admin' && permKeys.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">🔑 صلاحيات إضافية</p>
              <div className="space-y-2">
                {permKeys.map(k => (
                  <label key={k} className="flex items-center justify-between gap-3 cursor-pointer p-2 rounded-lg hover:bg-white transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {PERMISSION_LABELS[k].icon} {PERMISSION_LABELS[k].label}
                      </p>
                      <p className="text-xs text-gray-400">{PERMISSION_LABELS[k].desc}</p>
                    </div>
                    <button type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        permissions: { ...f.permissions, [k]: !f.permissions[k] },
                      }))}
                      className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.permissions[k] ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.permissions[k] ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          )}
          {form.role === 'admin' && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-600 text-center">
              👑 الأدمن عنده كل الصلاحيات — عدّل إعداداتك من زرار "إعداداتي" في الصفحة
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">{editingId ? 'حفظ التعديلات' : 'إضافة'}</button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setIsModalOpen(false)}>إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
