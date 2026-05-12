import { useState, useEffect } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

export function usePriceList() {
  const [availableLists,    setAvailableLists]    = useState([]);
  const [selectedListName,  setSelectedListName]  = useState('');
  const [listDescription,   setListDescription]   = useState('');
  const [priceEntries,      setPriceEntries]      = useState([]);
  const [isLoading,         setIsLoading]         = useState(false);
  const [searchQuery,       setSearchQuery]       = useState('');
  const [draggingEntryId,   setDraggingEntryId]   = useState(null);

  /* ── تحميل كل القوائم المتاحة ── */
  const loadAvailableLists = async () => {
    try {
      const { data } = await api.get('/price-list/lists');
      setAvailableLists(data);
      if (data.length > 0 && !selectedListName) {
        setSelectedListName(data[0].name);
      }
    } catch {
      // صامت — مفيش toast عشان بيتستدعى عند الـ mount
    }
  };

  /* ── تحميل أصناف قائمة محددة ── */
  const loadPriceEntries = async (listName) => {
    if (!listName) return;
    setIsLoading(true);
    try {
      const requestConfig = searchQuery ? { params: { search: searchQuery } } : {};
      const { data }      = await api.get(`/price-list/${listName}/items`, requestConfig);
      setPriceEntries(data.items || []);
      setListDescription(data.description || '');
    } catch {
      setPriceEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Drag & Drop ── */
  const handleDragStart = (e, entry) => {
    setDraggingEntryId(entry._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetEntry) => {
    e.preventDefault();
    if (draggingEntryId === targetEntry._id) {
      setDraggingEntryId(null);
      return;
    }

    const fromIndex = priceEntries.findIndex(item => item._id === draggingEntryId);
    const toIndex   = priceEntries.findIndex(item => item._id === targetEntry._id);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggingEntryId(null);
      return;
    }

    const reorderedEntries = [...priceEntries];
    const [movedEntry]     = reorderedEntries.splice(fromIndex, 1);
    reorderedEntries.splice(toIndex, 0, movedEntry);

    setPriceEntries(reorderedEntries);
    setDraggingEntryId(null);

    try {
      await api.post('/price-list/reorder', {
        listName:        selectedListName,
        orderedEntryIds: reorderedEntries.map(item => item._id),
      });
      toast.success('تم حفظ الترتيب ✅');
    } catch {
      toast.error('خطأ في حفظ الترتيب');
      loadPriceEntries(selectedListName);
    }
  };

  const handleDragEnd = () => setDraggingEntryId(null);

  /* ── Effects ── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAvailableLists(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPriceEntries(selectedListName); }, [selectedListName, searchQuery]);

  return {
    /* القوائم */
    availableLists,
    selectedListName,
    setSelectedListName,
    listDescription,
    loadAvailableLists,

    /* الأصناف */
    priceEntries,
    isLoading,
    loadPriceEntries,

    /* البحث */
    searchQuery,
    setSearchQuery,

    /* Drag & Drop */
    draggingEntryId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}
