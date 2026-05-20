// ─── src/App.js ──────────────────────────────────────────────────────────────
// ✅ FIXED: أضفنا ErrorBoundary لمنع crash التطبيق عند وجود أخطاء runtime
// ─────────────────────────────────────────────────────────────────────────────
import { HashRouter } from 'react-router-dom';
import { Provider }   from 'react-redux';
import { Toaster }    from 'react-hot-toast';
import { store }      from './store';
import AppRoutes      from './routes/AppRoutes';
import ErrorBoundary  from './components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <HashRouter>
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          {/* ErrorBoundary داخلي لعزل أخطاء الـ Routes عن الـ Provider */}
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </HashRouter>
      </Provider>
    </ErrorBoundary>
  );
}
