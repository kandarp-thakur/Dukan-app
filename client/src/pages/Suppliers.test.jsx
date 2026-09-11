import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Suppliers from './Suppliers';
import SupplierDetail from './SupplierDetail';
import { suppliersApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    suppliersApi: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        statement: vi.fn(),
        createPurchase: vi.fn(),
        listPurchases: vi.fn(),
        recordPayment: vi.fn(),
    },
}));

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({ user: { role: 'owner', name: 'Owner' } }),
}));

const renderDetail = () =>
    render(
        <MemoryRouter initialEntries={['/suppliers/s1']}>
            <Routes>
                <Route path="/suppliers/:id" element={<SupplierDetail />} />
            </Routes>
        </MemoryRouter>
    );

describe('Suppliers page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        suppliersApi.list.mockResolvedValue({
            suppliers: [{ id: 's1', name: 'Wholesale Mart', phone: '1234567890', balance: 250000 }],
        });
    });

    it('renders suppliers with formatted payable balances', async () => {
        render(
            <MemoryRouter>
                <Suppliers />
            </MemoryRouter>
        );
        expect(await screen.findByText('Wholesale Mart')).toBeInTheDocument();
        expect(screen.getByText('₹2,500')).toBeInTheDocument();
    });

    it('creates a supplier', async () => {
        suppliersApi.create.mockResolvedValue({ supplier: {} });
        render(
            <MemoryRouter>
                <Suppliers />
            </MemoryRouter>
        );
        await screen.findByText('Wholesale Mart');
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kirana Depot' } });
        fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '9876500000' } });
        fireEvent.click(screen.getByRole('button', { name: /add supplier/i }));
        await waitFor(() =>
            expect(suppliersApi.create).toHaveBeenCalledWith({
                name: 'Kirana Depot',
                phone: '9876500000',
            })
        );
    });

    it('links each supplier to their statement', async () => {
        render(
            <MemoryRouter>
                <Suppliers />
            </MemoryRouter>
        );
        const link = await screen.findByRole('link', { name: /statement/i });
        expect(link).toHaveAttribute('href', '/suppliers/s1');
    });
});

describe('SupplierDetail page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        suppliersApi.statement.mockResolvedValue({
            supplier: { id: 's1', name: 'Wholesale Mart', phone: '1234567890', balance: 1000 },
            purchases: [
                {
                    id: 'pu1',
                    items: [{ name: 'Soap', qty: 10, cost: 200 }],
                    total: 2000,
                    paymentMethod: 'credit',
                    date: '2026-09-01T10:00:00.000Z',
                },
            ],
            payments: [
                { id: 'pay1', amount: 1000, method: 'upi', note: '', date: '2026-09-03T10:00:00.000Z' },
            ],
            balance: 1000,
        });
    });

    it('renders the statement with running payable balance', async () => {
        renderDetail();
        expect(await screen.findByText('Wholesale Mart')).toBeInTheDocument();
        expect(screen.getByText('+₹20')).toBeInTheDocument();
        expect(screen.getByText('-₹10')).toBeInTheDocument();
        expect(screen.getByText('₹20')).toBeInTheDocument();
        // Final running payable and the balance card both show ₹10.
        expect(screen.getAllByText('₹10').length).toBe(2);
    });

    it('records a purchase converting item costs to paise', async () => {
        suppliersApi.createPurchase.mockResolvedValue({ purchase: {} });
        renderDetail();
        await screen.findByText('Wholesale Mart');
        fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Soap' } });
        fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Cost per unit (₹)'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'credit' } });
        fireEvent.click(screen.getByRole('button', { name: /record purchase/i }));
        await waitFor(() =>
            expect(suppliersApi.createPurchase).toHaveBeenCalledWith({
                supplierId: 's1',
                items: [{ name: 'Soap', qty: 10, cost: 200 }],
                paymentMethod: 'credit',
            })
        );
    });

    it('records a supplier payment converting rupees to paise', async () => {
        suppliersApi.recordPayment.mockResolvedValue({ payment: {}, balance: 0 });
        renderDetail();
        await screen.findByText('Wholesale Mart');
        fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '50' } });
        fireEvent.change(screen.getByLabelText('Pay using'), { target: { value: 'upi' } });
        fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Settlement' } });
        fireEvent.click(screen.getByRole('button', { name: /record payment/i }));
        await waitFor(() =>
            expect(suppliersApi.recordPayment).toHaveBeenCalledWith({
                supplierId: 's1',
                amount: 5000,
                method: 'upi',
                note: 'Settlement',
            })
        );
    });
});
