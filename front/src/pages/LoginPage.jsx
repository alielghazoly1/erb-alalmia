import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [form, setForm]   = useState({ username: '', password: '' });
  const dispatch          = useDispatch();
  const navigate          = useNavigate();
  const { loading, error, user } = useSelector((s) => s.auth);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(login(form));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">نظام المحاسبة</h1>
          <p className="text-gray-500 mt-2">تسجيل الدخول</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
            <input
              className="input-field"
              placeholder="أدخل اسم المستخدم"
              value={form.username}
              onChange={(e) => { dispatch(clearError()); setForm({ ...form, username: e.target.value }); }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
            <input
              type="password"
              className="input-field"
              placeholder="أدخل كلمة المرور"
              value={form.password}
              onChange={(e) => { dispatch(clearError()); setForm({ ...form, password: e.target.value }); }}
            />
          </div>
          <button type="submit" className="btn-primary w-full text-lg py-3" disabled={loading}>
            {loading ? 'جاري تسجيل الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
