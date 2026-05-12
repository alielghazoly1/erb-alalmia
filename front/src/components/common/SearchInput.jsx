// ─── components/common/SearchInput.jsx ───────────────────────────────────────
// بحث نصي عام — debounce 300ms عشان مايعملش dispatch عند كل حرف
import { useState, useRef, useEffect } from 'react';

export default function SearchInput({
  onSearch,
  placeholder = 'بحث...',
  debounceMs  = 300,
  initialValue = '',
}) {
  const [value,    setValue]    = useState(initialValue);
  const debounceRef = useRef(null);

  // cleanup
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleChange = (e) => {
    const val = e.target.value;
    setValue(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(val), debounceMs);
  };

  const clear = () => {
    clearTimeout(debounceRef.current);
    setValue('');
    onSearch('');
  };

  return (
    <div className="relative">
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </span>
      <input
        className="input-field pr-9 pl-7"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
        >
          ×
        </button>
      )}
    </div>
  );
}
