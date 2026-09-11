import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Products from './Products';
import { productsApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    productsApi: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
    },
}));

const mockAuth = { user: { role: 'owner', name: 'Owner' } };

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

const product = (overrides = {}) => ({
    id: 'p1',
    name: 'Parle-G Biscuit',
    sku: 'PGB',
    purchasePrice: 500,
    sellingPrice: 700,
    stockQty: 40,
    lowStockThreshold: 5,
    lowStock: false,
    ...overrides,
});

describe('Products page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.user = { role: 'owner', name: 'Owner' };
        productsApi.list.mockResolvedValue({ products: [product()] });
    });

    it('renders the product list with formatted prices and stock', async () => {
        render(<Products />);
        expect(await screen.findByText('Parle-G Biscuit')).toBeInTheDocument();
        expect(screen.getByText('₹5')).toBeInTheDocument();
        expect(screen.getByText('₹7')).toBeInTheDocument();
        expect(screen.getByText('40')).toBeInTheDocument();
        expect(screen.queryByText('Low stock')).toBeNull();
    });

    it('flags low-stock products', async () => {
        productsApi.list.mockResolvedValue({
            products: [product({ stockQty: 2, lowStock: true })],
        });
        render(<Products />);
        expect(await screen.findByText('Low stock')).toBeInTheDocument();
    });

    it('creates a product converting rupees to paise', async () => {
        productsApi.create.mockResolvedValue({ product: product({ id: 'p2' }) });
        render(<Products />);
        await screen.findByText('Parle-G Biscuit');
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kurkure' } });
        fireEvent.change(screen.getByLabelText('Purchase price (₹)'), { target: { value: '10.5' } });
        fireEvent.change(screen.getByLabelText('Selling price (₹)'), { target: { value: '15' } });
        fireEvent.change(screen.getByLabelText('Stock qty'), { target: { value: '25' } });
        fireEvent.click(screen.getByRole('button', { name: /add product/i }));
        await waitFor(() =>
            expect(productsApi.create).toHaveBeenCalledWith({
                name: 'Kurkure',
                sku: '',
                purchasePrice: 1050,
                sellingPrice: 1500,
                stockQty: 25,
                lowStockThreshold: 5,
            })
        );
    });

    it('shows the server error message when create fails', async () => {
        productsApi.create.mockRejectedValueOnce({
            response: { data: { message: 'Product name is required' } },
        });
        render(<Products />);
        await screen.findByText('Parle-G Biscuit');
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kurkure' } });
        fireEvent.change(screen.getByLabelText('Purchase price (₹)'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Selling price (₹)'), { target: { value: '15' } });
        fireEvent.click(screen.getByRole('button', { name: /add product/i }));
        expect(await screen.findByText('Product name is required')).toBeInTheDocument();
    });

    it('edits a product with rupee values pre-filled', async () => {
        productsApi.update.mockResolvedValue({ product: product() });
        render(<Products />);
        await screen.findByText('Parle-G Biscuit');
        fireEvent.click(screen.getByRole('button', { name: /edit/i }));
        expect(screen.getByLabelText('Purchase price (₹)').value).toBe('5');
        fireEvent.change(screen.getByLabelText('Selling price (₹)'), { target: { value: '9' } });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        await waitFor(() =>
            expect(productsApi.update).toHaveBeenCalledWith(
                'p1',
                expect.objectContaining({ sellingPrice: 900 })
            )
        );
    });

    it('deletes a product after confirmation for owners', async () => {
        productsApi.remove.mockResolvedValue(null);
        window.confirm = vi.fn().mockReturnValue(true);
        render(<Products />);
        await screen.findByText('Parle-G Biscuit');
        fireEvent.click(screen.getByRole('button', { name: /delete/i }));
        await waitFor(() => expect(productsApi.remove).toHaveBeenCalledWith('p1'));
    });

    it('hides delete for staff', async () => {
        mockAuth.user = { role: 'staff', name: 'Staff' };
        render(<Products />);
        await screen.findByText('Parle-G Biscuit');
        expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    });
});
