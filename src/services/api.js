import axios from 'axios';

const api = axios.create({
  // Same-origin '/api' by default (proxy in dev, rewrite/monorepo in prod). Set
  // VITE_API_URL when the backend is hosted separately, e.g. https://api.example.com
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000 // 15 second timeout
});

// Simple in-memory cache for GET requests
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// The accountant works on a selected founder's books; the chosen owner is sent
// on every request so the backend scopes to it. null for everyone else.
const getActingOwner = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (u?.role !== 'ACCOUNTANT') return null;
    return localStorage.getItem('actingOwner') || 'owner_zaur_001';
  } catch {
    return null;
  }
};

const getCacheKey = (config) => {
  const token = localStorage.getItem('token') || '';
  const sessionKey = token.slice(-20);
  // Include the acting owner so a switch doesn't serve the previous owner's cache.
  return `${sessionKey}:${getActingOwner() || ''}:${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
};

const shouldSkipCache = (url = '') =>
  url.includes('/auth/') ||
  url.includes('/sales/warehouse-stock/') ||
  /^\/sales\/[a-f0-9]{24}$/i.test(url);

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const actingOwner = getActingOwner();
    if (actingOwner) {
      config.headers['x-acting-owner'] = actingOwner;
    }

    if (config.method === 'get' && !shouldSkipCache(config.url)) {
      const cacheKey = getCacheKey(config);
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        config.adapter = () => Promise.resolve({
          data: cached.data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {}
        });
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    const method = response.config.method;

    // Any successful mutation (POST/PUT/PATCH/DELETE) can change data the cached
    // GETs reflect — a payment, a sale reversal, a stock entry, etc. Invalidate
    // the whole cache so the page's immediate refetch returns fresh data instead
    // of a stale 30s-cached list (which is why a manual refresh was needed).
    if (method && method !== 'get') {
      cache.clear();
      return response;
    }

    // Cache successful GET responses (skip auth routes)
    if (method === 'get' && !shouldSkipCache(response.config.url)) {
      const cacheKey = getCacheKey(response.config);
      cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Export function to clear cache (call after mutations)
export const clearApiCache = () => cache.clear();


export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  changePassword: (data) => api.put('/auth/change-password', data),
  getUsernames: (q) => api.get('/auth/usernames', { params: { q } })
};

export const userAPI = {
  getAll: () => api.get('/auth/users'),
  create: (data) => api.post('/auth/register', data),
  update: (id, data) => api.put(`/auth/users/${id}`, data),
  resetPassword: (id, newPassword) => api.post(`/auth/users/${id}/reset-password`, { newPassword }),
  deactivate: (id) => api.delete(`/auth/users/${id}`)
};

export const productAPI = {
  getAll: (params) => api.get('/products', { params }),
  getOptions: () => api.get('/products/options'),
  // Bulk import can take a while for thousands of rows — allow a longer timeout.
  importProducts: (products) =>
    api.post('/products/import', { products }, { timeout: 120000 }).then((r) => { clearApiCache(); return r; }),
  getById: (id) => api.get(`/products/${id}`),
  getWithStock: (id) => api.get(`/products/${id}/stock`),
  create: (data) => api.post('/products', data).then(r => { clearApiCache(); return r; }),
  update: (id, data) => api.put(`/products/${id}`, data).then(r => { clearApiCache(); return r; }),
  delete: (id) => api.delete(`/products/${id}`).then(r => { clearApiCache(); return r; })
};

export const inventoryAPI = {
  getAll: () => api.get('/inventory'),
  getByWarehouse: (warehouseId) => api.get(`/inventory/warehouse/${warehouseId}`),
  getTransactions: (params) => api.get('/inventory/transactions', { params }),
  productEntry: (data) => api.post('/inventory/entry', data).then(r => { clearApiCache(); return r; }),
  importStock: (rows) => api.post('/inventory/import-stock', { rows }, { timeout: 120000 }).then(r => { clearApiCache(); return r; }),
  transfer: (data) => api.post('/inventory/transfer', data).then(r => { clearApiCache(); return r; }),
  transferBulk: (data) => api.post('/inventory/transfer-bulk', data).then(r => { clearApiCache(); return r; }),
  update: (id, data) => api.put(`/inventory/${id}`, data).then(r => { clearApiCache(); return r; }),
  delete: (id) => api.delete(`/inventory/${id}`).then(r => { clearApiCache(); return r; })
};

export const saleAPI = {
  getAll: (params) => api.get('/sales', { params }),
  getById: (id) => api.get(`/sales/${id}`),
  // A sale touches more than the sales list: it changes warehouse stock,
  // debtors (credit sales), customer totals, and the dashboard/report figures.
  // Clearing only the sales cache left those stale for up to 30s, so clear all.
  create: (data) => api.post('/sales', data).then((r) => { clearApiCache(); return r; }),
  cancel: (id) => api.put(`/sales/${id}/cancel`).then((r) => { clearApiCache(); return r; }),
  getDailySummary: (params) => api.get('/sales/daily-summary', { params }),
  getWarehouseStock: (warehouseId) => api.get(`/sales/warehouse-stock/${warehouseId}`)
};

export const purchaseInvoiceAPI = {
  getAll: (params) => api.get('/purchase-invoices', { params }),
  getById: (id) => api.get(`/purchase-invoices/${id}`),
  create: (data) => api.post('/purchase-invoices', data).then((r) => { clearApiCache(); return r; }),
  importInvoices: (rows) => api.post('/purchase-invoices/import', { rows }, { timeout: 120000 }).then((r) => { clearApiCache(); return r; })
};

export const customerAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  getHistory: (id) => api.get(`/customers/${id}/history`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
};

export const debtorAPI = {
  getAll: (params) => api.get('/debtors', { params }),
  getById: (id) => api.get(`/debtors/${id}`),
  getSummary: (params) => api.get('/debtors/summary', { params }),
  getOverdue: () => api.get('/debtors/overdue'),
  addPayment: (id, data) => api.post(`/debtors/${id}/payment`, data)
};

export const vendorAPI = {
  getAll: (params) => api.get('/vendors', { params }),
  getById: (id) => api.get(`/vendors/${id}`),
  create: (data) => api.post('/vendors', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`)
};

export const creditorAPI = {
  getAll: (params) => api.get('/creditors', { params }),
  getById: (id) => api.get(`/creditors/${id}`),
  getSummary: () => api.get('/creditors/summary'),
  create: (data) => api.post('/creditors', data),
  addPayment: (id, data) => api.post(`/creditors/${id}/payment`, data)
};

export const expenseAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  getSummaryByCategory: (params) => api.get('/expenses/summary/category', { params }),
  getMonthlySummary: (params) => api.get('/expenses/summary/monthly', { params }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`)
};

export const reportAPI = {
  getDashboard: (params) => api.get('/reports/dashboard', { params }),
  getPeriodStats: (params) => api.get('/reports/period-stats', { params }),
  getSalesReport: (params) => api.get('/reports/sales', { params }),
  getProductSalesReport: (params) => api.get('/reports/products', { params }),
  getInventoryReport: () => api.get('/reports/inventory'),
  getBranchReport: (params) => api.get('/reports/branches', { params }),
  getProfitLossReport: (params) => api.get('/reports/profit-loss', { params }),
  getSalespersonReport: (params) => api.get('/reports/salespersons', { params })
};

export const salespersonAPI = {
  getAll: (params) => api.get('/salespersons', { params }),
  getMySummary: (params) => api.get('/salespersons/me/summary', { params }),
  getMyCustomers: () => api.get('/salespersons/me/customers'),
  getTagStats: (params) => api.get('/salespersons/stats', { params }),
  getTagDebtors: (id, params) => api.get(`/salespersons/${id}/debtors`, { params }),
  getById: (id) => api.get(`/salespersons/${id}`),
  create: (data) => api.post('/salespersons', data).then((r) => { clearApiCache(); return r; }),
  update: (id, data) => api.put(`/salespersons/${id}`, data).then((r) => { clearApiCache(); return r; }),
  delete: (id) => api.delete(`/salespersons/${id}`).then((r) => { clearApiCache(); return r; })
};

export const ustaAPI = {
  getAll: (params) => api.get('/ustas', { params }),
  getBalances: () => api.get('/ustas/balances'),
  getById: (id) => api.get(`/ustas/${id}`),
  create: (data) => api.post('/ustas', data).then((r) => { clearApiCache(); return r; }),
  update: (id, data) => api.put(`/ustas/${id}`, data).then((r) => { clearApiCache(); return r; }),
  delete: (id) => api.delete(`/ustas/${id}`).then((r) => { clearApiCache(); return r; }),
  pay: (id, data) => api.post(`/ustas/${id}/pay`, data).then((r) => { clearApiCache(); return r; })
};

export const branchAPI = {
  getAll: (params) => api.get('/branches', { params }),
  getById: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`)
};

export const warehouseAPI = {
  getAll: (params) => api.get('/warehouses', { params }),
  getById: (id) => api.get(`/warehouses/${id}`),
  getMain: () => api.get('/warehouses/main'),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  delete: (id) => api.delete(`/warehouses/${id}`)
};

export const categoryAPI = {
  getAll: (params) => api.get('/categories', { params }),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`)
};

export default api;
