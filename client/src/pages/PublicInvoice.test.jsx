import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublicInvoice from './PublicInvoice';
import { publicApi } from '../api/endpoints';
import { buildInvoicePdf, downloadBlob } from '../utils/invoicePdf';

vi.mock('../api/endpoints', () => ({
    publicApi: { getInvoice: vi.fn() },
}));

vi.mock('../utils/invoicePdf', async () => {
    const actual = await vi.importActual('../utils/invoicePdf');
    return { ...actual, buildInvoicePdf: vi.fn(), downloadBlob: vi.fn() };
});

const invoice = {
    invoiceNumber: 'INV-9',
    date: '2026-09-05T10:30:00.000Z',
    items: [{ name: 'Rice 1kg', qty: 2, rate: 5500, amount: 11000, gstRate: 18, hsn: '1006' }],
    subtotal: 11000,
    discount: 0,
    tax: 1980,
    cgst: 990,
    sgst: 990,
    igst: 0,
    total: 12980,
    isGst: true,
    buyerName: 'Ramesh',
    buyerGstin: '27XYZAB5678C1Z9',
    buyerAddress: 'MG Road, Pune',
    placeOfSupply: 'MH',
    status: 'completed',
};
const business = { name: 'Local Test Shop', address: 'Main Road, Pune', gstin: '27ABCDE1234F1Z5' };

const renderPage = (token = 'tok') =>
    render(
        <MemoryRouter initialEntries={[`/i/${token}`]}>
            <Routes>
                <Route path="/i/:token" element={<PublicInvoice />} />
            </Routes>
        </MemoryRouter>
    );

describe('PublicInvoice page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildInvoicePdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    });

    it('renders the invoice without any authentication', async () => {
        publicApi.getInvoice.mockResolvedValue({ invoice, business });
        renderPage();

        expect(await screen.findByText('INV-9')).toBeInTheDocument();
        expect(screen.getByText('Local Test Shop')).toBeInTheDocument();
        expect(screen.getByText(/27XYZAB5678C1Z9/)).toBeInTheDocument();
        expect(publicApi.getInvoice).toHaveBeenCalledWith('tok');
    });

    it('offers a download button that saves the PDF', async () => {
        publicApi.getInvoice.mockResolvedValue({ invoice, business });
        renderPage();
        await screen.findByText('INV-9');

        fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

        await waitFor(() => expect(buildInvoicePdf).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
        expect(downloadBlob.mock.calls[0][1]).toBe('INV-9.pdf');
    });

    it('shows one identical unavailable state for a 404', async () => {
        publicApi.getInvoice.mockRejectedValue({ response: { status: 404 } });
        renderPage('gone');

        expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /download pdf/i })).toBeNull();
    });

    it('shows the same unavailable state for a network failure', async () => {
        publicApi.getInvoice.mockRejectedValue(new Error('offline'));
        renderPage('gone');

        expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
    });

    it('renders a cancelled invoice with the cancelled banner', async () => {
        publicApi.getInvoice.mockResolvedValue({
            invoice: { ...invoice, status: 'cancelled' },
            business,
        });
        renderPage();
        await screen.findByText('INV-9');

        expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    });
});
