import React, { useEffect, useState } from 'react';
import api from '../../../services/api';

export default function SeasonSelector({ value, onChange }) {
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    api.get('/manufacturing/seasons')
      .then(({ data }) => setSeasons(data))
      .catch(() => {});
  }, []);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">الموسم</label>
      <select className="input-field w-48" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">الموسم النشط</option>
        {seasons.map((s) => (
          <option key={s._id} value={s._id}>
            {s.isActive ? '🟢 ' : ''}{s.name}
            {s.orderCount > 0 ? ` (${s.orderCount} أمر)` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
