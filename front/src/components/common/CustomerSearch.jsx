import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

export default function CustomerSearch({ onSelect, error }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setNotFound(false);
    onSelect(null);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/customers', { params: { search: val } });
        setResults(data);
        setShowDropdown(true);
        setNotFound(data.length === 0);
      } catch {} finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = (customer) => {
    setQuery(`${customer.code} — ${customer.name}`);
    setShowDropdown(false);
    setNotFound(false);
    setResults([]);
    onSelect(customer);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        className={`input-field ${(notFound || error) ? 'border-red-500 ring-2 ring-red-200' : ''}`}
        placeholder="كود أو اسم العميل..."
        value={query}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
      />
      {loading && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>}
      {(notFound || error) && (
        <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
          <span>●</span> {notFound ? 'العميل مش موجود' : 'اختار عميل'}
        </p>
      )}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {results.map((c) => (
            <div
              key={c._id}
              className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center gap-3 text-sm"
              onMouseDown={() => handleSelect(c)}
            >
              <span className="font-mono text-blue-600 font-medium">{c.code}</span>
              <span className="text-gray-700">{c.name}</span>
              <span className={`mr-auto text-xs px-1.5 py-0.5 rounded-full ${
                c.type === 'cash'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {c.type === 'cash' ? 'نقدي' : 'آجل'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}