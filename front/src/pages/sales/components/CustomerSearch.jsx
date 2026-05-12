import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../../services/api';

export default function CustomerSearch({ onSelect, error, inputRef, onEnterEmpty, defaultValue }) {
  const [query,     setQuery]     = useState(defaultValue || '');
  const [results,   setResults]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading,   setLoading]   = useState(false);
  const timer   = useRef(null);
  const listRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { search: q } });
      setResults(data.slice(0, 10));
      setOpen(true);
      setHighlight(0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(val), 250);
  };

  const select = (c) => {
    setQuery(c.name);
    setOpen(false);
    setResults([]);
    onSelect(c);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter') { e.preventDefault(); if (!query.trim() && onEnterEmpty) onEnterEmpty(); }
      return;
    }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (results[highlight]) select(results[highlight]); }
    else if (e.key === 'Escape')    { setOpen(false); }
  };

  useEffect(() => {
    listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className={`input-field ${error ? 'border-red-500 ring-2 ring-red-100' : ''}`}
        placeholder="اسم العميل أو الكود..."
        value={query}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => query && results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {loading && <p className="text-xs text-gray-400 mt-1">جاري البحث...</p>}
      {open && results.length > 0 && (
        <div ref={listRef} className="absolute z-50 right-0 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {results.map((c, i) => (
            <button key={c._id} type="button" onMouseDown={() => select(c)}
              className={`w-full text-right px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${i === highlight ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
            >
              <div>
                <span className="font-medium">{c.name}</span>
                <span className="text-gray-400 text-xs mr-2">{c.code}</span>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.type === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {c.type === 'cash' ? 'نقدي' : 'آجل'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
