// ─── store/slices/purchaseSlice.js ────────────────────────────────────────────
// مدعوم cursor-based infinite scroll — بدل replace بنعمل append
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// جلب صفحة من الفواتير
// params: { status, search, seasonId, startDate, endDate, cursor, limit }
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

export const createPurchaseInvoice = createAsyncThunk(
  'purchase/create',
  async (invoiceData, thunkAPI) => {
    try {
      const { data } = await api.post('/purchase', invoiceData);
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

export const cancelPurchaseInvoice = createAsyncThunk(
  'purchase/cancel',
  async (id, thunkAPI) => {
    try {
      const { data } = await api.delete(`/purchase/${id}`);
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  }
);

const purchaseSlice = createSlice({
  name: 'purchase',
  initialState: {
    list: [],
    loading: false,
    loadingMore: false, // للتحميل في الخلفية (infinite scroll)
    error: null,
    hasMore: false,
    nextCursor: null,
    total: null,
  },
  reducers: {
    // reset عند تغيير الفلاتر
    resetList(state) {
      state.list = [];
      state.hasMore = false;
      state.nextCursor = null;
      state.total = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ─── fetchAll ───────────────────────────────────────────────────────────
      .addCase(fetchPurchaseInvoices.pending, (state, action) => {
        const isFirstPage = !action.meta.arg?.cursor;
        if (isFirstPage) {
          state.loading = true;
          state.list = [];
          state.error = null;
        } else {
          state.loadingMore = true;
        }
      })
      .addCase(fetchPurchaseInvoices.fulfilled, (state, action) => {
        const { invoices, hasMore, nextCursor, total, isFirstPage } =
          action.payload;
        state.loading = false;
        state.loadingMore = false;
        state.error = null;
        state.hasMore = hasMore;
        state.nextCursor = nextCursor;
        if (total !== null) state.total = total;

        if (isFirstPage) {
          state.list = invoices;
        } else {
          // append — مش replace
          state.list = [...state.list, ...invoices];
        }
      })
      .addCase(fetchPurchaseInvoices.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload || 'حدث خطأ';
      })

      // ─── create ─────────────────────────────────────────────────────────────
      .addCase(createPurchaseInvoice.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
        if (state.total !== null) state.total += 1;
      })

      // ─── approve ────────────────────────────────────────────────────────────
      .addCase(approvePurchaseInvoice.fulfilled, (state, action) => {
        const idx = state.list.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })

      // ─── suspend ────────────────────────────────────────────────────────────
      .addCase(suspendPurchaseInvoice.fulfilled, (state, action) => {
        const idx = state.list.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })

      // ─── cancel ─────────────────────────────────────────────────────────────
      .addCase(cancelPurchaseInvoice.fulfilled, (state, action) => {
        const idx = state.list.findIndex(
          (i) => i._id === action.payload?._id
        );
        if (idx !== -1) state.list[idx].status = 'cancelled';
      });
  },
});

export const { resetList } = purchaseSlice.actions;
export default purchaseSlice.reducer;
