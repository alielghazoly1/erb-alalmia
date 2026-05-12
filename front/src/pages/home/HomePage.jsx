import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { setSelectedSeason } from '../../store/slices/seasonSlice';
import api from '../../services/api';
import {
  DollarSign,
  FileText,
  Truck,
  ArrowLeftRight,
  Users,
  ClipboardList,
  RotateCcw,
  Building2,
  Package,
  Layers,
  BarChart2,
  UserCog,
  CalendarDays,
  Eye,
  Clock,
  TrendingUp,
  ShoppingCart,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { activeSeason, selectedSeasonId, seasons } = useSelector(
    (s) => s.season,
  );
  const isAdmin = user?.role === 'admin';
  const [stats, setStats] = useState(null);

  const selectedSeason =
    seasons.find((s) => s._id === selectedSeasonId) || activeSeason;
  const isViewingActive = selectedSeasonId === activeSeason?._id;

  useEffect(() => {
    if (!isAdmin) return;
    const params = selectedSeasonId ? { seasonId: selectedSeasonId } : {};
    api
      .get('/reports/stats', { params })
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, [isAdmin, selectedSeasonId]);

  const warehouseLabel = {
    ramses: 'رمسيس',
    october: 'أكتوبر',
    both: 'الاثنين',
  };

  const quickLinks = [
    { label: 'قائمة الأسعار',    path: '/price-list',              icon: DollarSign,    iconBg: 'bg-yellow-50',  iconColor: 'text-yellow-600' },
    { label: 'فاتورة مبيعات',    path: '/sales/new',               icon: FileText,      iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { label: 'فاتورة توريد',     path: '/purchase/new',            icon: Truck,         iconBg: 'bg-blue-50',    iconColor: 'text-blue-600' },
    { label: 'تحويل بضاعة',     path: '/transfers/new',           icon: ArrowLeftRight, iconBg: 'bg-violet-50',  iconColor: 'text-violet-600' },
    { label: 'العملاء',          path: '/customers',               icon: Users,         iconBg: 'bg-slate-100',  iconColor: 'text-slate-600' },
    { label: 'كشف حساب عميل',   path: '/customers/statement',     icon: ClipboardList, iconBg: 'bg-slate-100',  iconColor: 'text-slate-600' },
    { label: 'مرتجع عميل',      path: '/returns/customer/new',    icon: RotateCcw,     iconBg: 'bg-orange-50',  iconColor: 'text-orange-600' },
    { label: 'الموردين',         path: '/suppliers',               icon: Building2,     iconBg: 'bg-slate-100',  iconColor: 'text-slate-600' },
    { label: 'كشف حساب مورد',   path: '/suppliers/statement',     icon: ClipboardList, iconBg: 'bg-slate-100',  iconColor: 'text-slate-600' },
    { label: 'مرتجع مورد',      path: '/returns/supplier/new',    icon: RotateCcw,     iconBg: 'bg-orange-50',  iconColor: 'text-orange-600' },
    { label: 'الأصناف',          path: '/items',                   icon: Package,       iconBg: 'bg-slate-100',  iconColor: 'text-slate-600' },
    { label: 'أمر تصنيع',        path: '/manufacturing/new',       icon: Layers,        iconBg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  ];

  const adminQuickLinks = [
    { label: 'التقارير',    path: '/reports', icon: BarChart2,    iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
    { label: 'المستخدمين', path: '/users',   icon: UserCog,      iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
    { label: 'المواسم',    path: '/seasons', icon: CalendarDays, iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
  ];

  const statCards = [
    { label: 'المبيعات',  value: stats?.totalSales,      unit: 'ج.م',   icon: TrendingUp,   iconColor: 'text-emerald-500', color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
    { label: 'التوريد',   value: stats?.totalPurchases,  unit: 'ج.م',   icon: ShoppingCart, iconColor: 'text-blue-500',    color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-100' },
    { label: 'العملاء',   value: stats?.totalCustomers,  unit: 'عميل',  icon: Users,        iconColor: 'text-violet-500',  color: 'text-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-100' },
    { label: 'الأصناف',   value: stats?.totalItems,      unit: 'صنف',   icon: Package,      iconColor: 'text-slate-500',   color: 'text-slate-700',   bg: 'bg-slate-50',    border: 'border-slate-200' },
  ];

  return (
    <div className="max-w-4xl mx-auto">

      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-gray-800">
          أهلاً، {user?.name} 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {new Date().toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Viewing old season warning */}
      {!isViewingActive && selectedSeason && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Eye size={15} className="text-amber-500 shrink-0" />
            <p className="text-sm font-medium text-amber-700">
              أنت بتشوف بيانات موسم:{' '}
              <span className="font-bold">{selectedSeason.name}</span>
              {isAdmin && ' — وضع عرض فقط'}
            </p>
          </div>
          <button
            className="text-xs text-amber-700 underline underline-offset-2"
            onClick={() => dispatch(setSelectedSeason(activeSeason?._id))}
          >
            رجّع للموسم النشط
          </button>
        </div>
      )}

      {/* Admin stats */}
      {isAdmin && stats && (
        <>
          {/* Season bar */}
          {selectedSeason && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={15} className="text-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-700">
                    {isViewingActive ? 'الموسم النشط:' : 'موسم:'}{' '}
                    {selectedSeason.name}
                  </p>
                  <p className="text-xs text-blue-400 mt-0.5">
                    {new Date(selectedSeason.startDate).toLocaleDateString('ar-EG')}
                    {' — '}
                    {new Date(selectedSeason.endDate).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Link to="/seasons" className="text-xs text-blue-600 hover:underline">
                  إدارة المواسم
                </Link>
              )}
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {statCards.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className={`${item.bg} border ${item.border} rounded-xl p-4`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className=" text-lg font-medium text-gray-500">{item.label}</p>
                    <Icon size={20} className={item.iconColor} strokeWidth={2} />
                  </div>
                  <p className={`text-xl font-bold ${item.color}`}>
                    {typeof item.value === 'number'
                      ? item.value.toLocaleString()
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.unit}</p>
                </div>
              );
            })}
          </div>

          {/* Pending approvals */}
          {isViewingActive &&
            stats.pending &&
            Object.values(stats.pending).some((v) => v > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                <p className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-amber-500" strokeWidth={2} />
                  في انتظار موافقتك
                </p>
                <div className="flex gap-2.5 flex-wrap">
                  {stats.pending.sales > 0 && (
                    <Link
                      to="/sales"
                      className="flex items-center gap-1.5 text-xs text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors"
                    >
                      <FileText size={11} strokeWidth={2} />
                      {stats.pending.sales} مبيعات
                    </Link>
                  )}
                  {stats.pending.purchases > 0 && (
                    <Link
                      to="/purchase"
                      className="flex items-center gap-1.5 text-xs text-blue-700 bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      <Truck size={11} strokeWidth={2} />
                      {stats.pending.purchases} توريد
                    </Link>
                  )}
                  {stats.pending.returns > 0 && (
                    <Link
                      to="/returns"
                      className="flex items-center gap-1.5 text-xs text-orange-700 bg-white px-3 py-1.5 rounded-lg border border-orange-200 hover:bg-orange-50 transition-colors"
                    >
                      <RotateCcw size={11} strokeWidth={2} />
                      {stats.pending.returns} مرتجعات
                    </Link>
                  )}
                  {stats.pending.transfers > 0 && (
                    <Link
                      to="/transfers"
                      className="flex items-center gap-1.5 text-xs text-violet-700 bg-white px-3 py-1.5 rounded-lg border border-violet-200 hover:bg-violet-50 transition-colors"
                    >
                      <ArrowLeftRight size={11} strokeWidth={2} />
                      {stats.pending.transfers} تحويلات
                    </Link>
                  )}
                </div>
              </div>
            )}
        </>
      )}

      {/* Quick links */}
      <div className="mb-6">
        <h2 className="text-[11px] font-semibold text-gray-400 mb-3 uppercase tracking-widest">
          وصول سريع
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {[...quickLinks, ...(isAdmin ? adminQuickLinks : [])].map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-gray300 bg-white hover:border-gray-500 hover:bg-gray-50 transition-all group"
              >
                <div className={`w-9 h-9 rounded-lg ${link.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon size={20} strokeWidth={1.75} className={link.iconColor} />
                </div>
                <span className="text-lg font-medium text-gray-800 group-hover:text-gray-900 transition-colors">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* User info */}
      <div className="card">
        <h2 className="text-[11px] font-semibold text-gray-400 mb-4 uppercase tracking-widest">
          بياناتك
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div>
            <p className="text-gray-400 text-xs mb-1.5">الاسم</p>
            <p className="text-sm font-medium text-gray-800">{user?.name}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1.5">اسم الدخول</p>
            <p className="text-sm font-medium text-gray-700">{user?.username}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1.5">الصلاحية</p>
            <span
              className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${
                user?.role === 'admin'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {user?.role === 'admin' ? 'أدمن' : 'مستخدم'}
            </span>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1.5">المخزن</p>
            <p className="text-sm font-medium text-gray-700">
              {warehouseLabel[user?.warehouse] || user?.warehouse}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}