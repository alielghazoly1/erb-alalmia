// ─── customerSlice.js ────────────────────────────────────────────────────────
// Redux Slice للعملاء — كل الـ async thunks + state management
// ────────────────────────────────────────────────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ═══════════════════════════════════════════════════════════════════
// Async Thunks
// ═══════════════════════════════════════════════════════════════════

/** جلب كل العملاء — الفلترة تتم في الفرونت عبر useCustomerFilters */
export const fetchCustomers = createAsyncThunk(
  'customers/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/customers', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'خطأ في التحميل');
    }
  },
);

/** كشف حساب عميل لموسم معين (أو الموسم النشط لو ما فيش) */
export const fetchCustomerStatement = createAsyncThunk(
  'customers/statement',
  async ({ customerId, seasonId }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/customers/${customerId}/statement`, {
        params: seasonId ? { seasonId } : {},
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'خطأ في الكشف');
    }
  },
);

/** كشف العميل عبر كل المواسم */
export const fetchCustomerAllSeasons = createAsyncThunk(
  'customers/allSeasons',
  async (customerId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/customers/${customerId}/all-seasons`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  },
);

/** إضافة عميل جديد */
export const createCustomer = createAsyncThunk(
  'customers/create',
  async (customerData, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/customers', customerData);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'خطأ في الإضافة');
    }
  },
);

/** تعديل بيانات عميل */
export const updateCustomer = createAsyncThunk(
  'customers/update',
  async ({ id, ...rest }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/customers/${id}`, rest);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'خطأ في التعديل');
    }
  },
);

/** حذف (soft delete) عميل */
/** تعديل الرصيد الابتدائي للعميل */
 const updateCustomerBalance = createAsyncThunk(
  'customers/updateBalance',
  async ({ id, openingBalance }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/customers/${id}/initial-balance`, { openingBalance });
      return { id, openingBalance: data.openingBalance ?? openingBalance };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'خطأ في تحديث الرصيد');
    }
  },
);

export const deleteCustomer = createAsyncThunk(
  'customers/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/customers/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'خطأ في الحذف');
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// Slice
// ═══════════════════════════════════════════════════════════════════

const customerSlice = createSlice({
  name: 'customers',
  initialState: {
    list:             [],       // قائمة العملاء كاملة
    statement:        null,     // كشف الحساب للعميل المختار
    allSeasons:       [],       // كشف كل المواسم للعميل المختار
    loading:          false,    // تحميل القائمة
    statementLoading: false,    // تحميل الكشف
    error:            null,
  },
  reducers: {
    /** مسح بيانات الكشف عند الانتقال لعميل آخر */
    clearStatement(state) {
      state.statement  = null;
      state.allSeasons = [];
    },
    /** تحديث عميل واحد في القائمة مباشرةً (من خارج الـ slice لو لزم) */
    updateCustomerInList(state, action) {
      const idx = state.list.findIndex((c) => c._id === action.payload._id);
      if (idx !== -1) state.list[idx] = { ...state.list[idx], ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchCustomers ──────────────────────────────────────────
      .addCase(fetchCustomers.pending,   (s) => { s.loading = true; s.error = null; })
      .addCase(fetchCustomers.fulfilled, (s, { payload }) => { s.loading = false; s.list = payload; })
      .addCase(fetchCustomers.rejected,  (s, { payload }) => { s.loading = false; s.error = payload; })

      // ── fetchCustomerStatement ──────────────────────────────────
      .addCase(fetchCustomerStatement.pending,   (s) => { s.statementLoading = true; })
      .addCase(fetchCustomerStatement.fulfilled, (s, { payload }) => {
        s.statementLoading = false;
        s.statement = payload;
      })
      .addCase(fetchCustomerStatement.rejected,  (s) => { s.statementLoading = false; })

      // ── fetchCustomerAllSeasons ─────────────────────────────────
      .addCase(fetchCustomerAllSeasons.fulfilled, (s, { payload }) => {
        s.allSeasons = payload;
      })

      // ── createCustomer ──────────────────────────────────────────
      // نضيف العميل الجديد في أول القائمة مباشرةً بدون refetch
      .addCase(createCustomer.fulfilled, (s, { payload }) => {
        s.list.unshift(payload);
      })

      // ── updateCustomer ──────────────────────────────────────────
      .addCase(updateCustomer.fulfilled, (s, { payload }) => {
        const idx = s.list.findIndex((c) => c._id === payload._id);
        if (idx !== -1) s.list[idx] = { ...s.list[idx], ...payload };
      })

      // ── updateCustomerBalance ──────────────────────────────────
      .addCase(updateCustomerBalance.fulfilled, (s, { payload: { id, openingBalance } }) => {
        const c = s.list.find(x => x._id === id || x.id === id);
        if (c) c.openingBalance = openingBalance;
      })
      // ── deleteCustomer ──────────────────────────────────────────
      .addCase(deleteCustomer.fulfilled, (s, { payload: id }) => {
        s.list = s.list.filter((c) => c._id !== id);
      });
  },
});

export const { clearStatement, updateCustomerInList } = customerSlice.actions;
export { updateCustomerBalance };
export default customerSlice.reducer;
