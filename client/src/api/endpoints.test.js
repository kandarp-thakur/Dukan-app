import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => {
    const api = {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    };
    return { default: api };
});

import api from './client';
import {
    productsApi,
    customersApi,
    suppliersApi,
    salesApi,
    expensesApi,
    dashboardApi,
    reportsApi,
    usersApi,
    businessApi,
    plansApi,
} from './endpoints';

const envelope = (data) => ({ data: { success: true, message: 'OK', data } });

describe('api endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('productsApi unwraps the envelope', async () => {
        api.get.mockResolvedValue(envelope({ products: [] }));
        const data = await productsApi.list();
        expect(api.get).toHaveBeenCalledWith('/products');
        expect(data).toEqual({ products: [] });
    });

    it('productsApi.lowStock hits the specific route', async () => {
        api.get.mockResolvedValue(envelope({ products: [] }));
        await productsApi.lowStock();
        expect(api.get).toHaveBeenCalledWith('/products/low-stock');
    });

    it('customersApi.khata builds the nested URL', async () => {
        api.get.mockResolvedValue(envelope({ entries: [], balance: 0 }));
        await customersApi.khata('abc123');
        expect(api.get).toHaveBeenCalledWith('/customers/abc123/khata');
    });

    it('customersApi.recordPayment posts to khata payments', async () => {
        api.post.mockResolvedValue(envelope({ balance: 500 }));
        await customersApi.recordPayment({ customerId: 'c1', amount: 500 });
        expect(api.post).toHaveBeenCalledWith('/khata/payments', { customerId: 'c1', amount: 500 });
    });

    it('suppliersApi.createPurchase posts to /purchases', async () => {
        api.post.mockResolvedValue(envelope({ purchase: {} }));
        await suppliersApi.createPurchase({ supplierId: 's1', items: [] });
        expect(api.post).toHaveBeenCalledWith('/purchases', { supplierId: 's1', items: [] });
    });

    it('salesApi.cancel patches the cancel route', async () => {
        api.patch.mockResolvedValue(envelope({ sale: {} }));
        await salesApi.cancel('sale1');
        expect(api.patch).toHaveBeenCalledWith('/sales/sale1/cancel');
    });

    it('expensesApi.remove deletes by id', async () => {
        api.delete.mockResolvedValue(envelope(null));
        await expensesApi.remove('e1');
        expect(api.delete).toHaveBeenCalledWith('/expenses/e1');
    });

    it('dashboardApi.summary passes range as query param', async () => {
        api.get.mockResolvedValue(envelope({ summary: {} }));
        await dashboardApi.summary('month');
        expect(api.get).toHaveBeenCalledWith('/dashboard/summary', { params: { range: 'month' } });
    });

    it('reportsApi.daily passes date param', async () => {
        api.get.mockResolvedValue(envelope({ report: {} }));
        await reportsApi.daily('2026-09-10');
        expect(api.get).toHaveBeenCalledWith('/reports/daily', { params: { date: '2026-09-10' } });
    });

    it('usersApi.updateRole sends role in body', async () => {
        api.patch.mockResolvedValue(envelope({ user: {} }));
        await usersApi.updateRole('u1', 'owner');
        expect(api.patch).toHaveBeenCalledWith('/users/u1/role', { role: 'owner' });
    });

    it('businessApi.requestUpgrade posts plan', async () => {
        api.post.mockResolvedValue(envelope({ request: {} }));
        await businessApi.requestUpgrade('pro');
        expect(api.post).toHaveBeenCalledWith('/business/upgrade-request', { plan: 'pro' });
    });

    it('plansApi.list is public catalog', async () => {
        api.get.mockResolvedValue(envelope({ plans: [] }));
        await plansApi.list();
        expect(api.get).toHaveBeenCalledWith('/plans');
    });
});
