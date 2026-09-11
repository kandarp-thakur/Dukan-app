import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Customers from './Customers';
import CustomerDetail from './CustomerDetail';
import { customersApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    customersApi: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        khata: vi.fn(),
        recordPayment: vi.fn(),
    },
}));

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({ user: { role: 'owner', name: 'Owner' } }),
}));

const renderDetail = (id = 'c1') =>
    render(
        <MemoryRouter initialEntries={[`/customers/${id}`]}>
            <Routes>
                <Route path="/customers/:id" element={<CustomerDetail />} />
            </Routes>
        </MemoryRouter>
    );

describe('Customers page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        customersApi.list.mockResolvedValue({
            customers: [{ id: 'c1', name: 'Ramesh', phone: '9876543210', balance: 125000 }],
        });
    });

    it('renders customers with formatted balances', async () => {
        render(
            <MemoryRouter>
                <Customers />
            </MemoryRouter>
        );
        expect(await screen.findByText('Ramesh')).toBeInTheDocument();
        expect(screen.getByText('₹1,250')).toBeInTheDocument();
        expect(screen.getByText('9876543210')).toBeInTheDocument();
    });

    it('creates a customer', async () => {
        customersApi.create.mockResolvedValue({ customer: {} });
        render(
            <MemoryRouter>
                <Customers />
            </MemoryRouter>
        );
        await screen.findByText('Ramesh');
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Suresh' } });
        fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '9999999999' } });
        fireEvent.click(screen.getByRole('button', { name: /add customer/i }));
        await waitFor(() =>
            expect(customersApi.create).toHaveBeenCalledWith({
                name: 'Suresh',
                phone: '9999999999',
            })
        );
    });

    it('links each customer to their khata statement', async () => {
        render(
            <MemoryRouter>
                <Customers />
            </MemoryRouter>
        );
        const link = await screen.findByRole('link', { name: /khata/i });
        expect(link).toHaveAttribute('href', '/customers/c1');
    });
});

describe('CustomerDetail page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        customersApi.khata.mockResolvedValue({
            customer: { id: 'c1', name: 'Ramesh', phone: '9876543210', balance: 1500 },
            entries: [
                { id: 'e1', type: 'credit', amount: 2000, note: 'Sale', date: '2026-09-01T10:00:00.000Z' },
                { id: 'e2', type: 'payment', amount: 500, note: 'Cash', date: '2026-09-03T10:00:00.000Z' },
            ],
            balance: 1500,
        });
    });

    it('renders the khata statement with running balance', async () => {
        renderDetail();
        expect(await screen.findByText('Ramesh')).toBeInTheDocument();
        expect(screen.getByText('+₹20')).toBeInTheDocument();
        expect(screen.getByText('-₹5')).toBeInTheDocument();
        expect(screen.getByText('₹20')).toBeInTheDocument();
        // Final running balance and the balance card both show ₹15.
        expect(screen.getAllByText('₹15').length).toBe(2);
    });

    it('records a payment converting rupees to paise', async () => {
        customersApi.recordPayment.mockResolvedValue({ payment: {} });
        renderDetail();
        await screen.findByText('Ramesh');
        fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '100.5' } });
        fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'UPI' } });
        fireEvent.click(screen.getByRole('button', { name: /record payment/i }));
        await waitFor(() =>
            expect(customersApi.recordPayment).toHaveBeenCalledWith({
                customerId: 'c1',
                amount: 10050,
                note: 'UPI',
            })
        );
    });
});
