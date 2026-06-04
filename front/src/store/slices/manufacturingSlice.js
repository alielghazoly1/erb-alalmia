import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchOrders = createAsyncThunk('manufacturing/fetchAll', async (params = {}, thunkAPI) => {
  try {
    const { data } = await api.get('/manufacturing', { params });
    return data; // { orders, total, page, totalPages }
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التحميل');
  }
});

// ✅ CRIT-RC-002: retry تلقائي عند 409 (Serializable conflict)
// السيرفر يُعيد 409 لو طلبان تزامنا على نفس الـ transaction.
// الـ client يُعيد المحاولة حتى MAX_RETRIES مرة مع delay صغير.
const withRetry = async (fn, maxRetries = 3, delayMs = 150) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is409 = err.response?.status === 409;
      if (is409 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
};

export const createOrder = createAsyncThunk('manufacturing/create', async (payload, thunkAPI) => {
  try {
    const data = await withRetry(async () => {
      const res = await api.post('/manufacturing', payload);
      return res.data;
    });
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في الحفظ');
  }
});

export const fetchOrderById = createAsyncThunk('manufacturing/fetchById', async (id, thunkAPI) => {
  try {
    const { data } = await api.get(`/manufacturing/${id}`);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const updateOrder = createAsyncThunk('manufacturing/update', async ({ id, ...payload }, thunkAPI) => {
  try {
    const { data } = await api.put(`/manufacturing/${id}`, payload);
    return data.order || data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التعديل');
  }
});

export const approveOrder = createAsyncThunk('manufacturing/approve', async (id, thunkAPI) => {
  try {
    const { data } = await api.put(`/manufacturing/${id}/approve`);
    return data.order;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const rejectOrder = createAsyncThunk('manufacturing/reject', async (id, thunkAPI) => {
  try {
    const { data } = await api.put(`/manufacturing/${id}/reject`);
    return data.order;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

// ── Slice ─────────────────────────────────────────────────────────────────────

const manufacturingSlice = createSlice({
  name: 'manufacturing',
  initialState: {
    list:       [],
    total:      0,
    page:       1,
    totalPages: 1,
    loading:    false,
    current:    null,
  },
  reducers: {
    clearCurrent: (state) => { state.current = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending,   (state) => { state.loading = true; })
      .addCase(fetchOrders.rejected,  (state) => { state.loading = false; })
      .addCase(fetchOrders.fulfilled, (state, { payload }) => {
        state.loading    = false;
        state.list       = payload.orders;
        state.total      = payload.total;
        state.page       = payload.page;
        state.totalPages = payload.totalPages;
      })
      .addCase(fetchOrderById.fulfilled, (state, { payload }) => { state.current = payload; })
      .addCase(createOrder.fulfilled,    (state, { payload }) => { state.list.unshift(payload); state.total += 1; })
      .addCase(updateOrder.fulfilled, (state, { payload }) => {
        const idx = state.list.findIndex((o) => o._id === payload._id);
        if (idx !== -1) state.list[idx] = payload;
        if (state.current?._id === payload._id) state.current = payload;
      })
      .addCase(approveOrder.fulfilled, (state, { payload }) => {
        if (!payload) return;
        const idx = state.list.findIndex((o) => o._id === payload._id);
        if (idx !== -1) state.list[idx] = payload;
      })
      .addCase(rejectOrder.fulfilled, (state, { payload }) => {
        if (!payload) return;
        const idx = state.list.findIndex((o) => o._id === payload._id);
        if (idx !== -1) state.list[idx] = payload;
      });
  },
});

export const { clearCurrent } = manufacturingSlice.actions;
export default manufacturingSlice.reducer;