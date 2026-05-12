// ─── authSlice.js ─────────────────────────────────────────────────────────────
// التوكن في HTTP-only cookie — مش مخزّن في أي مكان في الفرونت
// بنخزن بس user data (اسم، دور، صلاحيات) في sessionStorage عشان:
//   - الصفحة ما تتحملش من الأول لما اليوزر يعمل refresh
//   - البيانات تتمسح تلقائياً لما يقفل التاب (أكثر أمان من localStorage)
// ─────────────────────────────────────────────────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ── helpers ───────────────────────────────────────────────────
const SESSION_KEY = 'userData';

const saveSession = (user) => {
  // ← نتأكد إننا مش بنحفظ token أبداً حتى لو جه في الـ response خطأ
  const { token: _drop, ...safeUser } = user;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
  return safeUser;
};

const clearSession = () => sessionStorage.removeItem(SESSION_KEY);

const loadSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const { token: _drop, ...safeUser } = parsed; // نضمن مش فيه token قديم
    return safeUser;
  } catch {
    clearSession();
    return null;
  }
};

// ── initial state من sessionStorage (لو في refresh) ──────────
const preloadedUser = loadSession();

// ── Thunks ────────────────────────────────────────────────────

export const login = createAsyncThunk('auth/login', async (credentials, thunkAPI) => {
  try {
    const { data } = await api.post('/auth/login', credentials);
    // الباك بيحط التوكن في cookie تلقائياً — data مش فيها token
    return saveSession(data);
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في تسجيل الدخول');
  }
});

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  try {
    await api.post('/auth/logout'); // الباك يمسح الكوكي من عنده
  } catch { /* نكمل الـ logout حتى لو الشبكة وقعت */ }
  clearSession();
});

// refresh الـ user data بعد تعديل الصلاحيات مثلاً
export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/auth/me');
    return saveSession(data);
  } catch {
    return thunkAPI.rejectWithValue('انتهت الجلسة');
  }
});

// ── Slice ─────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:    preloadedUser,
    loading: false,
    error:   null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(login.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user    = action.payload;
      })
      .addCase(login.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      })

      // logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user  = null;
        state.error = null;
      })

      // fetchMe — بيحدث الـ user data في الـ state والـ session
      .addCase(fetchMe.fulfilled, (state, action) => {
        if (state.user) state.user = action.payload;
      })
      .addCase(fetchMe.rejected, (state) => {
        // التوكن انتهى — نمسح كل حاجة
        state.user = null;
        clearSession();
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
