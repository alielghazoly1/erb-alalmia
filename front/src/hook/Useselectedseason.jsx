import { useSelector } from 'react-redux';

/**
 * useSelectedSeason
 * بيرجع الـ seasonId اللي المستخدم شايفه (أو الموسم النشط لو مفيش اختيار)
 */
export function useSelectedSeason() {
  const { selectedSeasonId, activeSeason } = useSelector(s => s.season);
  return selectedSeasonId || activeSeason?._id || null;
}