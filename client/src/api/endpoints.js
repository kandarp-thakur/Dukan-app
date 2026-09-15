import api from './client';

// Unwraps the { success, message, data } envelope.
const unwrap = (promise) => promise.then((res) => res.data.data);

// ---------- Products ----------
export const productsApi = {
    list: () => unwrap(api.get('/products')),
    lowStock: () => unwrap(api.get('/products/low-stock')),
    create: (product) => unwrap(api.post('/products', product)),
    update: (id, updates) => unwrap(api.patch(`/products/${id}`, updates)),
    remove: (id) => unwrap(api.delete(`/products/${id}`)),
};

// ---------- Customers & Khata ----------
export const customersApi = {
    list: () => unwrap(api.get('/customers')),
    create: (customer) => unwrap(api.post('/customers', customer)),
    update: (id, updates) => unwrap(api.patch(`/customers/${id}`, updates)),
    remove: (id) => unwrap(api.delete(`/customers/${id}`)),
    khata: (id) => unwrap(api.get(`/customers/${id}/khata`)),
    recordPayment: (payload) => unwrap(api.post('/khata/payments', payload)),
};

// ---------- Suppliers & Purchases ----------
export const suppliersApi = {
    list: () => unwrap(api.get('/suppliers')),
    create: (supplier) => unwrap(api.post('/suppliers', supplier)),
    update: (id, updates) => unwrap(api.patch(`/suppliers/${id}`, updates)),
    remove: (id) => unwrap(api.delete(`/suppliers/${id}`)),
    statement: (id) => unwrap(api.get(`/suppliers/${id}/statement`)),
    createPurchase: (payload) => unwrap(api.post('/purchases', payload)),
    listPurchases: () => unwrap(api.get('/purchases')),
    recordPayment: (payload) => unwrap(api.post('/supplier-payments', payload)),
};

// ---------- Sales ----------
export const salesApi = {
    list: () => unwrap(api.get('/sales')),
    get: (id) => unwrap(api.get(`/sales/${id}`)),
    create: (payload) => unwrap(api.post('/sales', payload)),
    cancel: (id) => unwrap(api.patch(`/sales/${id}/cancel`)),
    remove: (id) => unwrap(api.delete(`/sales/${id}`)),
};

// ---------- Invoices ----------
export const invoicesApi = {
    list: (params) => unwrap(api.get('/invoices', { params })),
    get: (id) => unwrap(api.get(`/invoices/${id}`)),
    sendEmail: (id, formData) => unwrap(api.post(`/invoices/${id}/email`, formData)),
    share: (id) => unwrap(api.post(`/invoices/${id}/share`)),
    revokeShare: (id) => unwrap(api.delete(`/invoices/${id}/share`)),
};

// Public invoice lookup. Goes through the shared axios instance on purpose: the
// public endpoint answers 404 (never 401) so the auth-refresh interceptor never
// fires, and no bearer token is needed even when a session exists.
export const publicApi = {
    getInvoice: (token) => unwrap(api.get(`/public/invoices/${token}`)),
};

// ---------- Expenses ----------
export const expensesApi = {
    list: () => unwrap(api.get('/expenses')),
    create: (payload) => unwrap(api.post('/expenses', payload)),
    update: (id, updates) => unwrap(api.patch(`/expenses/${id}`, updates)),
    remove: (id) => unwrap(api.delete(`/expenses/${id}`)),
};

// ---------- Dashboard & Reports ----------
export const dashboardApi = {
    summary: (range = 'today') => unwrap(api.get('/dashboard/summary', { params: { range } })),
};

export const reportsApi = {
    daily: (date) => unwrap(api.get('/reports/daily', { params: { date } })),
    monthly: (month) => unwrap(api.get('/reports/monthly', { params: { month } })),
    outstanding: () => unwrap(api.get('/reports/outstanding')),
};

// ---------- Staff (users) ----------
export const usersApi = {
    list: () => unwrap(api.get('/users')),
    create: (payload) => unwrap(api.post('/users', payload)),
    updateRole: (id, role) => unwrap(api.patch(`/users/${id}/role`, { role })),
    remove: (id) => unwrap(api.delete(`/users/${id}`)),
};

// ---------- Business & Plans ----------
export const businessApi = {
    get: () => unwrap(api.get('/business')),
    update: (updates) => unwrap(api.patch('/business', updates)),
    requestUpgrade: (plan) => unwrap(api.post('/business/upgrade-request', { plan })),
};

export const plansApi = {
    list: () => unwrap(api.get('/plans')),
};

// ---------- Feature flags ----------
export const configApi = {
    features: () => unwrap(api.get('/config/features')),
};
