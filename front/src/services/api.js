// ─── src/services/api.js ──────────────────────────────────────────────────────
//  في التطوير:   REACT_APP_API_URL=http://localhost:5000/api
//  في Electron:  localhost:5001 (الباك شغّال جوه الـ app نفسه)
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

// لو في Electron production: نستخدم 5001 (الـ port اللي بنشغّل عليه الباك داخلياً)
// لو في browser / dev: نستخدم القيمة من .env
const isElectron  = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');
const isDev       = process.env.NODE_ENV === 'development';

const BASE_URL = (() => {
  if (isDev) return process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  if (isElectron) return 'http://localhost:5001/api';
  return process.env.REACT_APP_API_URL || '/api';
})();

const api = axios.create({
  baseURL:         BASE_URL,
  withCredentials: true,   // ضروري لإرسال الـ HTTP-only cookie مع كل request
  timeout:         30000,
});

// ── Request interceptor ───────────────────────────────────────────────────────
// التوكن محفوظ في HTTP-only cookie وبيتبعت تلقائياً مع withCredentials: true
// مش محتاجين نحطه يدوياً في الـ headers
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
);

// ── Response interceptor: لو 401 ارجع للـ login ──────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // امسح بيانات الـ session من الـ sessionStorage
      sessionStorage.removeItem('userData');
      // ارجع للـ login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;