import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchSeasons, createSeason, updateSeason, activateSeason,
} from '../../store/slices/seasonSlice';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '',
  startDate: '',
  endDate: '',
  isManufacturing: false,
};

export default function SeasonsPage() {
  const dispatch = useDispatch();
  const { seasons, activeSeason } = useSelector(s => s.season);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [form, setForm]               = useState(emptyForm);
  const [activating, setActivating]   = useState(null);

  useEffect(() => { dispatch(fetchSeasons()); }, [dispatch]);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setIsModalOpen(true); };
  const openEdit   = (s) => {
    setForm({
      name:            s.name,
      startDate:       s.startDate?.split('T')[0] || '',
      endDate:         s.endDate?.split('T')[0]   || '',
      isManufacturing: s.isManufacturing,
    });
    setEditingId(s._id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.startDate || !form.endDate)
      return toast.error('الاسم والتاريخين مطلوبين');

    if (editingId) {
      const res = await dispatch(updateSeason({ id: editingId, ...form }));
      if (!res.error) { toast.success('تم التعديل'); setIsModalOpen(false); }
      else toast.error('خطأ في التعديل');
    } else {
      if (!window.confirm(
        'إنشاء موسم جديد هيوقف الموسم الحالي ويعمل snapshot للمخزن الحالي.\nالأصناف هتتنقل بأوزانها للموسم الجديد.\nمتأكد؟'
      )) return;
      const res = await dispatch(createSeason(form));
      if (!res.error) { toast.success('تم إنشاء الموسم الجديد ✅'); setIsModalOpen(false); }
      else toast.error('خطأ في الإنشاء');
    }
  };

  const handleActivate = async (season) => {
    if (season.isActive) return;
    if (!window.confirm(
      `هتفعّل موسم "${season.name}".\nالفواتير والمدفوعات هتتفلتر على الموسم ده.\nالمخزن مش هيتأثر.\nمتأكد؟`
    )) return;
    setActivating(season._id);
    const res = await dispatch(activateSeason(season._id));
    setActivating(null);
    if (!res.error) toast.success(`تم تفعيل موسم "${season.name}" ✅`);
    else toast.error(res.payload || 'خطأ في التفعيل');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">المواسم</h1>
          {activeSeason && (
            <p className="text-sm text-green-600 mt-1">
              الموسم النشط: <span className="font-medium">{activeSeason.name}</span>
            </p>
          )}
        </div>
        <button className="btn-primary" onClick={openCreate}>+ موسم جديد</button>
      </div>

      <div className="space-y-3">
        {seasons.map(s => (
          <div
            key={s._id}
            className={`card flex items-center justify-between ${
              s.isActive ? 'border-2 border-green-400 bg-green-50' : ''
            }`}
          >
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-800">{s.name}</h3>
                  {s.isActive && (
                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">
                      ✅ نشط
                    </span>
                  )}
                  {s.isManufacturing && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      تصنيع
                    </span>
                  )}
                  {s.stockSnapshot?.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      📦 snapshot محفوظ
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {new Date(s.startDate).toLocaleDateString('ar-EG')} —{' '}
                  {new Date(s.endDate).toLocaleDateString('ar-EG')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!s.isActive && (
                <button
                  onClick={() => handleActivate(s)}
                  disabled={activating === s._id}
                  className="text-xs px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {activating === s._id ? '...' : '▶ تفعيل'}
                </button>
              )}
              <button
                onClick={() => openEdit(s)}
                className="text-blue-600 hover:underline text-sm"
              >
                تعديل
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'تعديل موسم' : 'موسم جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              ⚠️ إنشاء موسم جديد هيعمل snapshot للمخزن الحالي وينقل الأصناف بأوزانها.
              الأرصدة (مبيعات/مدفوعات) هتبدأ من صفر.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الموسم *</label>
            <input
              className="input-field"
              placeholder="مثلاً: موسم 2025"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البداية *</label>
              <input
                type="date" className="input-field"
                value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ النهاية *</label>
              <input
                type="date" className="input-field"
                value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isManufacturing}
              onChange={e => setForm({ ...form, isManufacturing: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">موسم تصنيع</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">{editingId ? 'حفظ' : 'إنشاء'}</button>
            <button type="button" className="btn-secondary flex-1" onClick={() => setIsModalOpen(false)}>إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}