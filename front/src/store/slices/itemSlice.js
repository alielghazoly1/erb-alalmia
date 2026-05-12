// ─── store/slices/itemSlice.js ────────────────────────────────────────────────
// Paginated infinite-scroll slice — يحمل 100 صنف في كل صفحة
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// جيب الصفحة الأولى (أو نتائج بحث جديدة) — يبدل الليستة
export const fetchItems = createAsyncThunk(
  'items/fetchPage',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await api.get('/items', { params: { page: 1, ...params } });
      return data; // { items, total, page, pageSize, hasMore }
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التحميل');
    }
  }
);

// جيب الصفحة التالية — يُضيف على الليستة
export const fetchMoreItems = createAsyncThunk(
  'items/fetchMore',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await api.get('/items', { params });
      return data;
    } catch (err) {
      return thunkAPI.rejectWithValue(err.response?.data?.message || 'خطأ في التحميل');
    }
  }
);

export const createItem = createAsyncThunk('items/create', async (itemData, thunkAPI) => {
  try {
    const { data } = await api.post('/items', itemData);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const updateItem = createAsyncThunk('items/update', async ({ id, ...rest }, thunkAPI) => {
  try {
    const { data } = await api.put(`/items/${id}`, rest);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue(err.response?.data?.message);
  }
});

export const deleteItem = createAsyncThunk('items/delete', async (id) => {
  await api.delete(`/items/${id}`);
  return id;
});

const itemSlice = createSlice({
  name: 'items',
  initialState: {
    list:        [],   // الصفحات المحملة
    total:       0,    // إجمالي الأصناف في الـ DB
    currentPage: 1,
    hasMore:     false,
    loading:     false,
    loadingMore: false,
    error:       null,
  },
  reducers: {
    clearItems: (state) => {
      state.list        = [];
      state.total       = 0;
      state.currentPage = 1;
      state.hasMore     = false;
    },
  },
  extraReducers: (builder) => {
    // ── fetchItems (fresh load) ─────────────────────────────────────
    builder
      .addCase(fetchItems.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchItems.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.list        = payload.items;
        state.total       = payload.total;
        state.currentPage = payload.page;
        state.hasMore     = payload.hasMore;
      })
      .addCase(fetchItems.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
      });

    // ── fetchMoreItems (append) ─────────────────────────────────────
    builder
      .addCase(fetchMoreItems.pending, (state) => {
        state.loadingMore = true;
      })
      .addCase(fetchMoreItems.fulfilled, (state, { payload }) => {
        state.loadingMore = false;
        // إضافة الجديد بس لو مش موجود (dedup بالـ _id)
        const existingIds = new Set(state.list.map((i) => i._id));
        const newItems    = payload.items.filter((i) => !existingIds.has(i._id));
        state.list        = [...state.list, ...newItems];
        state.currentPage = payload.page;
        state.hasMore     = payload.hasMore;
      })
      .addCase(fetchMoreItems.rejected, (state) => {
        state.loadingMore = false;
      });

    // ── mutations ────────────────────────────────────────────────────
    builder
      .addCase(createItem.fulfilled, (state, { payload }) => {
        // أضف في الأول وحافظ على الترتيب بالكود (insert in sorted position)
        const idx = state.list.findIndex((i) => i.code > payload.code);
        if (idx === -1) state.list.push(payload);
        else state.list.splice(idx, 0, payload);
        state.total += 1;
      })
      .addCase(updateItem.fulfilled, (state, { payload }) => {
        const idx = state.list.findIndex((i) => i._id === payload._id);
        if (idx !== -1) state.list[idx] = payload;
      })
      .addCase(deleteItem.fulfilled, (state, { payload }) => {
        state.list  = state.list.filter((i) => i._id !== payload);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const { clearItems } = itemSlice.actions;
export default itemSlice.reducer;
