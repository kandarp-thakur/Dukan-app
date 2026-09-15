import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvoiceDetail from './InvoiceDetail';
import { invoicesApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    invoicesApi: {
        list: vi.fn(),
        get: vi.fn(),
    },
    // Declared because the page reads the email feature flag on mount.
    configApi: {
        features: vi.fn().mockResolvedValue({ email: true }),
    },
}));

vi.mock('react-to-print', () => ({
    useReactToPrint: () => vi.fn(),
}));

const business = { name: 'Local Test Shop', address: 'Main Road, Pune', gstin: '27ABCDE1234F1Z5' };

const gstInvoice = {
    id: 'i1',
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
    paymentMethod: 'cash',
    status: 'completed',
};

const nonGstInvoice = {
    id: 'i2',
    invoiceNumber: 'INV-2',
    date: '2026-09-06T10:30:00.000Z',
    items: [{ name: 'Pen', qty: 2, rate: 500, amount: 1000 }],
    subtotal: 1000,
    discount: 0,
    tax: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 1000,
    isGst: false,
    buyerName: 'Suresh',
    buyerGstin: '',
    buyerAddress: '',
    placeOfSupply: '',
    paymentMethod: 'cash',
    status: 'completed',
};

const renderDetail = () =>
    render(
        <MemoryRouter initialEntries={['/invoices/i1']}>
            <Routes>
                <Route path="/invoices/:id" element={<InvoiceDetail />} />
            </Routes>
        </MemoryRouter>
    );

// In a GST render the HSN and the CGST/SGST labels each appear twice: once in
// the items table and once in the tax-breakup table (CGST/SGST also appear as
// totals labels). Scope these queries to the tax-breakup section so the
// assertions target the breakup unambiguously instead of throwing on multiple
// matches.
const taxBreakup = () => within(screen.getByText('Tax breakup').closest('div'));

describe('InvoiceDetail page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a GST invoice with buyer block, HSN breakup and tax lines', async () => {
        invoicesApi.get.mockResolvedValue({ invoice: gstInvoice, business });
        renderDetail();
        expect(await screen.findByText('INV-9')).toBeInTheDocument();
        expect(screen.getByText(/27XYZAB5678C1Z9/)).toBeInTheDocument();
        expect(screen.getByText(/place of supply/i)).toBeInTheDocument();
        expect(taxBreakup().getByText('1006')).toBeInTheDocument();
        expect(taxBreakup().getByText('CGST')).toBeInTheDocument();
        expect(taxBreakup().getByText('SGST')).toBeInTheDocument();
        expect(
            screen.getByText(/one hundred twenty nine rupees and eighty paise only/i)
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /print invoice/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    });

    it('renders a non-GST invoice without GST lines', async () => {
        invoicesApi.get.mockResolvedValue({ invoice: nonGstInvoice, business });
        renderDetail();
        expect(await screen.findByText('INV-2')).toBeInTheDocument();
        expect(screen.queryByText('CGST')).toBeNull();
        expect(screen.getByText(/ten rupees only/i)).toBeInTheDocument();
    });

    it('falls back to clipboard copy when Web Share is unavailable', async () => {
        invoicesApi.get.mockResolvedValue({ invoice: nonGstInvoice, business });
        // jsdom may expose navigator.clipboard as a non-writable accessor, so a
        // plain assignment can silently no-op; define it explicitly instead.
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            configurable: true,
            writable: true,
        });
        delete navigator.share;
        renderDetail();
        await screen.findByText('INV-2');
        fireEvent.click(screen.getByRole('button', { name: /share/i }));
        await waitFor(() =>
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                expect.stringContaining('INV-2')
            )
        );
        expect(await screen.findByText(/link copied/i)).toBeInTheDocument();
    });
});
