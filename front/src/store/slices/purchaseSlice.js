// ─── store/slices/purchaseSlice.js ────────────────────────────────────────────
// Cursor-based infinite scroll — بدل replace بنعمل append
// ─────────────────────────────────────────────────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ── Thunks ────────────────────────────────────────────────────────────────────
export const fetchPurchaseInvoices = createAsyncThunk(
  'purchase/fetchAll',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await api.get('/purchase', { params });
      return { ...data, isFirstPage: !params.cursor };
    } catch (err) {
      return thunkAPI.rejectWithValue(
        err.response?.data?.message || 'خطأ في جلب الفواتير'
      );
    }
  }
);

// ✅ FIX-RACE-001: retry تلقائي عند 409 (Serializable conflict)
// السيرفر يُعيد 409 لو طلبان تزامنا على نفس الـ Serializable transaction.
// الـ client يُعيد المحاولة حتى MAX_RETRIES مرات مع delay تصاعدي بسيط.
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

export const createPurchaseInvoice = createAsyncThunk(
  'purchase/create',
  async (invoiceData, thunkAPI) => {
    try {
      const data = await withRetry(async () => {
        const res = await api.post('/purchase', invoiceData);
        return res.data;
      });
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(
        err.response?.data?.message || 'خطأ في الحفظ'
      );
    }
  }
);

export const approvePurchaseInvoice = createAsyncThunk(
  'purchase/approve',
  async (id, thunkAPI) => {
    try {
      const { data } = await api.put(`/purchase/${id}/approve`);
      return data.invoice;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  }
);

export const suspendPurchaseInvoice = createAsyncThunk(
  'purchase/suspend',
  async ({ id, reason }, thunkAPI) => {
    try {
      const { data } = await api.put(`/purchase/${id}/suspend`, { reason });
      return data.invoice;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  }
);

// ✅ FIX: بنبعت id بدل ما نعتمد على response.invoice._id
export const cancelPurchaseInvoice = createAsyncThunk(
  'purchase/cancel',
  async (id, thunkAPI) => {
    try {
      await api.delete(`/purchase/${id}`);
      return id;   // ✅ نرجع الـ id مباشرة للـ slice
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  }
);

// ── Helper ────────────────────────────────────────────────────────────────────
const upsertInList = (list, payload) => {
  if (!payload) return list;
  const id  = payload._id ?? payload.id;
  const idx = list.findIndex(i => (i._id ?? i.id) === id);
  if (idx !== -1) {
    const copy = [...list];
    copy[idx] = { ...payload, _id: id };
    return copy;
  }
  return list;
};

// ── Slice ─────────────────────────────────────────────────────────────────────
const purchaseSlice = createSlice({
  name: 'purchase',
  initialState: {
    list:        [],
    loading:     false,
    loadingMore: false,
    error:       null,
    hasMore:     false,
    nextCursor:  null,
    total:       null,
  },
  reducers: {
    resetList(state) {
      state.list       = [];
      state.hasMore    = false;
      state.nextCursor = null;
      state.total      = null;
      state.error      = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchAll ──────────────────────────────────────────────────────────
      .addCase(fetchPurchaseInvoices.pending, (state, action) => {
        const isFirst = !action.meta.arg?.cursor;
        if (isFirst) {
          state.loading = true;
          state.list    = [];
          state.error   = null;
        } else {
          state.loadingMore = true;
        }
      })
      .addCase(fetchPurchaseInvoices.fulfilled, (state, action) => {
        const { invoices, hasMore, nextCursor, total, isFirstPage } = action.payload;
        state.loading     = false;
        state.loadingMore = false;
        state.error       = null;
        state.hasMore     = hasMore;
        state.nextCursor  = nextCursor;
        if (total !== null) state.total = total;

        const mapped = (invoices || []).map(i => ({ ...i, _id: i._id ?? i.id }));
        if (isFirstPage) {
          state.list = mapped;
        } else {
          // append مع dedup
          const ids = new Set(state.list.map(i => i._id));
          state.list = [...state.list, ...mapped.filter(i => !ids.has(i._id))];
        }
      })
      .addCase(fetchPurchaseInvoices.rejected, (state, action) => {
        state.loading     = false;
        state.loadingMore = false;
        state.error       = action.payload || 'حدث خطأ';
      })

      // ── create ────────────────────────────────────────────────────────────
      .addCase(createPurchaseInvoice.fulfilled, (state, action) => {
        const inv = { ...action.payload, _id: action.payload._id ?? action.payload.id };
        state.list.unshift(inv);
        if (state.total !== null) state.total += 1;
      })

      // ── approve ───────────────────────────────────────────────────────────
      .addCase(approvePurchaseInvoice.fulfilled, (state, action) => {
        state.list = upsertInList(state.list, action.payload);
      })

      // ── suspend ───────────────────────────────────────────────────────────
      .addCase(suspendPurchaseInvoice.fulfilled, (state, action) => {
        state.list = upsertInList(state.list, action.payload);
      })

      // ── cancel ────────────────────────────────────────────────────────────
      // ✅ FIX: action.payload هو الـ id مباشرة (string) مش object
      .addCase(cancelPurchaseInvoice.fulfilled, (state, action) => {
        const id = action.payload;
        // نحدث الـ status محلياً بدل الحذف عشان نحافظ على الـ list
        const idx = state.list.findIndex(i => (i._id ?? i.id) === id);
        if (idx !== -1) state.list[idx] = { ...state.list[idx], status: 'cancelled' };
      });
  },
});

export const { resetList } = purchaseSlice.actions;
export default purchaseSlice.reducer;