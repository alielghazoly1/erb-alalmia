import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchReturns = createAsyncThunk('returns/fetchAll', async (params = {}) => {
  const { data } = await api.get('/returns', { params });
  return data;
});

export const createReturn = createAsyncThunk('returns/create', async (d, thunkAPI) => {
  try {
    const { data } = await api.post('/returns', d);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في الحفظ');
  }
});

export const approveReturn = createAsyncThunk('returns/approve', async (id, thunkAPI) => {
  try {
    const { data } = await api.put(`/returns/${id}/approve`);
    return data.returnInv;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const rejectReturn = createAsyncThunk('returns/reject', async (id, thunkAPI) => {
  try {
    const { data } = await api.put(`/returns/${id}/reject`);
    return data.returnInv;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

const returnSlice = createSlice({
  name: 'returns',
  initialState: { list: [], loading: false },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchReturns.pending, (state) => { state.loading = true; })
      .addCase(fetchReturns.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchReturns.rejected, (state) => { state.loading = false; })
      .addCase(createReturn.fulfilled, (state, action) => { state.list.unshift(action.payload); })
      .addCase(approveReturn.fulfilled, (state, action) => {
        const idx = state.list.findIndex(r => r._id === action.payload?._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(rejectReturn.fulfilled, (state, action) => {
        const idx = state.list.findIndex(r => r._id === action.payload?._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export default returnSlice.reducer;