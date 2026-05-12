import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchSaleInvoices = createAsyncThunk('sales/fetchAll', async (params = {}) => {
  const { limit = 500, ...rest } = params;
  const { data } = await api.get('/sales', { params: { ...rest, limit } });
  return Array.isArray(data) ? data : (data.invoices || []);
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
  initialState: { list: [], deletedIds: [], loading: false, error: null },
  reducers: {
    // مسح الـ deletedIds بعد fetch جديد مقصود (مثلاً تغيير الفلتر)
    clearDeletedIds: (state) => { state.deletedIds = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSaleInvoices.pending,   (state) => { state.loading = true; })
      .addCase(fetchSaleInvoices.fulfilled, (state, action) => {
        state.loading = false;
        // فلتر أي فاتورة محذوفة محلياً حتى لو الـ API رجعها
        state.list = action.payload.filter(i => !state.deletedIds.includes(i._id));
      })
      .addCase(fetchSaleInvoices.rejected,  (state) => { state.loading = false; })
      .addCase(createSaleInvoice.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
      })
      .addCase(approveSaleInvoice.fulfilled, (state, action) => {
        state.list = updateInList(state.list, action.payload);
      })
      .addCase(suspendSaleInvoice.fulfilled, (state, action) => {
        state.list = updateInList(state.list, action.payload);
      })
      .addCase(cancelSaleInvoice.fulfilled, (state, action) => {
        const id = action.payload;
        // حذف فوري من القائمة + حفظ الـ ID كـ safety net ضد أي fetch مفاجئ
        state.list       = state.list.filter(i => i._id !== id);
        state.deletedIds = [...state.deletedIds, id];
      });
  },
});

export const { clearDeletedIds } = saleSlice.actions;
export default saleSlice.reducer;
