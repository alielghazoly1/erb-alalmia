import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchTransfers = createAsyncThunk('transfers/fetchAll', async (params = {}) => {
  const { data } = await api.get('/transfers', { params });
  return data;
});

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
    const { data } = await api.post('/transfers', d);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في الحفظ');
  }
});

export const updateTransfer = createAsyncThunk('transfers/update', async ({ id, ...body }, thunkAPI) => {
  try {
    const { data } = await api.put(`/transfers/${id}`, body);
    return data.transfer;
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

const upsert = (list, item) => {
  if (!item) return list;
  const idx = list.findIndex(t => t._id === item._id);
  if (idx !== -1) { const n = [...list]; n[idx] = item; return n; }
  return [item, ...list];
};

const transferSlice = createSlice({
  name: 'transfers',
  initialState: { list: [], loading: false, current: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransfers.pending,   s => { s.loading = true; })
      .addCase(fetchTransfers.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
      .addCase(fetchTransfers.rejected,  s => { s.loading = false; })
      .addCase(fetchTransferById.fulfilled, (s, a) => { s.current = a.payload; })
      .addCase(createTransfer.fulfilled, (s, a) => { s.list = [a.payload, ...s.list]; })
      .addCase(updateTransfer.fulfilled,  (s, a) => { s.list = upsert(s.list, a.payload); s.current = a.payload; })
      .addCase(approveTransfer.fulfilled, (s, a) => { s.list = upsert(s.list, a.payload); })
      .addCase(rejectTransfer.fulfilled,  (s, a) => { s.list = upsert(s.list, a.payload); });
  },
});

export default transferSlice.reducer;