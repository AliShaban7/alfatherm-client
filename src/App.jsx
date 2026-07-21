import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import { HomeRedirect, OwnerRoute, SuperOwnerRoute } from './components/auth/RoleGuards';

// Route-level code splitting: each page is fetched on demand instead of being
// bundled into one large initial chunk, so first paint / login is much faster.
const Sales = lazy(() => import('./pages/Sales'));
const NewSale = lazy(() => import('./pages/NewSale'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Products = lazy(() => import('./pages/Products'));
const Customers = lazy(() => import('./pages/Customers'));
const Debtors = lazy(() => import('./pages/Debtors'));
const Vendors = lazy(() => import('./pages/Vendors'));
const Creditors = lazy(() => import('./pages/Creditors'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Reports = lazy(() => import('./pages/Reports'));
const Warehouses = lazy(() => import('./pages/Warehouses'));
const Categories = lazy(() => import('./pages/Categories'));
const Salesmen = lazy(() => import('./pages/Salesmen'));
const Ustalar = lazy(() => import('./pages/Ustalar'));
const Fakturalar = lazy(() => import('./pages/Fakturalar'));
const Users = lazy(() => import('./pages/Users'));
const MySales = lazy(() => import('./pages/MySales'));
const Stocking = lazy(() => import('./pages/Stocking'));

const PageLoader = () => (
  <div className="loading" style={{ height: '60vh' }}>
    <div className="spinner"></div>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<HomeRedirect />} />
                  <Route path="/my-sales" element={<MySales />} />
                  <Route path="/stock" element={<Stocking />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/sales/new" element={<NewSale />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/inventory" element={<OwnerRoute><Inventory /></OwnerRoute>} />
                  <Route path="/debtors" element={<OwnerRoute><Debtors /></OwnerRoute>} />
                  <Route path="/vendors" element={<Vendors />} />
                  <Route path="/creditors" element={<OwnerRoute><Creditors /></OwnerRoute>} />
                  <Route path="/expenses" element={<OwnerRoute><Expenses /></OwnerRoute>} />
                  <Route path="/reports" element={<OwnerRoute><Reports /></OwnerRoute>} />
                  <Route path="/warehouses" element={<OwnerRoute><Warehouses /></OwnerRoute>} />
                  <Route path="/categories" element={<OwnerRoute><Categories /></OwnerRoute>} />
                  <Route path="/salesmen" element={<OwnerRoute><Salesmen /></OwnerRoute>} />
                  <Route path="/ustalar" element={<OwnerRoute><Ustalar /></OwnerRoute>} />
                  <Route path="/fakturalar" element={<OwnerRoute><Fakturalar /></OwnerRoute>} />
                  <Route path="/users" element={<SuperOwnerRoute><Users /></SuperOwnerRoute>} />
                </Routes>
              </Suspense>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;
