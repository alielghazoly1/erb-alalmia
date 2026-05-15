// ─── store/slices/saleSlice.js ────────────────────────────────────────────────
// Lazy Loading: 100 فاتورة كل مرة (offset-based pagination)
// يحمل التالي عند IntersectionObserver في SaleListPage
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
        params: { ...params, limit: PAGE_SIZE, page: 1 },
      });
      // الباك بيرجع { invoices, total, page, limit }
      const invoices = Array.isArray(data) ? data : (data.invoices ?? []);
      const total    = data.total ?? invoices.length;
      return { invoices, total, page: 1 };
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
      const state    = thunkAPI.getState().sales;
      const nextPage = state.currentPage + 1;
      const { data } = await api.get('/sales', {
        params: { ...params, limit: PAGE_SIZE, page: nextPage },
      });
      const invoices = Array.isArray(data) ? data : (data.invoices ?? []);
      const total    = data.total ?? (state.total ?? 0);
      return { invoices, total, page: nextPage };
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
const upsertInList = (list, payload) => {
  if (!payload) return list;
  const idx = list.findIndex(i => i._id === payload._id || i.id === payload.id);
  if (idx !== -1) {
    const copy = [...list];
    copy[idx] = { ...payload, _id: payload._id || payload.id };
    return copy;
  }
  return list;
};

// ── Slice ─────────────────────────────────────────────────────────────────────
const saleSlice = createSlice({
  name: 'sales',
  initialState: {
    list:        [],
    deletedIds:  [],
    total:       0,
    currentPage: 1,
    hasMore:     false,
    loading:     false,
    loadingMore: false,
    error:       null,
    lastParams:  null,
  },
  reducers: {
    clearDeletedIds: (state) => { state.deletedIds = []; },
    resetSales:      (state) => {
      state.list = []; state.total = 0;
      state.currentPage = 1; state.hasMore = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchSaleInvoices (reset) ──────────────────────────────────────────
      .addCase(fetchSaleInvoices.pending, (state, action) => {
        state.loading    = true;
        state.error      = null;
        state.lastParams = action.meta.arg;
        state.list       = [];   // reset عند تغيير الفلاتر
      })
      .addCase(fetchSaleInvoices.fulfilled, (state, action) => {
        state.loading     = false;
        const { invoices, total, page } = action.payload;
        // فلتر الفواتير المحذوفة محلياً
        state.list        = invoices
          .filter(i => !state.deletedIds.includes(i._id ?? i.id))
          .map(i => ({ ...i, _id: i._id ?? i.id }));
        state.total       = total;
        state.currentPage = page;
        // ✅ FIX: hasMore يعتمد على total من الباك مش طول القائمة المفلترة
        state.hasMore     = state.list.length < total && invoices.length === PAGE_SIZE;
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
        const { invoices, total, page } = action.payload;
        // deduplicate + فلتر المحذوفات
        const existingIds = new Set(state.list.map(i => i._id));
        const newItems = invoices
          .filter(i => !state.deletedIds.includes(i._id ?? i.id))
          .filter(i => !existingIds.has(i._id ?? i.id))
          .map(i => ({ ...i, _id: i._id ?? i.id }));

        state.list        = [...state.list, ...newItems];
        state.total       = total;
        state.currentPage = page;
        state.hasMore     = state.list.length < total && invoices.length === PAGE_SIZE;
      })
      .addCase(fetchMoreSaleInvoices.rejected, (state, action) => {
        state.loadingMore = false;
        state.error       = action.payload || 'حدث خطأ في تحميل المزيد';
      })

      // ── create ────────────────────────────────────────────────────────────
      .addCase(createSaleInvoice.fulfilled, (state, action) => {
        const inv = { ...action.payload, _id: action.payload._id ?? action.payload.id };
        state.list.unshift(inv);
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
        const id = action.payload;
        state.list       = state.list.filter(i => i._id !== id && i.id !== id);
        state.deletedIds = [...state.deletedIds, id];
        state.total      = Math.max(0, state.total - 1);
        state.hasMore    = state.list.length < state.total;
      });
  },
});

export const { clearDeletedIds, resetSales } = saleSlice.actions;
export default saleSlice.reducer;
