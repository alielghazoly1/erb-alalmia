// ─── pages/items/ItemsPage.jsx ────────────────────────────────────────────────
// صفحة الأصناف مع infinite scroll + طباعة احترافية
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchItems,
  fetchMoreItems,
  createItem,
  updateItem,
  deleteItem,
} from '../../store/slices/itemSlice';
import { useInfiniteScroll } from '../../hook/useInfiniteScroll';
import toast from 'react-hot-toast';

import ItemsToolbar   from './components/ItemsToolbar';
import ItemsTable     from './components/ItemsTable';
import ItemFormModal  from './components/ItemFormModal';
import { printItems } from './components/ItemsPrint';

// ── Constants ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  code: '', name: '', category: '', unit: 'كرتون',
  defaultWeight: '', isRawMaterial: false, notes: '',
};
const LOAD_THRESHOLD = 0.8; // يبدأ يحمل لما يوصل 80% من السينتينل

// ── Component ─────────────────────────────────────────────────────────────────
export default function ItemsPage() {
  const dispatch = useDispatch();
  const { list, total, currentPage, hasMore, loading, loadingMore } =
    useSelector((s) => s.items);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';

  // ── Modal state ──────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId,   setEditingId]   = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search,    setSearch]    = useState('');
  const [filterRaw, setFilterRaw] = useState('all');

  // نحتاج ref للفلاتر الحالية عشان نستخدمها في loadMore بدون re-create الـ callback
  const filtersRef = useRef({ search, filterRaw, currentPage });
  filtersRef.current = { search, filterRaw, currentPage };

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const params = buildParams({ search, filterRaw, page: 1 });
    dispatch(fetchItems(params));
  }, [dispatch, search, filterRaw]); // إعادة فيتش لو الفلاتر اتغيرت

  // ── Load more (infinite scroll) ───────────────────────────────────────────
  const loadMore = useCallback(() => {
    const { search: s, filterRaw: f, currentPage: p } = filtersRef.current;
    const nextPage = p + 1;
    const params   = buildParams({ search: s, filterRaw: f, page: nextPage });
    dispatch(fetchMoreItems(params));
  }, [dispatch]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    loading: loadingMore,
    threshold: LOAD_THRESHOLD,
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function buildParams({ search, filterRaw, page }) {
    const p = { page };
    if (search.trim()) p.search = search.trim();
    if (filterRaw === 'raw')     p.isRawMaterial = 'true';
    if (filterRaw === 'product') p.isRawMaterial = 'false';
    return p;
  }

  // ── Modal actions ─────────────────────────────────────────────────────────
  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setIsModalOpen(true); };
  const openEdit   = (item) => {
    setForm({ ...item, defaultWeight: item.defaultWeight || '' });
    setEditingId(item._id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) return toast.error('الكود والاسم مطلوبين');
    const payload = { ...form, defaultWeight: Number(form.defaultWeight) || 0 };

    if (editingId) {
      const res = await dispatch(updateItem({ id: editingId, ...payload }));
      if (!res.error) { toast.success('تم التعديل'); setIsModalOpen(false); }
      else toast.error(res.payload);
    } else {
      const res = await dispatch(createItem(payload));
      if (!res.error) { toast.success('تم الإضافة'); setIsModalOpen(false); }
      else toast.error(res.payload);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هتحذف الصنف ده؟')) return;
    await dispatch(deleteItem(id));
    toast.success('تم الحذف');
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  // الطباعة تطبع الموجود في الليستة (المحملة)
  const handlePrint = (warehouse) => {
    if (list.length === 0) return toast.error('مفيش أصناف للطباعة');
    printItems(list, warehouse);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <ItemsToolbar
        total={total}
        search={search}
        onSearch={setSearch}
        filterRaw={filterRaw}
        onFilterRaw={setFilterRaw}
        isAdmin={isAdmin}
        onAdd={openCreate}
        onPrintRamses={() => handlePrint('ramses')}
        onPrintOctober={() => handlePrint('october')}
        onPrintAll={() => handlePrint('all')}
      />

      {loading && list.length === 0 ? (
        <div className="card text-center py-16">
          <div className="inline-flex flex-col items-center gap-3 text-blue-500">
            <svg className="animate-spin w-10 h-10" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-gray-400">جاري تحميل الأصناف...</span>
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-5xl mb-3">📦</p>
          <p className="text-gray-400 text-lg">مفيش أصناف</p>
          <p className="text-gray-300 text-sm mt-1">جرب تغير الفلتر أو تضيف صنف جديد</p>
        </div>
      ) : (
        <ItemsTable
          ref={sentinelRef}
          items={list}
          isAdmin={isAdmin}
          onEdit={openEdit}
          onDelete={handleDelete}
          loadingMore={loadingMore}
          hasMore={hasMore}
        />
      )}

      <ItemFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        editingId={editingId}
      />
    </div>
  );
}
