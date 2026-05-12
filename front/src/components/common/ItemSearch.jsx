// ─── components/common/ItemSearch.jsx ────────────────────────────────────────
// البحث عن صنف — حل شامل لكل المشاكل:
//   ✅ AbortController — إلغاء الـ request القديم فوراً لو المستخدم كتب حاجة جديدة
//   ✅ Race condition — بنتحقق إن الـ query اللي جه الـ response ليه مطابق للـ query الحالي
//   ✅ Loading state — spinner أثناء الجلب
//   ✅ Empty state — رسالة واضحة لو مفيش نتايج
//   ✅ Error state — رسالة لو الـ API وقع
//   ✅ Debounce 250ms — بس مش بنتأخر في إلغاء الـ request القديم
//   ✅ defaultValue — للـ edit mode

import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import api from '../../services/api';

const ItemSearch = forwardRef(function ItemSearch(
  {
    onSelect,
    onKeyDown,
    placeholder   = 'كود أو اسم الصنف...',
    getFocusTrigger,
    defaultValue  = '',
  },
  ref
) {
  const [query,          setQuery]          = useState(defaultValue);
  const [results,        setResults]        = useState([]);
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [status,         setStatus]         = useState('idle'); // idle | loading | empty | error

  const debounceRef  = useRef(null);
  const abortRef     = useRef(null); // AbortController الحالي
  const latestQuery  = useRef('');   // آخر query بُعت — للـ race condition guard
  const dropdownRef  = useRef(null);
  const inputRef     = useRef(null);
  const listRef      = useRef(null);

  // ── Expose input ref للأب ──────────────────────────────────────────────
  useEffect(() => {
    if (!ref) return;
    if (typeof ref === 'function') ref(inputRef.current);
    else ref.current = inputRef.current;
  }, [ref]);

  // ── getFocusTrigger — يمكّن الأب يعمل focus ويصفي الحقل ─────────────
  useEffect(() => {
    if (getFocusTrigger) {
      getFocusTrigger(() => {
        setQuery('');
        setResults([]);
        setShowDropdown(false);
        setStatus('idle');
        inputRef.current?.focus();
      });
    }
  }, [getFocusTrigger]);

  // ── إغلاق الـ dropdown لما يضغط برا ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── cleanup عند الـ unmount ───────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  // ── دالة الجلب الفعلية ────────────────────────────────────────────────
  const fetchItems = useCallback(async (searchVal) => {
    // إلغاء الـ request اللي قبله فوراً
    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;
    latestQuery.current = searchVal;

    setStatus('loading');
    try {
      const { data } = await api.get('/items', {
        params: { search: searchVal, page: 1 },
        signal: controller.signal,
      });

      // Race condition guard — لو اتغير الـ query بعد ما الـ response وصل نتجاهله
      if (latestQuery.current !== searchVal) return;

      const list = Array.isArray(data) ? data : (data.items || []);
      setResults(list);
      setHighlightIndex(-1);
      setStatus(list.length === 0 ? 'empty' : 'idle');
      setShowDropdown(true);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return; // طبيعي
      if (latestQuery.current !== searchVal) return;
      setStatus('error');
      setShowDropdown(true); // نفتح عشان نظهر رسالة الخطأ
    }
  }, []);

  // ── onChange ──────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);

    if (!val.trim()) {
      abortRef.current?.abort();
      setResults([]);
      setShowDropdown(false);
      setStatus('idle');
      latestQuery.current = '';
      return;
    }

    // debounce 250ms — كافي بدون ما يبطئ التجربة
    debounceRef.current = setTimeout(() => fetchItems(val.trim()), 250);
  };

  // ── Select ────────────────────────────────────────────────────────────
  const handleSelect = (item) => {
    setQuery(`${item.code} — ${item.name}`);
    setShowDropdown(false);
    setResults([]);
    setStatus('idle');
    setHighlightIndex(-1);
    onSelect(item);
  };

  // ── Keyboard navigation ───────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (showDropdown && results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => {
          const n = Math.min(i + 1, results.length - 1);
          listRef.current?.children[n]?.scrollIntoView({ block: 'nearest' });
          return n;
        });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => {
          const n = Math.max(i - 1, 0);
          listRef.current?.children[n]?.scrollIntoView({ block: 'nearest' });
          return n;
        });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIndex >= 0 && results[highlightIndex])
          handleSelect(results[highlightIndex]);
        return;
      }
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightIndex(-1);
      return;
    }
    onKeyDown?.(e);
  };

  const clear = () => {
    abortRef.current?.abort();
    clearTimeout(debounceRef.current);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setStatus('idle');
    latestQuery.current = '';
    onSelect(null);
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          className="input-field pr-9 pl-7"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* أيقونة البحث أو الـ spinner */}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {status === 'loading' ? (
            <svg className="animate-spin w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </span>

        {/* زرار المسح */}
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden min-w-[240px]">
          {status === 'loading' && results.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
              <svg className="animate-spin w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              جاري البحث...
            </div>
          )}

          {status === 'empty' && (
            <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
              <span className="text-base">🔍</span>
              مفيش نتايج لـ «{query}»
            </div>
          )}

          {status === 'error' && (
            <div className="px-4 py-3 text-sm text-red-500 flex items-center gap-2">
              <span className="text-base">⚠️</span>
              خطأ في الاتصال — جرب تاني
            </div>
          )}

          {results.length > 0 && (
            <div ref={listRef} className="max-h-52 overflow-y-auto">
              {results.map((item, idx) => (
                <div
                  key={item._id || item.id}
                  className={`px-4 py-2.5 cursor-pointer text-sm flex items-center gap-3 transition-colors ${
                    idx === highlightIndex
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-50'
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                  onMouseEnter={() => setHighlightIndex(idx)}
                >
                  <span className="font-mono text-blue-600 font-semibold text-xs shrink-0 bg-blue-50 px-1.5 py-0.5 rounded">
                    {item.code}
                  </span>
                  <span className="text-gray-800 flex-1 truncate">{item.name}</span>
                  <span className="text-gray-400 text-xs shrink-0">{item.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ItemSearch;
