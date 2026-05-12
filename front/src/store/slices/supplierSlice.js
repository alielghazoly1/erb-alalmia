// ─── store/slices/supplierSlice.js ───────────────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchSuppliers = createAsyncThunk(
  'suppliers/fetchAll',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await api.get('/suppliers', { params });
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'حدث خطأ');
    }
  },
);

export const createSupplier = createAsyncThunk(
  'suppliers/create',
  async (supplierData, thunkAPI) => {
    try {
      await api.post('/suppliers', supplierData);
      // نعمل refetch عشان نجيب البيانات المحسوبة (balance, totalPurchases ...)
      const { data } = await api.get('/suppliers');
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'حدث خطأ');
    }
  },
);

export const updateSupplier = createAsyncThunk(
  'suppliers/update',
  async ({ id, ...rest }, thunkAPI) => {
    try {
      const { data } = await api.put(`/suppliers/${id}`, rest);
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'حدث خطأ');
    }
  },
);

export const deleteSupplier = createAsyncThunk(
  'suppliers/delete',
  async (id, thunkAPI) => {
    try {
      await api.delete(`/suppliers/${id}`);
      return id;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'حدث خطأ');
    }
  },
);

const supplierSlice = createSlice({
  name: 'suppliers',
  initialState: { list: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // ── fetchSuppliers ──────────────────────────────────────────────────────
      .addCase(fetchSuppliers.pending,   (state)          => { state.loading = true;  state.error = null; })
      .addCase(fetchSuppliers.fulfilled, (state, action)  => { state.loading = false; state.list  = action.payload; })
      .addCase(fetchSuppliers.rejected,  (state, action)  => { state.loading = false; state.error = action.payload; })

      // ── createSupplier — payload هو الـ list كاملة بعد الـ refetch ──────────
      .addCase(createSupplier.fulfilled, (state, action)  => { state.list = action.payload; })
      .addCase(createSupplier.rejected,  (state, action)  => { state.error = action.payload; })

      // ── updateSupplier — نحدث الصف فقط ─────────────────────────────────────
      .addCase(updateSupplier.fulfilled, (state, action) => {
        const idx = state.list.findIndex((s) => s._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateSupplier.rejected,  (state, action)  => { state.error = action.payload; })

      // ── deleteSupplier ──────────────────────────────────────────────────────
      .addCase(deleteSupplier.fulfilled, (state, action) => {
        state.list = state.list.filter((s) => s._id !== action.payload);
      });
  },
});

export default supplierSlice.reducer;
