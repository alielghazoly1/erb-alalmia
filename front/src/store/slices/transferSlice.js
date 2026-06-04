// ─── store/slices/transferSlice.js ───────────────────────────────────────────
// ✅ INFINITE-SCROLL : يدعم cursor-based pagination مع append mode
// ✅ DELETE          : deleteTransfer thunk
// ✅ RETRY-409       : withRetry تلقائي عند Serializable conflict
// ─────────────────────────────────────────────────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ── retry helper ─────────────────────────────────────────────────────────────
const withRetry = async (fn, maxRetries = 3, delayMs = 150) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 409 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
};

// ── Thunks ────────────────────────────────────────────────────────────────────

/**
 * fetchTransfers — يدعم وضعين:
 *   1. reset=true (افتراضي عند تغيير الفلاتر): يستبدل القائمة
 *   2. reset=false (infinite scroll): يُلحق النتائج الجديدة
 */
export const fetchTransfers = createAsyncThunk(
  'transfers/fetchAll',
  async ({ reset = true, cursor = null, ...params } = {}, thunkAPI) => {
    try {
      const query = { ...params, limit: 100 };
      if (cursor) query.cursor = cursor;
      const { data } = await api.get('/transfers', { params: query });
      return { ...data, reset };
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التحميل');
    }
  }
);

export const fetchTransferById = createAsyncThunk('transfers/fetchById', async (id, thunkAPI) => {
  try {
    const { data } = await api.get(`/transfers/${id}`);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const createTransfer = createAsyncThunk('transfers/create', async (d, thunkAPI) => {
  try {
    const data = await withRetry(async () => {
      const res = await api.post('/transfers', d);
      return res.data;
    });
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في الحفظ');
  }
});

export const updateTransfer = createAsyncThunk('transfers/update', async ({ id, ...body }, thunkAPI) => {
  try {
    const data = await withRetry(async () => {
      const res = await api.put(`/transfers/${id}`, body);
      return res.data.transfer;
    });
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التعديل');
  }
});

export const approveTransfer = createAsyncThunk('transfers/approve', async (id, thunkAPI) => {
  try {
    const { data } = await api.put(`/transfers/${id}/approve`);
    return data.transfer;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const rejectTransfer = createAsyncThunk('transfers/reject', async (id, thunkAPI) => {
  try {
    const { data } = await api.put(`/transfers/${id}/reject`);
    return data.transfer;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const deleteTransfer = createAsyncThunk('transfers/delete', async (id, thunkAPI) => {
  try {
    await api.delete(`/transfers/${id}`);
    return id;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في الحذف');
  }
});

export const reverseAndDeleteTransfer = createAsyncThunk('transfers/reverseDelete', async (id, thunkAPI) => {
  try {
    await api.delete(`/transfers/${id}/reverse-delete`);
    return id;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في عكس وحذف التحويل');
  }
});

// ── helpers ───────────────────────────────────────────────────────────────────
const upsert = (list, item) => {
  if (!item) return list;
  const idx = list.findIndex(t => t._id === item._id);
  if (idx !== -1) { const n = [...list]; n[idx] = item; return n; }
  return [item, ...list];
};

// ── Slice ─────────────────────────────────────────────────────────────────────
const transferSlice = createSlice({
  name: 'transfers',
  initialState: {
    list:        [],
    total:       0,
    nextCursor:  null,
    hasMore:     false,
    loading:     false,
    loadingMore: false,   // spinner فقط عند infinite scroll
    current:     null,
  },
  reducers: {
    clearCurrent: (state) => { state.current = null; },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchTransfers ─────────────────────────────────────────────────────
      .addCase(fetchTransfers.pending, (state, action) => {
        if (action.meta.arg?.reset === false) state.loadingMore = true;
        else                                  state.loading = true;
      })
      .addCase(fetchTransfers.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.loadingMore = false;
        state.nextCursor  = payload.nextCursor ?? null;
        state.hasMore     = payload.hasMore    ?? false;
        if (payload.total !== undefined) state.total = payload.total;

        if (payload.reset === false) {
          // infinite scroll — ألحق بدون تكرار
          const existingIds = new Set(state.list.map(t => t._id));
          const newItems = (payload.transfers || []).filter(t => !existingIds.has(t._id));
          state.list = [...state.list, ...newItems];
        } else {
          state.list = payload.transfers || [];
        }
      })
      .addCase(fetchTransfers.rejected, (state) => {
        state.loading     = false;
        state.loadingMore = false;
      })

      // ── fetchTransferById ─────────────────────────────────────────────────
      .addCase(fetchTransferById.fulfilled, (state, { payload }) => {
        state.current = payload;
      })

      // ── createTransfer ────────────────────────────────────────────────────
      .addCase(createTransfer.fulfilled, (state, { payload }) => {
        state.list  = [payload, ...state.list];
        state.total = state.total + 1;
      })

      // ── updateTransfer ────────────────────────────────────────────────────
      .addCase(updateTransfer.fulfilled, (state, { payload }) => {
        state.list    = upsert(state.list, payload);
        state.current = payload;
      })

      // ── approve / reject ──────────────────────────────────────────────────
      .addCase(approveTransfer.fulfilled, (state, { payload }) => {
        state.list = upsert(state.list, payload);
      })
      .addCase(rejectTransfer.fulfilled, (state, { payload }) => {
        state.list = upsert(state.list, payload);
      })

      // ── deleteTransfer ────────────────────────────────────────────────────
      .addCase(deleteTransfer.fulfilled, (state, { payload: id }) => {
        state.list  = state.list.filter(t => t._id !== id);
        state.total = Math.max(0, state.total - 1);
        if (state.current?._id === id) state.current = null;
      })

      // ── reverseAndDeleteTransfer ──────────────────────────────────────────
      .addCase(reverseAndDeleteTransfer.fulfilled, (state, { payload: id }) => {
        state.list  = state.list.filter(t => t._id !== id);
        state.total = Math.max(0, state.total - 1);
        if (state.current?._id === id) state.current = null;
      });
  },
});

export const { clearCurrent } = transferSlice.actions;
export default transferSlice.reducer;
