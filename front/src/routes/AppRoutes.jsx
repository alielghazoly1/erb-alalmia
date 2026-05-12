// ─── routes/AppRoutes.jsx ─────────────────────────────────────────────────────
// كل الصفحات بـ React.lazy لتقليل الـ bundle size وتسريع الـ initial load
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Layout from '../components/layout/Layout';

// ── Lazy imports ──────────────────────────────────────────────────────────────
const LoginPage                  = lazy(() => import('../pages/LoginPage'));
const HomePage                   = lazy(() => import('../pages/home/HomePage'));

// الأصناف — الأهم، يتحمل بأسرع ما يمكن
const ItemsPage                  = lazy(() => import('../pages/items/ItemsPage'));
const ItemMovementsPage          = lazy(() => import('../pages/items/ItemMovementsPage'));

// باقي الصفحات
const SuppliersPage              = lazy(() => import('../pages/suppliers/SuppliersPage'));
const SupplierStatementPage      = lazy(() => import('../pages/suppliers/SupplierStatementPage'));
const SupplierItemStatementPage  = lazy(() => import('../pages/suppliers/Supplieritemstatementpage'));
const PurchaseInvoicePage        = lazy(() => import('../pages/purchase/PurchaseInvoicePage'));
const PurchaseListPage           = lazy(() => import('../pages/purchase/PurchaseListPage'));
const CustomersPage              = lazy(() => import('../pages/customers/CustomersPage'));
const CustomerStatementPage      = lazy(() => import('../pages/customers/CustomerStatementPage'));
const CustomerItemStatementPage  = lazy(() => import('../pages/customers/CustomerItemStatementPage'));
const SaleInvoicePage            = lazy(() => import('../pages/sales/SaleInvoicePage'));
const SaleListPage               = lazy(() => import('../pages/sales/SaleListPage'));
const ReturnsListPage            = lazy(() => import('../pages/returns/ReturnsListPage'));
const ReturnInvoicePage          = lazy(() => import('../pages/returns/ReturnInvoicePage'));
const ReturnViewPage             = lazy(() => import('../pages/returns/Returnviewpage'));
const TransferListPage           = lazy(() => import('../pages/transfers/TransferListPage'));
const TransferPage               = lazy(() => import('../pages/transfers/TransferPage'));
const TransferViewPage           = lazy(() => import('../pages/transfers/Transferviewpage'));
const ManufacturingListPage      = lazy(() => import('../pages/manufacturing/ManufacturingListPage'));
const ManufacturingPage          = lazy(() => import('../pages/manufacturing/ManufacturingPage'));
const WorkersPage                = lazy(() => import('../pages/workes/WorkersPage'));
const WorkerStatementPage        = lazy(() => import('../pages/workes/WorkerStatementPage'));
const ReportsPage                = lazy(() => import('../pages/reports/ReportsPage'));
const UsersPage                  = lazy(() => import('../pages/users/UsersPage'));
const SeasonsPage                = lazy(() => import('../pages/seasons/SeasonsPage'));
const PriceListPage              = lazy(() => import('../pages/price-list/PriceListPage'));
const CashRegisterPage           = lazy(() => import('../pages/cash-register/Cashregisterpage'));
const AuditPage                  = lazy(() => import('../pages/audit/Auditpage'));

// ── Fallback Loading ──────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <svg className="animate-spin w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-gray-400 text-sm">جاري التحميل...</p>
      </div>
    </div>
  );
}

// ── Guards ────────────────────────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const { user } = useSelector((s) => s.auth);
  if (!user) return <Navigate to="/login" replace />;
  return <Layout><Suspense fallback={<PageLoader />}>{children}</Suspense></Layout>;
}

function AdminRoute({ children }) {
  const { user } = useSelector((s) => s.auth);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <Layout><Suspense fallback={<PageLoader />}>{children}</Suspense></Layout>;
}

// ── Routes ────────────────────────────────────────────────────────────────────
export default function AppRoutes() {
  const { user } = useSelector((s) => s.auth);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? <Navigate to="/" replace /> :
          <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>
        }
      />

      <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />

      {/* الأصناف */}
      <Route path="/items"           element={<PrivateRoute><ItemsPage /></PrivateRoute>} />
      <Route path="/items/movements" element={<PrivateRoute><ItemMovementsPage /></PrivateRoute>} />

      {/* الموردين */}
      <Route path="/suppliers"                element={<PrivateRoute><SuppliersPage /></PrivateRoute>} />
      <Route path="/suppliers/statement"      element={<PrivateRoute><SupplierStatementPage /></PrivateRoute>} />
      <Route path="/suppliers/item-statement" element={<PrivateRoute><SupplierItemStatementPage /></PrivateRoute>} />

      {/* التوريد */}
      <Route path="/purchase"     element={<PrivateRoute><PurchaseListPage /></PrivateRoute>} />
      <Route path="/purchase/new" element={<PrivateRoute><PurchaseInvoicePage /></PrivateRoute>} />
      <Route path="/purchase/:id" element={<PrivateRoute><PurchaseInvoicePage /></PrivateRoute>} />

      {/* العملاء */}
      <Route path="/customers"                element={<PrivateRoute><CustomersPage /></PrivateRoute>} />
      <Route path="/customers/statement"      element={<PrivateRoute><CustomerStatementPage /></PrivateRoute>} />
      <Route path="/customers/item-statement" element={<PrivateRoute><CustomerItemStatementPage /></PrivateRoute>} />

      {/* المبيعات */}
      <Route path="/sales"     element={<PrivateRoute><SaleListPage /></PrivateRoute>} />
      <Route path="/sales/new" element={<PrivateRoute><SaleInvoicePage /></PrivateRoute>} />
      <Route path="/sales/:id" element={<PrivateRoute><SaleInvoicePage viewMode /></PrivateRoute>} />

      {/* المرتجعات */}
      <Route path="/returns"                   element={<PrivateRoute><ReturnsListPage /></PrivateRoute>} />
      <Route path="/returns/:id"               element={<PrivateRoute><ReturnViewPage /></PrivateRoute>} />
      <Route path="/returns/customer/:id/edit" element={<PrivateRoute><ReturnInvoicePage type="customer_return" /></PrivateRoute>} />
      <Route path="/returns/supplier/:id/edit" element={<PrivateRoute><ReturnInvoicePage type="supplier_return" /></PrivateRoute>} />
      <Route path="/returns/customer/new"      element={<PrivateRoute><ReturnInvoicePage type="customer_return" /></PrivateRoute>} />
      <Route path="/returns/supplier/new"      element={<PrivateRoute><ReturnInvoicePage type="supplier_return" /></PrivateRoute>} />

      {/* التحويلات */}
      <Route path="/transfers"          element={<PrivateRoute><TransferListPage /></PrivateRoute>} />
      <Route path="/transfers/new"      element={<PrivateRoute><TransferPage /></PrivateRoute>} />
      <Route path="/transfers/:id"      element={<PrivateRoute><TransferViewPage /></PrivateRoute>} />
      <Route path="/transfers/:id/edit" element={<PrivateRoute><TransferPage /></PrivateRoute>} />

      {/* التصنيع */}
      <Route path="/manufacturing"           element={<PrivateRoute><ManufacturingListPage /></PrivateRoute>} />
      <Route path="/manufacturing/new"       element={<PrivateRoute><ManufacturingPage /></PrivateRoute>} />
      <Route path="/manufacturing/:id/edit"  element={<PrivateRoute><ManufacturingPage /></PrivateRoute>} />

      {/* العمال */}
      <Route path="/workers"               element={<PrivateRoute><WorkersPage /></PrivateRoute>} />
      <Route path="/workers/:id/statement" element={<PrivateRoute><WorkerStatementPage /></PrivateRoute>} />

      {/* قائمة الأسعار */}
      <Route path="/price-list" element={<PrivateRoute><PriceListPage /></PrivateRoute>} />

      {/* أدمن فقط */}
      <Route path="/reports"       element={<AdminRoute><ReportsPage /></AdminRoute>} />
      <Route path="/users"         element={<AdminRoute><UsersPage /></AdminRoute>} />
      <Route path="/seasons"       element={<AdminRoute><SeasonsPage /></AdminRoute>} />
      <Route path="/cash-register" element={<AdminRoute><CashRegisterPage /></AdminRoute>} />
      <Route path="/audit"         element={<AdminRoute><AuditPage /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
