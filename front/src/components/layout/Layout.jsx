import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from './Sidebar';
import SeasonSelector from "../common/Seasonselector"
import { fetchSeasons, fetchActiveSeason } from '../../store/slices/seasonSlice';

export default function Layout({ children }) {
  const dispatch  = useDispatch();
  const { user }  = useSelector(s => s.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // جلب المواسم مرة واحدة عند أول تحميل
  useEffect(() => {
    dispatch(fetchActiveSeason());
    dispatch(fetchSeasons());
  }, [dispatch]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" dir="rtl">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* التوب بار */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
          {/* زرار الهامبرجر — موبايل فقط */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
          >
            <div className="space-y-1">
              <div className="w-5 h-0.5 bg-current" />
              <div className="w-5 h-0.5 bg-current" />
              <div className="w-5 h-0.5 bg-current" />
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium text-gray-600 truncate">
              مرحباً، {user?.name}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* selector الموسم — يظهر للكل */}
            <SeasonSelector />

            <span className="text-xs text-gray-400 hidden sm:block">
              {new Date().toLocaleDateString('ar-EG', {
                weekday: 'long', year: 'numeric',
                month: 'long', day: 'numeric',
              })}
            </span>
          </div>
        </header>

        {/* المحتوى */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}