import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SendInvoiceDialog from './SendInvoiceDialog';
import { invoicesApi } from '../api/endpoints';
import { buildInvoicePdf, downloadBlob } from '../utils/invoicePdf';

vi.mock('../api/endpoints', () => ({
    invoicesApi: {
        sendEmail: vi.fn(),
        share: vi.fn(),
        revokeShare: vi.fn(),
    },
}));

vi.mock('../utils/invoicePdf', async () => {
    const actual = await vi.importActual('../utils/invoicePdf');
    return {
        ...actual,
        buildInvoicePdf: vi.fn(),
        downloadBlob: vi.fn(),
    };
});

const invoice = {
    id: 'i1',
    invoiceNumber: 'INV-9',
    total: 12980,
    paymentMethod: 'cash',
    status: 'completed',
};
const business = { name: 'Local Test Shop' };

const renderDialog = (props = {}) => {
    const onClose = vi.fn();
    const element = document.createElement('div');
    render(
        <SendInvoiceDialog
            invoice={invoice}
            business={business}
            defaultEmail="buyer@example.com"
            defaultPhone="9876543210"
            emailEnabled
            getElement={() => element}
            onClose={onClose}
            {...props}
        />
    );
    return { onClose, element };
};

describe('SendInvoiceDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildInvoicePdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
        invoicesApi.share.mockResolvedValue({
            shareToken: 'tok',
            shareUrl: 'https://x.test/i/tok',
            expiresAt: '2026-10-14T00:00:00.000Z',
        });
        invoicesApi.sendEmail.mockResolvedValue(null);
        vi.stubGlobal('open', vi.fn());
    });

    it('downloads the PDF under the invoice number', async () => {
        const { element } = renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

        await waitFor(() => expect(buildInvoicePdf).toHaveBeenCalledWith(element));
        await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
        expect(downloadBlob.mock.calls[0][1]).toBe('INV-9.pdf');
    });

    it('shows an error and does not download when PDF generation fails', async () => {
        buildInvoicePdf.mockRejectedValue(new Error('boom'));
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

        expect(await screen.findByText(/could not generate pdf/i)).toBeInTheDocument();
        expect(downloadBlob).not.toHaveBeenCalled();
    });

    it('posts the PDF and recipient when emailing', async () => {
        renderDialog();
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'other@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: /email invoice/i }));

        await waitFor(() => expect(invoicesApi.sendEmail).toHaveBeenCalledTimes(1));
        const [id, formData] = invoicesApi.sendEmail.mock.calls[0];
        expect(id).toBe('i1');
        expect(formData.get('to')).toBe('other@example.com');
        expect(formData.get('pdf')).toBeInstanceOf(Blob);
        expect(await screen.findByText(/invoice emailed/i)).toBeInTheDocument();
    });

    it('refuses to email a file over 5 MB', async () => {
        buildInvoicePdf.mockResolvedValue({ size: 5 * 1024 * 1024 + 1, type: 'application/pdf' });
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /email invoice/i }));

        expect(await screen.findByText(/exceeds 5 mb/i)).toBeInTheDocument();
        expect(invoicesApi.sendEmail).not.toHaveBeenCalled();
    });

    it('surfaces a server send failure', async () => {
        invoicesApi.sendEmail.mockRejectedValue({
            response: { data: { message: 'Email is not configured' } },
        });
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /email invoice/i }));

        expect(await screen.findByText(/email is not configured/i)).toBeInTheDocument();
    });

    it('disables the email button when the feature is off', () => {
        renderDialog({ emailEnabled: false });
        expect(screen.getByRole('button', { name: /email invoice/i })).toBeDisabled();
        expect(screen.getByText(/email is not configured/i)).toBeInTheDocument();
    });

    it('creates a share link then opens WhatsApp with the link', async () => {
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

        await waitFor(() => expect(invoicesApi.share).toHaveBeenCalledWith('i1'));
        await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
        const [url, target] = window.open.mock.calls[0];
        expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
        expect(decodeURIComponent(url)).toContain('https://x.test/i/tok');
        expect(target).toBe('noopener');
    });

    it('does not open WhatsApp when the share call fails', async () => {
        invoicesApi.share.mockRejectedValue({ response: { data: { message: 'nope' } } });
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

        expect(await screen.findByText(/could not create the invoice link/i)).toBeInTheDocument();
        expect(window.open).not.toHaveBeenCalled();
    });

    it('blocks WhatsApp when there is no phone number', async () => {
        renderDialog({ defaultPhone: '' });
        fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

        expect(await screen.findByText(/phone number is required/i)).toBeInTheDocument();
        expect(invoicesApi.share).not.toHaveBeenCalled();
    });
});
