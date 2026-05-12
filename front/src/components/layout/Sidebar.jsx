import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../../store/slices/authSlice';
import {
  Home,
  DollarSign,
  Truck,
  FileText,
  Users,
  Building2,
  Package,
  RotateCcw,
  ArrowLeftRight,
  Layers,
  Banknote,
  BarChart2,
  CalendarDays,
  ClipboardList,
  UserCog,
  LogOut,
  ChevronDown,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const menuItems = [
  { key: 'home', label: 'الرئيسية', icon: Home, path: '/', exact: true },
  {
    key: 'price-list',
    label: 'قائمة الأسعار',
    icon: DollarSign,
    path: '/price-list',
  },

  {
    key: 'sales',
    label: 'المبيعات',
    icon: FileText,
    children: [
      { label: 'فاتورة مبيعات جديدة', path: '/sales/new' },
      { label: 'كل فواتير المبيعات', path: '/sales' },
    ],
  },
  {
    key: 'customers',
    label: 'العملاء',
    icon: Users,
    children: [
      { label: 'كل العملاء', path: '/customers' },
      { label: 'كشف حساب', path: '/customers/statement' },
      { label: 'كشف صنف عند عميل', path: '/customers/item-statement' },
    ],
  },
  {
    key: 'purchase',
    label: 'التوريد',
    icon: Truck,
    children: [
      { label: 'فاتورة توريد جديدة', path: '/purchase/new' },
      { label: 'كل فواتير التوريد', path: '/purchase' },
    ],
  },
  {
    key: 'suppliers',
    label: 'الموردين',
    icon: Building2,
    children: [
      { label: 'كل الموردين', path: '/suppliers' },
      { label: 'كشف حساب مورد', path: '/suppliers/statement' },
      { label: 'كشف صنف عند مورد', path: '/suppliers/item-statement' },
    ],
  },
  {
    key: 'items',
    label: 'الأصناف',
    icon: Package,
    children: [
      { label: 'كل الأصناف', path: '/items' },
      { label: 'حركات صنف', path: '/items/movements' },
    ],
  },
  {
    key: 'returns',
    label: 'المرتجعات',
    icon: RotateCcw,
    children: [
      { label: 'مرتجع عميل', path: '/returns/customer/new' },
      { label: 'مرتجع مورد', path: '/returns/supplier/new' },
      { label: 'كل المرتجعات', path: '/returns' },
    ],
  },
  {
    key: 'transfers',
    label: 'التحويلات',
    icon: ArrowLeftRight,
    children: [
      { label: 'تحويل جديد', path: '/transfers/new' },
      { label: 'كل التحويلات', path: '/transfers' },
    ],
  },
  {
    key: 'manufacturing',
    label: 'التصنيع',
    icon: Layers,
    children: [
      { label: 'أمر تصنيع جديد', path: '/manufacturing/new' },
      { label: 'كل أوامر التصنيع', path: '/manufacturing' },
      { label: 'معلمين التصنيع', path: '/workers' },
    ],
  },
];

const adminItems = [
  {
    key: 'cash-register',
    label: 'الخزنة',
    icon: Banknote,
    path: '/cash-register',
  },
  { key: 'reports', label: 'التقارير', icon: BarChart2, path: '/reports' },
  { key: 'seasons', label: 'المواسم', icon: CalendarDays, path: '/seasons' },
  { key: 'audit', label: 'سجل التدقيق', icon: ClipboardList, path: '/audit' },
  { key: 'users', label: 'المستخدمين', icon: UserCog, path: '/users' },
];

function MenuItem({ item, isCollapsed }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const Icon = item.icon;

  useEffect(() => {
    if (item.children) {
      const hasActive = item.children.some((c) => location.pathname === c.path);
      if (hasActive) setIsOpen(true);
    }
  }, [location.pathname, item.children]);

  if (!item.children) {
    return (
      <NavLink
        to={item.path}
        end={item.exact}
        title={isCollapsed ? item.label : undefined}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }`
        }
      >
        <Icon size={16} strokeWidth={1.75} className="shrink-0" />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    );
  }

  const hasActiveChild = item.children.some(
    (c) =>
      location.pathname === c.path ||
      location.pathname.startsWith(c.path + '/'),
  );

  return (
    <div>
      <button
        onClick={() => setIsOpen((o) => !o)}
        title={isCollapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
          hasActiveChild
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        <Icon size={16} strokeWidth={1.75} className="shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-right truncate">{item.label}</span>
            <ChevronDown
              size={13}
              strokeWidth={2}
              className={`shrink-0 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {!isCollapsed && isOpen && (
        <div className="mt-1 mb-1 mr-[34px] border-r border-white/10 pr-2 space-y-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              end
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                }`
              }
            >
              <span className="w-1 h-1 rounded-full bg-current opacity-50 shrink-0" />
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        dir="rtl"
        className={`
          fixed top-0 right-0 h-full z-50 flex flex-col
          bg-[#0f172a]
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-[68px]' : 'w-[240px]'}
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-auto lg:shrink-0
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-white/[0.07] shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <Home size={13} strokeWidth={2} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-blue-400 leading-tight">
                  نظام المحاسبة
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {user?.name}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => setIsCollapsed((c) => !c)}
            className="hidden lg:flex text-slate-600 hover:text-slate-300 p-1.5 rounded-md hover:bg-white/5 transition-colors shrink-0"
          >
            {isCollapsed ? (
              <PanelLeftOpen size={15} strokeWidth={1.75} />
            ) : (
              <PanelLeftClose size={15} strokeWidth={1.75} />
            )}
          </button>

          <button
            onClick={onClose}
            className="lg:hidden text-slate-600 hover:text-slate-300 p-1.5 rounded-md hover:bg-white/5 transition-colors shrink-0"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {/* User badge */}
        {!isCollapsed && (
          <div className="px-3 py-3 border-b border-white/[0.07] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.name?.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] text-slate-300 font-medium truncate">
                  {user?.username}
                </p>
                <span
                  className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 ${
                    user?.role === 'admin'
                      ? 'bg-blue-900/80 text-blue-300'
                      : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {user?.role === 'admin' ? 'أدمن' : 'مستخدم'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {menuItems.map((item) => (
            <MenuItem key={item.key} item={item} isCollapsed={isCollapsed} />
          ))}

          {user?.role === 'admin' && (
            <>
              {!isCollapsed ? (
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 pt-4 pb-1.5 select-none">
                  أدمن
                </p>
              ) : (
                <div className="mx-2 my-3 border-t border-white/[0.07]" />
              )}
              {adminItems.map((item) => (
                <MenuItem
                  key={item.key}
                  item={item}
                  isCollapsed={isCollapsed}
                />
              ))}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-white/[0.07] shrink-0">
          <button
            onClick={() => dispatch(logoutUser())}
            title={isCollapsed ? 'تسجيل الخروج' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors w-full ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut size={16} strokeWidth={1.75} className="shrink-0" />
            {!isCollapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
    </>
  );
}