// ─── LazySupplierStatementTable.jsx ──────────────────────────────────────────
// Wrapper يعيد استخدام LazyStatementTable المشترك مع إعدادات المورد
import LazyStatementTable from '../../customers/components/LazyStatementTable';

export default function LazySupplierStatementTable(props) {
  return <LazyStatementTable {...props} entityType="supplier" />;
}
