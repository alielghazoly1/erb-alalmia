import { useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import api from '../../services/api';

import { usePriceList }  from './hooks/usePriceList';
import ListCards         from './components/ListCards';
import PriceTable        from './components/PriceTable';
import PrintPreview      from './components/PrintPreview';
import EntryFormModal    from './components/EntryFormModal';
import ListFormModal     from './components/ListFormModal';


export default function PriceListPage() {
  const { user } = useSelector(s => s.auth);
  const isAdmin  = user?.role === 'admin';

  const {
    availableLists,   selectedListName,  setSelectedListName,
    listDescription,  priceEntries,      isLoading,
    searchQuery,      setSearchQuery,    draggingEntryId,
    handleDragStart,  handleDragOver,    handleDrop,         handleDragEnd,
    loadPriceEntries, loadAvailableLists,
  } = usePriceList();

  /* aliases للتوافق مع باقي الكود */
  const allLists   = availableLists;
  const list       = priceEntries;
  const loading    = isLoading;
  const search     = searchQuery;
  const setSearch  = setSearchQuery;
  const draggingId = draggingEntryId;
  const loadList   = loadPriceEntries;

  const [previewMode,   setPreviewMode]   = useState(false);
  const [entryModal,    setEntryModal]    = useState(false);
  const [editingEntry,  setEditingEntry]  = useState(null);
  const [newListModal,  setNewListModal]  = useState(false);
  const [newListName,   setNewListName]   = useState('');
  const [newListDesc,   setNewListDesc]   = useState('');
  const [editListModal, setEditListModal] = useState(false);
  const [editListName,  setEditListName]  = useState('');
  const [editListDesc,  setEditListDesc]  = useState('');

  /*
   * pageRef → على الـ A4 div اللي داخل PrintPreview (forScreen=true)
   * بيتستخدم لـ html2canvas عند تصدير PDF/Word
   */
  const pageRef = useRef(null);

  /*
   * printRef → على PrintPreview منفصل مخفي خارج الـ React tree بـ portal
   * ده اللي بيطبع — بيظهر بس عند @media print
   *
   * ملاحظة: مش بنستخدم react-to-print لأنه بيفتح window جديدة
   * وبيعمل re-render يغير الـ layout.
   * بدله: div حقيقي في الـ DOM بـ CSS يخفيه شاشة ويظهره طباعة فقط.
   */
  const printRef = useRef(null);

  const priceLabels = list[0]?.prices?.map(p => p.label) || ['السعر'];
  const canExport   = !!selectedListName && list.length > 0;

  const openAddEntry  = () => { setEditingEntry(null); setEntryModal(true); };
  const openEditEntry = (entry) => { setEditingEntry(entry); setEntryModal(true); };

  const handleEntrySave = async (payload) => {
    try {
      await api.post('/price-list', payload);
      toast.success(payload.entryId ? 'تم التعديل' : 'تم الإضافة');
      setEntryModal(false); setEditingEntry(null);
      loadList(selectedListName);
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الحفظ');
      throw err;
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هتحذف هذا الصف من القائمة؟')) return;
    try {
      await api.delete(`/price-list/${id}`);
      toast.success('تم الحذف'); loadList(selectedListName);
    } catch { toast.error('خطأ في الحذف'); }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return toast.error('أدخل اسم القائمة');
    try {
      await api.post('/price-list/lists', { name: newListName.trim(), description: newListDesc.trim() });
      toast.success('تم إنشاء القائمة');
      setNewListModal(false); setNewListName(''); setNewListDesc('');
      setSelectedListName(newListName.trim()); loadAvailableLists();
    } catch (err) { toast.error(err.response?.data?.message || 'خطأ'); }
  };

  const openEditList = () => {
    const cur = allLists.find(l => l.name === selectedListName);
    setEditListName(cur?.name || ''); setEditListDesc(cur?.description || '');
    setEditListModal(true);
  };

  const handleSaveEditList = async () => {
    if (!editListName.trim()) return toast.error('أدخل الاسم');
    try {
      await api.put('/price-list/lists/info', {
        oldName: selectedListName, newName: editListName.trim(), description: editListDesc.trim(),
      });
      toast.success('تم تحديث القائمة');
      setEditListModal(false); setSelectedListName(editListName.trim());
      loadAvailableLists(); loadList(editListName.trim());
    } catch (err) { toast.error(err.response?.data?.message || 'خطأ'); }
  };
  const handlePrint = useCallback(() => {
    window.print();
  }, []);


  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        #print-area { display: none; }

        @media print {
          .screen-only { display: none !important; }
          #print-area  {
            display:  block !important;
            position: absolute;
            top:      0;
            left:     0;
            width:    210mm;
            height:   297mm;
            overflow: hidden;
            z-index:  99999;
          }
          @page {
            size:   A4 portrait;
            margin: 0;
          }
          html, body {
            margin:                         0 !important;
            padding:                        0 !important;
            width:                          210mm !important;
            -webkit-print-color-adjust:     exact !important;
            print-color-adjust:             exact !important;
          }
        }
      `}</style>

      {/*
        ── منطقة الطباعة المخفية ──
        موجودة في DOM دايماً عشان الـ CSS يوصلها
        مكانها خارج .screen-only عشان متتأثرش بـ display:none
      */}
      <div id="print-area" ref={printRef}>
        <PrintPreview
          selectedListName={selectedListName}
          listDescription={listDescription}
          list={list}
          forScreen={false}
        />
      </div>

      {/* ══ كل الصفحة دي بتتخفى عند الطباعة ══ */}
      <div className="screen-only" style={{ minHeight: '100vh' }}>

        {/* Header */}
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">قوائم الأسعار</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {selectedListName ? `${list.length} صنف في "${selectedListName}"` : 'اختر قائمة'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <>
                  <button onClick={() => setNewListModal(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm transition-colors">
                    ➕ قائمة جديدة
                  </button>
                  <button onClick={openAddEntry} disabled={!selectedListName}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm transition-colors">
                    ➕ إضافة صف
                  </button>
                </>
              )}

              <button
                onClick={() => setPreviewMode(p => !p)}
                disabled={!canExport}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                  previewMode
                    ? 'bg-purple-700 text-white'
                    : 'bg-purple-100 text-purple-800 hover:bg-purple-200 disabled:opacity-40'
                }`}>
                {previewMode ? '✕ إغلاق المعاينة' : '👁 معاينة'}
              </button>

              <button onClick={handlePrint} disabled={!canExport}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm transition-colors">
                🖨️ طباعة
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <ListCards
            allLists={allLists}
            selectedListName={selectedListName}
            setSelectedListName={setSelectedListName}
            isAdmin={isAdmin}
            onEditList={openEditList}
          />

          {selectedListName && !previewMode && (
            <div className="mb-5">
              <div className="relative max-w-md">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  className="w-full pr-11 pl-10 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                  placeholder="ابحث باسم الصنف أو المنشأ..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                )}
              </div>
            </div>
          )}

          {!selectedListName ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">📋</p>
              <p className="text-gray-400 text-lg">اختر قائمة لعرض أسعارها</p>
            </div>
          ) : loading ? (
            <div className="text-center py-20">
              <p className="text-4xl animate-pulse mb-3">⏳</p>
              <p className="text-gray-400">جاري التحميل...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">📭</p>
              <p className="text-gray-400 text-lg">لا توجد أصناف في هذه القائمة</p>
              {isAdmin && (
                <button onClick={openAddEntry}
                  className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
                  ➕ أضف أول صف
                </button>
              )}
            </div>
          ) : previewMode ? (
            <div>
             
              {/* المعاينة — pageRef على الـ A4 div الداخلي */}
              <PrintPreview
                selectedListName={selectedListName}
                listDescription={listDescription}
                list={list}
                forScreen={true}
                pageRef={pageRef}
              />
            </div>
          ) : (
            <>
              {isAdmin && (
                <div className="mb-3 px-4 py-2.5 bg-blue-50 border-r-4 border-blue-500 rounded-lg text-sm text-blue-800">
                  🎯 اسحب الصفوف لتغيير الترتيب — اضغط <strong>تعديل</strong> لتغيير الاسم والمنشأ والوحدة
                </div>
              )}
              <PriceTable
                list={list} priceLabels={priceLabels} isAdmin={isAdmin}
                draggingId={draggingId}
                onDragStart={handleDragStart} onDragOver={handleDragOver}
                onDrop={handleDrop} onDragEnd={handleDragEnd}
                onEdit={openEditEntry} onDelete={handleDelete}
              />
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {entryModal && (
        <EntryFormModal
          selectedListName={selectedListName} listDescription={listDescription}
          entry={editingEntry} onSave={handleEntrySave}
          onClose={() => { setEntryModal(false); setEditingEntry(null); }}
        />
      )}
      {newListModal && (
        <ListFormModal
          title="إنشاء قائمة جديدة"
          name={newListName} setName={setNewListName}
          desc={newListDesc} setDesc={setNewListDesc}
          onSave={handleCreateList}
          onClose={() => { setNewListModal(false); setNewListName(''); setNewListDesc(''); }}
          saveLabel="✅ إنشاء"
        />
      )}
      {editListModal && (
        <ListFormModal
          title="تعديل بيانات القائمة"
          name={editListName} setName={setEditListName}
          desc={editListDesc} setDesc={setEditListDesc}
          onSave={handleSaveEditList}
          onClose={() => setEditListModal(false)}
        />
      )}
    </div>
  );
}