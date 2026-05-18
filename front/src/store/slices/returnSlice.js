// ─── store/slices/returnSlice.js ──────────────────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ── Thunks ─────────────────────────────────────────────────────────────────────

// أول صفحة — تعيد reset للـ list
export const fetchReturns = createAsyncThunk(
  'returns/fetchAll',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await api.get('/returns', { params });
      // الـ backend بيرجع { returns[], nextCursor, hasMore, total }
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التحميل');
    }
  },
);

// صفحة تانية وما بعدها — تـ append على الـ list الموجودة
export const fetchMoreReturns = createAsyncThunk(
  'returns/fetchMore',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await api.get('/returns', { params });
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التحميل');
    }
  },
);

export const createReturn = createAsyncThunk(
  'returns/create',
  async (d, thunkAPI) => {
    try {
      const { data } = await api.post('/returns', d);
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في الحفظ');
    }
  },
);

export const updateReturn = createAsyncThunk(
  'returns/update',
  async ({ id, ...body }, thunkAPI) => {
    try {
      const { data } = await api.put(`/returns/${id}`, body);
      return data.returnInv;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التعديل');
    }
  },
);

export const approveReturn = createAsyncThunk(
  'returns/approve',
  async (id, thunkAPI) => {
    try {
      const { data } = await api.put(`/returns/${id}/approve`);
      return data.returnInv;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  },
);

export const rejectReturn = createAsyncThunk(
  'returns/reject',
  async (id, thunkAPI) => {
    try {
      const { data } = await api.put(`/returns/${id}/reject`);
      return data.returnInv;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  },
);

// ── Slice ──────────────────────────────────────────────────────────────────────
const initialState = {
  list:        [],
  total:       0,
  nextCursor:  null,
  hasMore:     false,
  loading:     false,
  loadingMore: false,
  error:       null,
};

const upsert = (list, item) => {
  const id = item._id ?? item.id;
  const idx = list.findIndex(r => (r._id ?? r.id) === id);
  if (idx !== -1) { list[idx] = item; } else { list.unshift(item); }
};

const returnSlice = createSlice({
  name: 'returns',
  initialState,
  reducers: {
    resetReturns: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ── fetchReturns (أول صفحة) ────────────────────────────────────────
      .addCase(fetchReturns.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchReturns.fulfilled, (state, { payload }) => {
        state.loading    = false;
        state.list       = payload.returns ?? payload; // دعم legacy response
        state.total      = payload.total ?? state.list.length;
        state.nextCursor = payload.nextCursor ?? null;
        state.hasMore    = payload.hasMore    ?? false;
      })
      .addCase(fetchReturns.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
      })

      // ── fetchMoreReturns (صفحات تالية) ────────────────────────────────
      .addCase(fetchMoreReturns.pending, (state) => {
        state.loadingMore = true;
      })
      .addCase(fetchMoreReturns.fulfilled, (state, { payload }) => {
        state.loadingMore = false;
        state.list        = [...state.list, ...(payload.returns ?? [])];
        state.nextCursor  = payload.nextCursor ?? null;
        state.hasMore     = payload.hasMore    ?? false;
      })
      .addCase(fetchMoreReturns.rejected, (state) => {
        state.loadingMore = false;
      })

      // ── createReturn ──────────────────────────────────────────────────
      .addCase(createReturn.fulfilled, (state, { payload }) => {
        state.list.unshift(payload);
        state.total = (state.total ?? 0) + 1;
      })

      // ── updateReturn ──────────────────────────────────────────────────
      .addCase(updateReturn.fulfilled, (state, { payload }) => {
        if (payload) upsert(state.list, payload);
      })

      // ── approveReturn ─────────────────────────────────────────────────
      .addCase(approveReturn.fulfilled, (state, { payload }) => {
        if (payload) upsert(state.list, payload);
      })

      // ── rejectReturn ──────────────────────────────────────────────────
      .addCase(rejectReturn.fulfilled, (state, { payload }) => {
        if (payload) upsert(state.list, payload);
      });
  },
});

export const { resetReturns } = returnSlice.actions;
export default returnSlice.reducer;
