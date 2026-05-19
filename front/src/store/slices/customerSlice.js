// ─── store/slices/customerSlice.js ───────────────────────────────────────────
// Redux Slice للعملاء — كل الـ async thunks + state management
// ─────────────────────────────────────────────────────────────────────────────
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// Async Thunks
// ═══════════════════════════════════════════════════════════════════════════════

/** جلب كل العملاء مع أرصدتهم — يقبل { seasonId } اختياري */
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

/** كشف حساب عميل لموسم معين */
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

/** كشف العميل عبر كل المواسم — يرجع { customer, seasons: [...] } */
export const fetchCustomerAllSeasons = createAsyncThunk(
  'customers/allSeasons',
  async (customerId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/customers/${customerId}/all-seasons`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'خطأ في جلب المواسم');
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

/**
 * تعديل الرصيد الابتدائي للعميل في موسم محدد.
 * seasonId مطلوب — الـ backend يرفض الطلب بدونه.
 */
export const updateCustomerBalance = createAsyncThunk(
  'customers/updateBalance',
  async ({ id, openingBalance, seasonId }, { rejectWithValue }) => {
    try {
      if (!seasonId) return rejectWithValue('يجب تحديد الموسم أولاً');
      const { data } = await api.patch(`/customers/${id}/initial-balance`, {
        openingBalance,
        seasonId,
      });
      return { id, openingBalance: data.openingBalance ?? openingBalance, seasonId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'خطأ في تحديث الرصيد');
    }
  },
);

/** حذف عميل (soft delete) */
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

// ═══════════════════════════════════════════════════════════════════════════════
// Slice
// ═══════════════════════════════════════════════════════════════════════════════

const customerSlice = createSlice({
  name: 'customers',
  initialState: {
    list:             [],    // قائمة العملاء مع أرصدتهم المحسوبة
    statement:        null,  // كشف الحساب للعميل المختار (موسم واحد)
    allSeasons:       [],    // كشف كل المواسم للعميل المختار
    loading:          false,
    statementLoading: false,
    error:            null,
  },
  reducers: {
    /** مسح بيانات الكشف عند الانتقال لعميل آخر */
    clearStatement(state) {
      state.statement  = null;
      state.allSeasons = [];
    },
    /** تحديث عميل واحد في القائمة مباشرةً */
    updateCustomerInList(state, action) {
      const idx = state.list.findIndex((c) => c._id === action.payload._id);
      if (idx !== -1) state.list[idx] = { ...state.list[idx], ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchCustomers ────────────────────────────────────────────────────
      .addCase(fetchCustomers.pending,   (s)            => { s.loading = true;  s.error = null; })
      .addCase(fetchCustomers.fulfilled, (s, { payload }) => { s.loading = false; s.list  = payload; })
      .addCase(fetchCustomers.rejected,  (s, { payload }) => { s.loading = false; s.error = payload; })

      // ── fetchCustomerStatement ────────────────────────────────────────────
      .addCase(fetchCustomerStatement.pending,   (s)            => { s.statementLoading = true; })
      .addCase(fetchCustomerStatement.fulfilled, (s, { payload }) => { s.statementLoading = false; s.statement = payload; })
      .addCase(fetchCustomerStatement.rejected,  (s)            => { s.statementLoading = false; })

      // ── fetchCustomerAllSeasons ───────────────────────────────────────────
      // payload = { customer, seasons: [...] } — نحتاج seasons فقط
      .addCase(fetchCustomerAllSeasons.fulfilled, (s, { payload }) => {
        s.allSeasons = payload?.seasons ?? [];
      })

      // ── createCustomer ────────────────────────────────────────────────────
      .addCase(createCustomer.fulfilled, (s, { payload }) => {
        s.list.unshift(payload);
      })

      // ── updateCustomer ────────────────────────────────────────────────────
      .addCase(updateCustomer.fulfilled, (s, { payload }) => {
        const idx = s.list.findIndex((c) => c._id === payload._id);
        if (idx !== -1) s.list[idx] = { ...s.list[idx], ...payload };
      })

      // ── updateCustomerBalance — نحدث openingBalance في القائمة فقط ────────
      // الـ balance المحسوب (totalSales + ...) سيتحدث عند fetchCustomers التالي
      .addCase(updateCustomerBalance.fulfilled, (s, { payload: { id, openingBalance } }) => {
        const customer = s.list.find((c) => c._id === id || c.id === id);
        if (customer) customer.openingBalance = openingBalance;
      })

      // ── deleteCustomer ────────────────────────────────────────────────────
      .addCase(deleteCustomer.fulfilled, (s, { payload: id }) => {
        s.list = s.list.filter((c) => c._id !== id);
      });
  },
});

export const { clearStatement, updateCustomerInList } = customerSlice.actions;
export default customerSlice.reducer;
