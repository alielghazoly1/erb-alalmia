import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchWorkers = createAsyncThunk('workers/fetchAll', async (params = {}) => {
  const { data } = await api.get('/workers', { params });
  return data;
});

export const fetchWorkerStatement = createAsyncThunk(
  'workers/statement',
  async ({ workerId, ...params }, thunkAPI) => {
    try {
      const { data } = await api.get(`/workers/${workerId}/statement`, { params });
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message);
    }
  }
);

export const createWorker = createAsyncThunk('workers/create', async (d, thunkAPI) => {
  try {
    const { data } = await api.post('/workers', d);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const updateWorker = createAsyncThunk('workers/update', async ({ id, ...rest }, thunkAPI) => {
  try {
    const { data } = await api.put(`/workers/${id}`, rest);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const deleteWorker = createAsyncThunk('workers/delete', async (id, thunkAPI) => {
  try {
    await api.delete(`/workers/${id}`);
    return id;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

const workerSlice = createSlice({
  name: 'workers',
  initialState: {
    list:      [],
    statement: null,
    loading:   false,
    stmtLoading: false,
    error:     null,
  },
  reducers: {
    clearStatement: (state) => { state.statement = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkers.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchWorkers.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchWorkers.rejected,  (state) => { state.loading = false; })

      .addCase(fetchWorkerStatement.pending,   (state) => { state.stmtLoading = true; })
      .addCase(fetchWorkerStatement.fulfilled, (state, action) => { state.stmtLoading = false; state.statement = action.payload; })
      .addCase(fetchWorkerStatement.rejected,  (state) => { state.stmtLoading = false; })

      .addCase(createWorker.fulfilled, (state, action) => { state.list.unshift(action.payload); })
      .addCase(updateWorker.fulfilled, (state, action) => {
        const idx = state.list.findIndex(w => w._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(deleteWorker.fulfilled, (state, action) => {
        state.list = state.list.filter(w => w._id !== action.payload);
      });
  },
});

export const { clearStatement } = workerSlice.actions;
export default workerSlice.reducer;