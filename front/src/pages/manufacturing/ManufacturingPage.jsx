// ─── ManufacturingPage.jsx ────────────────────────────────────────────────────
//  ✅ الخامات والمنتجات تحت بعض (stack vertical) — مش جنب بعض
//  ✅ مقسّم لكمبوننتات: OrderHeader / ItemSection / WeightSummary
//  ✅ clean code — لا logic في الـ JSX
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect }     from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate }   from 'react-router-dom';
import { createOrder, updateOrder, fetchOrderById } from '../../store/slices/manufacturingSlice';
import { fetchWorkers }             from '../../store/slices/workerSlice';
import toast                        from 'react-hot-toast';

import { useManufacturingItems }    from './hooks/useManufacturingItems';
import MfgItemsTable                from './components/MfgItemsTable';
import MfgItemInputRow              from './components/MfgItemInputRow';
import OrderHeader                  from './components/OrderHeader';
import ItemSection                  from './components/ItemSection';
import WeightSummary                from './components/WeightSummary';
import { todayStr }                 from './manufacturingConfig';

// ─────────────────────────────────────────────────────────────────────────────
export default function ManufacturingPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id }   = useParams();
  const isEdit   = !!id;

  const { user }          = useSelector(s => s.auth);
  const { list: workers } = useSelector(s => s.workers);
  const isAdmin           = user?.role === 'admin';

  // ── header state ────────────────────────────────────────────────────────────
  const [date,           setDate]           = useState(todayStr());
  const [docNumber,      setDocNumber]      = useState('');
  const [warehouse,      setWarehouse]      = useState('ramses');
  const [workerId,       setWorkerId]       = useState('');
  const [notes,          setNotes]          = useState('');
  const [seasonId,       setSeasonId]       = useState('');
  const [saving,         setSaving]         = useState(false);
  const [loadingEdit,    setLoadingEdit]    = useState(isEdit);
  const [existingStatus, setExistingStatus] = useState('pending');

  // ── item hooks (خامات + منتجات) ─────────────────────────────────────────────
  const raw = useManufacturingItems({ warehouse, checkStock: true  });
  const out = useManufacturingItems({ warehouse, checkStock: false });

  // ── load workers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchWorkers({ isActive: true }));
  }, [dispatch]);

  // ── load for edit ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    dispatch(fetchOrderById(id)).then(res => {
      const data = res.payload;
      if (!data) { toast.error('الأمر مش موجود'); navigate(-1); return; }
      if (data.status === 'rejected') {
        toast.error('مش ممكن تعدل أمر مرفوض'); navigate(-1); return;
      }
      if (data.status === 'approved' && !isAdmin) {
        toast.error('فقط الأدمن يعدل معتمد'); navigate(-1); return;
      }
      setExistingStatus(data.status);
      setDate(data.date?.split('T')[0] || todayStr());
      setDocNumber(data.docNumber || '');
      setWarehouse(data.warehouse || 'ramses');
      setWorkerId(data.worker?._id || data.worker || '');
      setNotes(data.notes || '');
      setSeasonId(data.season?._id || data.season || '');
      raw.loadRows(data.rawMaterials   || []);
      out.loadRows(data.outputProducts || []);
      setLoadingEdit(false);
    });
  }, [id, isEdit]); // eslint-disable-line

  // ── computed ─────────────────────────────────────────────────────────────────
  const filteredWorkers = workers.filter(
    w => w.isActive !== false && (w.scope === warehouse || w.scope === 'both'),
  );
  const isApprovedEdit = isEdit && existingStatus === 'approved';
  const whLabel        = warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر';
  const canSave        = raw.savedRows.length > 0 && out.savedRows.length > 0;

  // ── submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!warehouse)              return toast.error('حدد العنبر');
    if (raw.savedRows.length === 0) return toast.error('أضف خامة واحدة على الأقل');
    if (out.savedRows.length === 0) return toast.error('أضف منتج واحد على الأقل');

    if (isApprovedEdit) {
      const ok = window.confirm(
        '⚠️ هتعدل على أمر معتمد!\nده هيعكس حركات المخزن ويطبق الجديدة.\nمتأكد؟',
      );
      if (!ok) return;
    }

    setSaving(true);
    const payload = {
      date,
      docNumber:      docNumber.trim() || undefined,
      warehouse,
      workerId:       workerId  || undefined,
      notes,
      seasonId:       seasonId  || undefined,
      rawMaterials:   raw.toPayload(),
      outputProducts: out.toPayload(),
    };

    try {
      if (isEdit) {
        const res = await dispatch(updateOrder({ id, ...payload }));
        if (!res.error) { toast.success('تم تعديل أمر التصنيع ✅'); navigate(-1); }
        else toast.error(res.payload || 'خطأ في التعديل');
      } else {
        const res = await dispatch(createOrder(payload));
        if (!res.error) {
          const { orderNumber, docNumber: doc } = res.payload;
          toast.success(`تم حفظ الأمر ${orderNumber}${doc ? ` (${doc})` : ''} ✅`);
          raw.resetRows(); out.resetRows();
          setNotes(''); setDocNumber(''); setDate(todayStr()); setWorkerId('');
        } else {
          toast.error(res.payload || 'خطأ في الحفظ');
        }
      }
    } catch {
      toast.error('خطأ غير متوقع');
    } finally {
      setSaving(false);
    }
  };

  // ── loading state ─────────────────────────────────────────────────────────────
  if (loadingEdit) {
    return (
      <div className="text-center py-20 text-gray-400 animate-pulse">
        <p className="text-4xl mb-3">⚙️</p>
        <p>جاري تحميل الأمر...</p>
      </div>
    );
  }

  // ── input rows (غير محفوظة بعد) ──────────────────────────────────────────────
  const rawInputRows = raw.rows.filter(r => !r.saved);
  const outInputRows = out.rows.filter(r => !r.saved);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">

      {/* ── Page title + actions ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEdit ? '✏️ تعديل أمر التصنيع' : '🏭 أمر تصنيع جديد'}
          </h1>
          {isApprovedEdit && (
            <p className="text-sm mt-1 px-3 py-1 rounded-full inline-block text-red-700 bg-red-50 border border-red-200">
              ⚠️ تعديل على أمر معتمد — سيُعاد حساب المخزن
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {isEdit && (
            <button className="btn-secondary" onClick={() => navigate(-1)}>← رجوع</button>
          )}
          <button
            className={isApprovedEdit ? 'btn-danger' : 'btn-primary'}
            onClick={handleSubmit}
            disabled={saving || !canSave}
          >
            {saving
              ? 'جاري الحفظ...'
              : `💾 حفظ (${raw.savedRows.length} خامة — ${out.savedRows.length} منتج)`}
          </button>
        </div>
      </div>

      {/* تنبيه الأمر المعتمد */}
      {isApprovedEdit && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-2">
          <span>⚠️</span>
          <span>أمر <strong>معتمد</strong> — أي تعديل يُعيد احتساب المخزن تلقائياً</span>
        </div>
      )}

      {/* ── بيانات الأمر ──────────────────────────────────────────────────────── */}
      <OrderHeader
        isEdit={isEdit}
        date={date}           setDate={setDate}
        docNumber={docNumber} setDocNumber={setDocNumber}
        warehouse={warehouse} setWarehouse={setWarehouse}
        workerId={workerId}   setWorkerId={setWorkerId}
        notes={notes}         setNotes={setNotes}
        seasonId={seasonId}   setSeasonId={setSeasonId}
        filteredWorkers={filteredWorkers}
        whLabel={whLabel}
      />

      {/* ══════════ الخامات المصروفة ══════════ */}
      <div className="mb-4">
        <ItemSection title="الخامات المصروفة" icon="📤" color="orange">
          <MfgItemsTable
            savedRows={raw.savedRows}
            totalWeightAll={raw.totalWeightAll}
            onEditRow={raw.handleEditRow}
            onDeleteRow={raw.handleDeleteRow}
          />
          {rawInputRows.map(row => (
            <MfgItemInputRow
              key={row.id}
              row={row}
              totalWeightInput={raw.totalWeightInput}
              checkStock
              itemRefs={raw.itemRefs}
              qtyRefs={raw.qtyRefs}
              wtRefs={raw.wtRefs}
              twRefs={raw.twRefs}
              onItemSelect={raw.handleItemSelect}
              onUpdateRow={raw.updateRow}
              onTotalWeightChange={raw.handleTotalWeightChange}
              onKeyDown={raw.handleKeyDown}
              onSaveRow={raw.handleSaveRow}
              onCancelRow={raw.handleCancelRow}
            />
          ))}
        </ItemSection>
      </div>

      {/* ══════════ المنتجات الناتجة ══════════ */}
      <div className="mb-4">
        <ItemSection title="المنتجات الناتجة" icon="📦" color="green">
          <MfgItemsTable
            savedRows={out.savedRows}
            totalWeightAll={out.totalWeightAll}
            onEditRow={out.handleEditRow}
            onDeleteRow={out.handleDeleteRow}
          />
          {outInputRows.map(row => (
            <MfgItemInputRow
              key={row.id}
              row={row}
              totalWeightInput={out.totalWeightInput}
              checkStock={false}
              itemRefs={out.itemRefs}
              qtyRefs={out.qtyRefs}
              wtRefs={out.wtRefs}
              twRefs={out.twRefs}
              onItemSelect={out.handleItemSelect}
              onUpdateRow={out.updateRow}
              onTotalWeightChange={out.handleTotalWeightChange}
              onKeyDown={out.handleKeyDown}
              onSaveRow={out.handleSaveRow}
              onCancelRow={out.handleCancelRow}
            />
          ))}
        </ItemSection>
      </div>

      {/* ══════════ ملخص الأوزان ══════════ */}
      {(raw.savedRows.length > 0 || out.savedRows.length > 0) && (
        <WeightSummary rawTotal={raw.totalWeightAll} outTotal={out.totalWeightAll} />
      )}

    </div>
  );
}