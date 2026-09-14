import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sales from './Sales';
import SaleDetail from './SaleDetail';
import { salesApi, productsApi, customersApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    salesApi: {
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        cancel: vi.fn(),
        remove: vi.fn(),
    },
    productsApi: {
        list: vi.fn(),
    },
    customersApi: {
        list: vi.fn(),
    },
}));

vi.mock('react-to-print', () => ({
    useReactToPrint: () => vi.fn(),
}));

const mockAuth = {
    user: { role: 'owner', name: 'Owner' },
    business: { name: 'Local Test Shop', address: 'Main Road, Pune', gstin: '27ABCDE1234F1Z5' },
};

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

const sale = {
    id: 's1',
    invoiceNumber: 'INV-1',
    items: [{ name: 'Parle-G Biscuit', qty: 2, rate: 700, amount: 1400 }],
    subtotal: 1400,
    discount: 0,
    tax: 0,
    total: 1400,
    paymentMethod: 'cash',
    status: 'completed',
    date: '2026-09-05T10:30:00.000Z',
    customerId: null,
};

const renderDetail = () =>
    render(
        <MemoryRouter initialEntries={['/sales/s1']}>
            <Routes>
                <Route path="/sales/:id" element={<SaleDetail />} />
            </Routes>
        </MemoryRouter>
    );

describe('Sales page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        salesApi.list.mockResolvedValue({ sales: [sale] });
        productsApi.list.mockResolvedValue({
            products: [{ id: 'p1', name: 'Parle-G Biscuit', sellingPrice: 700, stockQty: 40 }],
        });
        customersApi.list.mockResolvedValue({
            customers: [{ id: 'c1', name: 'Ramesh', phone: '', balance: 0 }],
        });
    });

    it('renders the sales list with invoice number, total and status', async () => {
        render(
            <MemoryRouter>
                <Sales />
            </MemoryRouter>
        );
        expect(await screen.findByText('INV-1')).toBeInTheDocument();
        expect(screen.getByText('₹14')).toBeInTheDocument();
        expect(screen.getByText('cash')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
    });

    it('creates a cash sale converting rupees to paise', async () => {
        salesApi.create.mockResolvedValue({ sale });
        render(
            <MemoryRouter>
                <Sales />
            </MemoryRouter>
        );
        await screen.findByText('INV-1');
        fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Parle-G Biscuit' } });
        fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Rate (₹)'), { target: { value: '7' } });
        fireEvent.click(screen.getByRole('button', { name: /record sale/i }));
        await waitFor(() =>
            expect(salesApi.create).toHaveBeenCalledWith({
                items: [{ name: 'Parle-G Biscuit', qty: 2, rate: 700, gstRate: 0 }],
                discount: 0,
                isGst: false,
                paymentMethod: 'cash',
            })
        );
    });

    it('blocks credit sales without a customer', async () => {
        render(
            <MemoryRouter>
                <Sales />
            </MemoryRouter>
        );
        await screen.findByText('INV-1');
        fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Parle-G Biscuit' } });
        fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText('Rate (₹)'), { target: { value: '7' } });
        fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'credit' } });
        fireEvent.click(screen.getByRole('button', { name: /record sale/i }));
        expect(await screen.findByText(/credit sales require a customer/i)).toBeInTheDocument();
        expect(salesApi.create).not.toHaveBeenCalled();
    });

    it('creates a credit sale with the selected customer', async () => {
        salesApi.create.mockResolvedValue({ sale });
        render(
            <MemoryRouter>
                <Sales />
            </MemoryRouter>
        );
        await screen.findByText('INV-1');
        fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Parle-G Biscuit' } });
        fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText('Rate (₹)'), { target: { value: '7' } });
        fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'credit' } });
        fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'c1' } });
        fireEvent.click(screen.getByRole('button', { name: /record sale/i }));
        await waitFor(() =>
            expect(salesApi.create).toHaveBeenCalledWith({
                items: [{ name: 'Parle-G Biscuit', qty: 1, rate: 700, gstRate: 0 }],
                discount: 0,
                isGst: false,
                paymentMethod: 'credit',
                customerId: 'c1',
            })
        );
    });

    it('creates a GST sale with rate, HSN and derived place of supply', async () => {
        salesApi.create.mockResolvedValue({ sale });
        render(
            <MemoryRouter>
                <Sales />
            </MemoryRouter>
        );
        await screen.findByText('INV-1');
        fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Rice' } });
        fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText('Rate (₹)'), { target: { value: '100' } });
        fireEvent.click(screen.getByRole('button', { name: 'GST invoice' }));
        fireEvent.change(screen.getByLabelText('GST rate'), { target: { value: '18' } });
        fireEvent.change(screen.getByLabelText('HSN code'), { target: { value: '1006' } });
        fireEvent.click(screen.getByRole('button', { name: /record sale/i }));
        await waitFor(() =>
            expect(salesApi.create).toHaveBeenCalledWith({
                items: [{ name: 'Rice', qty: 1, rate: 10000, gstRate: 18, hsn: '1006' }],
                discount: 0,
                isGst: true,
                paymentMethod: 'cash',
                placeOfSupply: 'MH',
            })
        );
    });

    it('cancels a sale after confirmation', async () => {
        salesApi.cancel.mockResolvedValue({ sale: { ...sale, status: 'cancelled' } });
        window.confirm = vi.fn().mockReturnValue(true);
        render(
            <MemoryRouter>
                <Sales />
            </MemoryRouter>
        );
        await screen.findByText('INV-1');
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        await waitFor(() => expect(salesApi.cancel).toHaveBeenCalledWith('s1'));
    });
});

describe('SaleDetail invoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        salesApi.get.mockResolvedValue({ sale });
    });

    it('renders the invoice with business header, items, totals and amount in words', async () => {
        renderDetail();
        expect(await screen.findByText('INV-1')).toBeInTheDocument();
        expect(screen.getAllByText('Local Test Shop').length).toBeGreaterThan(0);
        expect(screen.getByText(/27ABCDE1234F1Z5/)).toBeInTheDocument();
        expect(screen.getByText('Parle-G Biscuit')).toBeInTheDocument();
        expect(screen.getAllByText('₹14').length).toBeGreaterThan(0);
        expect(screen.getByText(/fourteen rupees only/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /print invoice/i })).toBeInTheDocument();
    });
});
