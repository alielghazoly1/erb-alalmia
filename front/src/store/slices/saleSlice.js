// ─── store/slices/saleSlice.js ────────────────────────────────────────────────
// ✅ Lazy Loading: 100 فاتورة كل مرة، يحمل التالي لما المستخدم يوصل 80%
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const PAGE_SIZE = 100;

// جلب أول 100 فاتورة (reset)
export const fetchSaleInvoices = createAsyncThunk('sales/fetchAll', async (params = {}) => {
  const { data } = await api.get('/sales', { params: { ...params, limit: PAGE_SIZE, page: 1 } });
  const invoices = Array.isArray(data) ? data : (data.invoices || []);
  const total    = data.total ?? invoices.length;
  return { invoices, total, page: 1 };
});

// تحميل الصفحة التالية (append)
export const fetchMoreSaleInvoices = createAsyncThunk('sales/fetchMore', async (params = {}, thunkAPI) => {
  const state   = thunkAPI.getState().sales;
  const nextPage = state.currentPage + 1;
  const { data } = await api.get('/sales', { params: { ...params, limit: PAGE_SIZE, page: nextPage } });
  const invoices = Array.isArray(data) ? data : (data.invoices || []);
  const total    = data.total ?? invoices.length;
  return { invoices, total, page: nextPage };
});

export const createSaleInvoice = createAsyncThunk('sales/create', async (d, thunkAPI) => {
  try {
    const { data } = await api.post('/sales', d);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في الحفظ');
  }
});

export const approveSaleInvoice = createAsyncThunk('sales/approve', async (id, thunkAPI) => {
  try {
    const { data } = await api.put(`/sales/${id}/approve`);
    return data.invoice;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const suspendSaleInvoice = createAsyncThunk('sales/suspend', async ({ id, reason }, thunkAPI) => {
  try {
    const { data } = await api.put(`/sales/${id}/suspend`, { reason });
    return data.invoice;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const cancelSaleInvoice = createAsyncThunk('sales/cancel', async (id, thunkAPI) => {
  try {
    await api.delete(`/sales/${id}`);
    return id;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

const updateInList = (list, payload) => {
  if (!payload) return list;
  const idx = list.findIndex(i => i._id === payload._id);
  if (idx !== -1) { const copy = [...list]; copy[idx] = payload; return copy; }
  return list;
};

const saleSlice = createSlice({
  name: 'sales',
  initialState: {
    list: [],
    deletedIds: [],
    total: 0,
    currentPage: 1,
    hasMore: false,
    loading: false,
    loadingMore: false,
    error: null,
    lastParams: null,
  },
  reducers: {
    clearDeletedIds: (state) => { state.deletedIds = []; },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchSaleInvoices (reset) ──────────────────────────────────────
      .addCase(fetchSaleInvoices.pending, (state, action) => {
        state.loading     = true;
        state.lastParams  = action.meta.arg;
      })
      .addCase(fetchSaleInvoices.fulfilled, (state, action) => {
        state.loading     = false;
        const { invoices, total, page } = action.payload;
        state.list        = invoices.filter(i => !state.deletedIds.includes(i._id));
        state.total       = total;
        state.currentPage = page;
        state.hasMore     = state.list.length < total;
      })
      .addCase(fetchSaleInvoices.rejected, (state) => { state.loading = false; })

      // ── fetchMoreSaleInvoices (append) ────────────────────────────────
      .addCase(fetchMoreSaleInvoices.pending, (state) => { state.loadingMore = true; })
      .addCase(fetchMoreSaleInvoices.fulfilled, (state, action) => {
        state.loadingMore = false;
        const { invoices, total, page } = action.payload;
        const newItems = invoices.filter(i => !state.deletedIds.includes(i._id));
        // deduplicate
        const ids = new Set(state.list.map(i => i._id));
        state.list        = [...state.list, ...newItems.filter(i => !ids.has(i._id))];
        state.total       = total;
        state.currentPage = page;
        state.hasMore     = state.list.length < total;
      })
      .addCase(fetchMoreSaleInvoices.rejected, (state) => { state.loadingMore = false; })

      // ── CRUD ──────────────────────────────────────────────────────────
      .addCase(createSaleInvoice.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
        state.total += 1;
      })
      .addCase(approveSaleInvoice.fulfilled, (state, action) => {
        state.list = updateInList(state.list, action.payload);
      })
      .addCase(suspendSaleInvoice.fulfilled, (state, action) => {
        state.list = updateInList(state.list, action.payload);
      })
      .addCase(cancelSaleInvoice.fulfilled, (state, action) => {
        const id = action.payload;
        state.list       = state.list.filter(i => i._id !== id);
        state.deletedIds = [...state.deletedIds, id];
        state.total      = Math.max(0, state.total - 1);
      });
  },
});

export const { clearDeletedIds } = saleSlice.actions;
export default saleSlice.reducer;
