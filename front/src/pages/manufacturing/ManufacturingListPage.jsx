// ─── ManufacturingListPage.jsx ────────────────────────────────────────────────
//  ✅ Lazy loading احترافي — preload عند 80% بدون إحساس بالتحميل
//  ✅ Error state مع retry
//  ✅ docNumber بدل orderNumber في الجدول
//  ✅ Season filter = reset تلقائي للقائمة
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch }   from 'react-redux';
import { Link }                       from 'react-router-dom';
import { useReactToPrint }            from 'react-to-print';
import toast                          from 'react-hot-toast';
import api                            from '../../services/api';
import { approveOrder, rejectOrder }  from '../../store/slices/manufacturingSlice';
import { useManufacturingListFilters } from './hooks/useManufacturingListFilters';
import { useInfiniteOrders }          from './hooks/useInfiniteOrders';
import { sumWeight, PRINT_STYLE } from './manufacturingConfig';
import OrderRow                       from './components/OrderRow';
import WorkerCard                     from './components/WorkerCard';
import SeasonSelector                 from './components/SeasonSelector';
import PrintView                      from './components/PrintView';
import WorkerCardsBar                 from './components/WorkerCardsBar';
import OrdersStatsBar                 from './components/OrdersStatsBar';

// ─────────────────────────────────────────────────────────────────────────────
export default function ManufacturingListPage() {
  const dispatch = useDispatch();
  const { user } = useSelector(s => s.auth);
  const isAdmin  = user?.role === 'admin';

  // ── filters ───────────────────────────────────────────────────────────────
  const filters = useManufacturingListFilters();
  const {
    status, warehouse, workerId, seasonId, search,
    setStatus, setWarehouse, setWorkerId, setSeasonId, setSearch, clearAll,
  } = filters;

  // ── lazy loading ──────────────────────────────────────────────────────────
  const {
    items: list, total, loading, loadingMore, error, hasMore,
    triggerIndex, sentinelCallbackRef, retry,
  } = useInfiniteOrders({ status, warehouse, workerId, seasonId, search });

  // ── local state ───────────────────────────────────────────────────────────
  const [workers,    setWorkers]    = useState([]);
  const [expanded,   setExpanded]   = useState(null);
  const [workerCard, setWorkerCard] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const printRef = useRef(null);

  // ── print single order ────────────────────────────────────────────────────
  const handlePrint = useReactToPrint({
    contentRef:    printRef,
    documentTitle: printOrder ? `أمر تصنيع ${printOrder.docNumber || printOrder.orderNumber}` : 'أمر تصنيع',
    pageStyle:     PRINT_STYLE,
    onAfterPrint:  () => setPrintOrder(null),
  });
  useEffect(() => {
    if (!printOrder) return;
    const t = setTimeout(() => handlePrint(), 150);
    return () => clearTimeout(t);
  }, [printOrder]); // eslint-disable-line

  // ── load workers ──────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/manufacturing/workers')
      .then(({ data }) => setWorkers(data))
      .catch(() => {});
  }, []);

  // ── approve / reject ──────────────────────────────────────────────────────
  const handleApprove = async (id) => {
    if (!window.confirm('هتوافق على أمر التصنيع وتحدث المخزن؟')) return;
    const res = await dispatch(approveOrder(id));
    if (!res.error) toast.success('تم الموافقة وتحديث المخزن ✅');
    else toast.error(res.payload);
  };
  const handleReject = async (id) => {
    if (!window.confirm('هترفض أمر التصنيع ده؟')) return;
    const res = await dispatch(rejectOrder(id));
    if (!res.error) toast.success('تم الرفض');
    else toast.error(res.payload);
  };

  // ── computed ──────────────────────────────────────────────────────────────
  const approved   = list.filter(o => o.status === 'approved');
  const totalRawWt = approved.reduce((s, o) => s + sumWeight(o.rawMaterials),   0);
  const totalOutWt = approved.reduce((s, o) => s + sumWeight(o.outputProducts), 0);

  const activeWorkerIds = [...new Set(
    list.map(o => (o.worker?._id || o.worker)?.toString()).filter(Boolean),
  )];
  const activeWorkers = workers.filter(w => activeWorkerIds.includes(w._id?.toString()));

  const hasFilters = status || warehouse || workerId || seasonId || search;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Worker card modal */}
      {workerCard && (
        <WorkerCard
          worker={workerCard}
          initialSeasonId={seasonId}
          onClose={() => setWorkerCard(null)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🏭 أوامر التصنيع</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total.toLocaleString('ar-EG')} أمر إجمالي
            {list.length < total && (
              <span className="text-xs text-gray-400 mr-2">
                (محمّل {list.length.toLocaleString('ar-EG')})
              </span>
            )}
          </p>
        </div>
        <Link to="/manufacturing/new" className="btn-primary">+ أمر جديد</Link>
      </div>

      {/* ── Worker cards ────────────────────────────────────────────────────── */}
      <WorkerCardsBar
        workers={activeWorkers}
        orders={list}
        onWorkerClick={(w) => setWorkerCard({ ...w, initialSeasonId: seasonId })}
      />

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3 items-end">

          <SeasonSelector value={seasonId} onChange={setSeasonId} />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">الحالة</label>
            <select className="input-field w-36" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="pending">⏳ معلق</option>
              <option value="approved">✅ مُوافق</option>
              <option value="rejected">❌ مرفوض</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">العنبر</label>
            <select className="input-field w-36" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
              <option value="">كل العنابر</option>
              <option value="ramses">رمسيس</option>
              <option value="october">أكتوبر</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">المعلم</label>
            <select className="input-field w-40" value={workerId} onChange={e => setWorkerId(e.target.value)}>
              <option value="">كل المعلمين</option>
              {workers.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">بحث برقم المستند</label>
            <input
              className="input-field w-44"
              placeholder="رقم المستند..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-red-500 hover:underline self-end pb-2">
              × مسح الكل
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      {approved.length > 0 && (
        <OrdersStatsBar
          approvedCount={approved.length}
          totalRawWt={totalRawWt}
          totalOutWt={totalOutWt}
        />
      )}

      {/* ── First loading skeleton ───────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse h-16 bg-gray-100" />
          ))}
        </div>
      )}

      {/* ── Orders list ─────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="space-y-3">
          {list.length === 0 && !error ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🏭</p>
              <p>مفيش أوامر تصنيع{hasFilters ? ' بهذه الفلاتر' : ''}</p>
            </div>
          ) : (
            list.map((order, idx) => (
              <div
                key={order._id}
                ref={idx === triggerIndex ? sentinelCallbackRef : undefined}
              >
                <OrderRow
                  order={order}
                  isAdmin={isAdmin}
                  expanded={expanded === order._id}
                  onToggle={() => setExpanded(expanded === order._id ? null : order._id)}
                  onApprove={() => handleApprove(order._id)}
                  onReject={() => handleReject(order._id)}
                  onPrint={() => setPrintOrder(order)}
                  onWorkerClick={() => setWorkerCard({
                    _id:            order.worker?._id || order.worker,
                    name:           order.workerName,
                    initialSeasonId: seasonId,
                  })}
                />
              </div>
            ))
          )}

          {/* ── LoadingMore indicator ───────────────────────────────────────── */}
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-gray-400 text-sm">جاري التحميل...</span>
            </div>
          )}

          {/* ── Error state ─────────────────────────────────────────────────── */}
          {error && (
            <div className="card border border-red-200 bg-red-50 flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <button
                onClick={retry}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium"
              >
                ↻ إعادة المحاولة
              </button>
            </div>
          )}

          {/* ── All loaded ──────────────────────────────────────────────────── */}
          {!hasMore && !error && list.length > 0 && (
            <p className="text-center text-xs text-gray-300 py-3">
              ✓ تم عرض كل الأوامر ({total.toLocaleString('ar-EG')})
            </p>
          )}
        </div>
      )}

      {/* ── Print target ─────────────────────────────────────────────────────── */}
      {printOrder && (
        <div className="fixed inset-0 pointer-events-none opacity-0" aria-hidden="true">
          <PrintView ref={printRef} order={printOrder} />
        </div>
      )}
    </div>
  );
}
