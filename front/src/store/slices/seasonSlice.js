import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchActiveSeason = createAsyncThunk('season/fetchActive', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/seasons/active');
    return data;
  } catch {
    return thunkAPI.rejectWithValue('مفيش موسم نشط');
  }
});

export const fetchSeasons = createAsyncThunk('season/fetchAll', async () => {
  const { data } = await api.get('/seasons');
  return data;
});

export const createSeason = createAsyncThunk('season/create', async (seasonData, thunkAPI) => {
  try {
    const { data } = await api.post('/seasons', seasonData);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في الإنشاء');
  }
});

export const updateSeason = createAsyncThunk('season/update', async ({ id, ...rest }, thunkAPI) => {
  try {
    const { data } = await api.put(`/seasons/${id}`, rest);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التعديل');
  }
});

// تفعيل موسم قديم بدون تأثير على المخزن
export const activateSeason = createAsyncThunk('season/activate', async (id, thunkAPI) => {
  try {
    const { data } = await api.put(`/seasons/${id}/activate`);
    return data.season;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التفعيل');
  }
});

const seasonSlice = createSlice({
  name: 'season',
  initialState: {
    activeSeason:     null,   // الموسم النشط في DB
    selectedSeasonId: null,   // الموسم اللي المستخدم شايفه (null = النشط)
    seasons:          [],
    loading:          false,
    error:            null,
  },
  reducers: {
    // المستخدم يختار موسم يشوفه (للقراءة فقط للمستخدم العادي)
    setSelectedSeason: (state, action) => {
      state.selectedSeasonId = action.payload; // null = الموسم النشط
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveSeason.fulfilled, (state, action) => {
        state.activeSeason = action.payload;
        // لو مفيش موسم محدد مختار — استخدم النشط
        if (!state.selectedSeasonId) {
          state.selectedSeasonId = action.payload._id;
        }
      })
      .addCase(fetchSeasons.fulfilled, (state, action) => {
        state.seasons = action.payload;
      })
      .addCase(createSeason.fulfilled, (state, action) => {
        state.activeSeason    = action.payload;
        state.selectedSeasonId = action.payload._id;
        state.seasons = [
          action.payload,
          ...state.seasons.map(s => ({ ...s, isActive: false })),
        ];
      })
      .addCase(updateSeason.fulfilled, (state, action) => {
        const idx = state.seasons.findIndex(s => s._id === action.payload._id);
        if (idx !== -1) state.seasons[idx] = action.payload;
        if (state.activeSeason?._id === action.payload._id) {
          state.activeSeason = action.payload;
        }
      })
      .addCase(activateSeason.fulfilled, (state, action) => {
        // الموسم الجديد النشط
        state.activeSeason     = action.payload;
        state.selectedSeasonId = action.payload._id;
        // حدّث القائمة
        state.seasons = state.seasons.map(s => ({
          ...s,
          isActive: s._id === action.payload._id,
        }));
      });
  },
});

export const { setSelectedSeason } = seasonSlice.actions;
export default seasonSlice.reducer;