import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Invoices from './Invoices';
import { invoicesApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    invoicesApi: {
        list: vi.fn(),
        get: vi.fn(),
    },
}));

const gst = {
    id: 'i1',
    invoiceNumber: 'INV-1',
    date: '2026-09-01T10:00:00.000Z',
    buyerName: 'Ramesh',
    total: 12980,
    isGst: true,
    status: 'completed',
};
const nonGst = {
    id: 'i2',
    invoiceNumber: 'INV-2',
    date: '2026-09-10T10:00:00.000Z',
    buyerName: 'Suresh',
    total: 1000,
    isGst: false,
    status: 'completed',
};

const renderPage = () =>
    render(
        <MemoryRouter>
            <Invoices />
        </MemoryRouter>
    );

describe('Invoices page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invoicesApi.list.mockResolvedValue({ invoices: [gst, nonGst] });
    });

    it('renders invoice rows with type badges', async () => {
        renderPage();
        expect(await screen.findByText('INV-1')).toBeInTheDocument();
        expect(screen.getByText('Ramesh')).toBeInTheDocument();
        expect(screen.getByText('₹129.80')).toBeInTheDocument();
        // 'GST' / 'Non-GST' also appear as <option> text in the type filter,
        // so scope the badge assertions to the table to target the intended nodes.
        const table = screen.getByRole('table');
        expect(within(table).getByText('GST')).toBeInTheDocument();
        expect(within(table).getByText('Non-GST')).toBeInTheDocument();
    });

    it('links each row to the invoice detail page', async () => {
        renderPage();
        const link = await screen.findByRole('link', { name: 'INV-1' });
        expect(link).toHaveAttribute('href', '/invoices/i1');
    });

    it('re-queries with the type filter', async () => {
        renderPage();
        await screen.findByText('INV-1');
        fireEvent.change(screen.getByLabelText('Invoice type'), { target: { value: 'gst' } });
        await waitFor(() =>
            expect(invoicesApi.list).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'gst' })
            )
        );
    });

    it('shows the empty state', async () => {
        invoicesApi.list.mockResolvedValue({ invoices: [] });
        renderPage();
        expect(await screen.findByText(/no invoices yet/i)).toBeInTheDocument();
    });
});
