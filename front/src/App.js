// ─── src/App.js ──────────────────────────────────────────────────────────────
//  استبدلنا BrowserRouter بـ HashRouter علشان Electron production
//  لما الـ app بيتفتح من file:// الـ BrowserRouter بيكسر الـ routing
//  HashRouter بيشتغل صح في الحالتين: browser + Electron
// ─────────────────────────────────────────────────────────────────────────────
import { HashRouter } from 'react-router-dom';
import { Provider }   from 'react-redux';
import { Toaster }    from 'react-hot-toast';
import { store }      from './store';
import AppRoutes      from './routes/AppRoutes';

export default function App() {
  return (
    <Provider store={store}>
      <HashRouter>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <AppRoutes />
      </HashRouter>
    </Provider>
  );
}