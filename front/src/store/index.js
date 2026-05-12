import { configureStore } from '@reduxjs/toolkit';
import authReducer          from './slices/authSlice';
import supplierReducer      from './slices/supplierSlice';
import itemReducer          from './slices/itemSlice';
import seasonReducer        from './slices/seasonSlice';
import purchaseReducer      from './slices/purchaseSlice';
import customerReducer      from './slices/customerSlice';
import saleReducer          from './slices/saleSlice';
import returnReducer        from './slices/returnSlice';
import transferReducer      from './slices/transferSlice';
import manufacturingReducer from './slices/manufacturingSlice';
import workerReducer        from './slices/workerSlice';

export const store = configureStore({
  reducer: {
    auth:          authReducer,
    suppliers:     supplierReducer,
    items:         itemReducer,
    season:        seasonReducer,
    purchase:      purchaseReducer,
    customers:     customerReducer,
    sales:         saleReducer,
    returns:       returnReducer,
    transfers:     transferReducer,
    manufacturing: manufacturingReducer,
    workers:       workerReducer,
  },
});