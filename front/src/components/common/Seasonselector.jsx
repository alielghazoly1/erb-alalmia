import { useDispatch, useSelector } from 'react-redux';
import { setSelectedSeason } from '../../store/slices/seasonSlice';

/**
 * SeasonSelector — بيظهر في الهيدر
 * الأدمن والمستخدم العادي يقدروا يشوفوا بيانات أي موسم
 * بس الأدمن يقدر يفعّل موسم من صفحة المواسم
 */
export default function SeasonSelector() {
  const dispatch = useDispatch();
  const { seasons, activeSeason, selectedSeasonId } = useSelector(s => s.season);

  if (!seasons.length) return null;

  const handleChange = (e) => {
    dispatch(setSelectedSeason(e.target.value || null));
  };

  const currentValue = selectedSeasonId || activeSeason?._id || '';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 hidden sm:block">الموسم:</span>
      <select
        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700
                   focus:outline-none focus:ring-2 focus:ring-blue-300 max-w-[160px]"
        value={currentValue}
        onChange={handleChange}
      >
        {seasons.map(s => (
          <option key={s._id} value={s._id}>
            {s.name} {s.isActive ? '✅' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}