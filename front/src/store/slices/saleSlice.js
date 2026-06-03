// ─── store/slices/saleSlice.js ────────────────────────────────────────────────
// ✅ PERF-001: cursor-based pagination بدل offset
//    لا COUNT في كل صفحة — total يُحفظ من أول طلب ويُرجَّح بالعمليات المحلية
// ─────────────────────────────────────────────────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const PAGE_SIZE = 100;

// ── جلب الصفحة الأولى (reset) ────────────────────────────────────────────────
export const fetchSaleInvoices = createAsyncThunk(
  'sales/fetchAll',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await api.get('/sales', {
        params: { ...params, limit: PAGE_SIZE },
        // بدون cursor → الباك يرسل total
      });
      const invoices = Array.isArray(data) ? data : (data.invoices ?? []);
      return {
        invoices,
        total:      data.total ?? invoices.length,
        hasMore:    data.hasMore ?? false,
        nextCursor: data.nextCursor ?? null,
      };
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في جلب الفواتير');
    }
  }
);

// ── جلب الصفحة التالية (append) ──────────────────────────────────────────────
export const fetchMoreSaleInvoices = createAsyncThunk(
  'sales/fetchMore',
  async (params = {}, thunkAPI) => {
    try {
      const { nextCursor } = thunkAPI.getState().sales;
      if (!nextCursor) return thunkAPI.rejectWithValue('لا يوجد cursor');

      const { data } = await api.get('/sales', {
        params: { ...params, limit: PAGE_SIZE, cursor: nextCursor },
      });
      const invoices = Array.isArray(data) ? data : (data.invoices ?? []);
      return {
        invoices,
        hasMore:    data.hasMore ?? false,
        nextCursor: data.nextCursor ?? null,
      };
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في تحميل المزيد');
    }
  }
);

// ── CRUD ──────────────────────────────────────────────────────────────────────
export const createSaleInvoice = createAsyncThunk(
  'sales/create',
  async (d, thunkAPI) => {
    try {
      const { data } = await api.post('/sales', d);
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في الحفظ');
    }
  }
);

export const approveSaleInvoice = createAsyncThunk(
  'sales/approve',
  async (id, thunkAPI) => {
    try {
      const { data } = await api.put(`/sales/${id}/approve`);
      return data.invoice;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  }
);

export const suspendSaleInvoice = createAsyncThunk(
  'sales/suspend',
  async ({ id, reason }, thunkAPI) => {
    try {
      const { data } = await api.put(`/sales/${id}/suspend`, { reason });
      return data.invoice;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  }
);

export const cancelSaleInvoice = createAsyncThunk(
  'sales/cancel',
  async (id, thunkAPI) => {
    try {
      await api.delete(`/sales/${id}`);
      return id;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  }
);

// ── Helper ────────────────────────────────────────────────────────────────────
const toId  = (i) => i._id ?? i.id;
const norm  = (i) => ({ ...i, _id: toId(i) });

const upsertInList = (list, payload) => {
  if (!payload) return list;
  const idx = list.findIndex(i => toId(i) === toId(payload));
  if (idx !== -1) {
    const copy = [...list];
    copy[idx] = norm(payload);
    return copy;
  }
  return list;
};

// ── Slice ─────────────────────────────────────────────────────────────────────
const saleSlice = createSlice({
  name: 'sales',
  initialState: {
    list:        [],
    total:       0,
    hasMore:     false,
    nextCursor:  null,
    loading:     false,
    loadingMore: false,
    error:       null,
    lastParams:  null,
  },
  reducers: {
    resetSales: (state) => {
      state.list = []; state.total = 0;
      state.hasMore = false; state.nextCursor = null;
      state.error = null; state.loading = false; state.loadingMore = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchSaleInvoices (reset) ──────────────────────────────────────────
      .addCase(fetchSaleInvoices.pending, (state, action) => {
        state.loading    = true;
        state.error      = null;
        state.lastParams = action.meta.arg;
        state.list       = [];
        state.nextCursor = null;
        state.hasMore    = false;
      })
      .addCase(fetchSaleInvoices.fulfilled, (state, action) => {
        state.loading    = false;
        const { invoices, total, hasMore, nextCursor } = action.payload;
        state.list       = invoices.map(norm);
        state.total      = total;
        state.hasMore    = hasMore;
        state.nextCursor = nextCursor;
      })
      .addCase(fetchSaleInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload || 'حدث خطأ';
      })

      // ── fetchMoreSaleInvoices (append) ────────────────────────────────────
      .addCase(fetchMoreSaleInvoices.pending, (state) => {
        state.loadingMore = true;
      })
      .addCase(fetchMoreSaleInvoices.fulfilled, (state, action) => {
        state.loadingMore = false;
        const { invoices, hasMore, nextCursor } = action.payload;
        const existingIds = new Set(state.list.map(toId));
        const newItems    = invoices.map(norm).filter(i => !existingIds.has(toId(i)));
        state.list        = [...state.list, ...newItems];
        state.hasMore     = hasMore;
        state.nextCursor  = nextCursor;
      })
      .addCase(fetchMoreSaleInvoices.rejected, (state, action) => {
        state.loadingMore = false;
        state.error       = action.payload || 'خطأ في تحميل المزيد';
      })

      // ── create ────────────────────────────────────────────────────────────
      .addCase(createSaleInvoice.fulfilled, (state, action) => {
        state.list.unshift(norm(action.payload));
        state.total += 1;
      })

      // ── approve ───────────────────────────────────────────────────────────
      .addCase(approveSaleInvoice.fulfilled, (state, action) => {
        state.list = upsertInList(state.list, action.payload);
      })

      // ── suspend ───────────────────────────────────────────────────────────
      .addCase(suspendSaleInvoice.fulfilled, (state, action) => {
        state.list = upsertInList(state.list, action.payload);
      })

      // ── cancel ────────────────────────────────────────────────────────────
      .addCase(cancelSaleInvoice.fulfilled, (state, action) => {
        const id    = action.payload;
        state.list  = state.list.filter(i => toId(i) !== id);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const { resetSales } = saleSlice.actions;
export default saleSlice.reducer;
