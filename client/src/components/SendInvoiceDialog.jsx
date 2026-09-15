import { useState } from 'react';
import { Download, Mail, MessageCircle, X } from 'lucide-react';
import { invoicesApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import { buildInvoicePdf, downloadBlob, MAX_PDF_BYTES } from '../utils/invoicePdf';
import { whatsappUrl } from '../utils/whatsapp';

export default function SendInvoiceDialog({
    invoice,
    business,
    defaultEmail = '',
    defaultPhone = '',
    emailEnabled = true,
    getElement,
    onClose,
}) {
    const [email, setEmail] = useState(defaultEmail);
    const [phone, setPhone] = useState(defaultPhone);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const fileName = `${invoice.invoiceNumber || 'invoice'}.pdf`;

    const withPdf = async (run) => {
        try {
            const blob = await buildInvoicePdf(getElement());
            return await run(blob);
        } catch (err) {
            if (err && err.status) throw err;
            setError('Could not generate PDF');
            return null;
        }
    };

    const handleDownload = async () => {
        setError('');
        setNotice('');
        setBusy('download');
        try {
            await withPdf(async (blob) => {
                downloadBlob(blob, fileName);
                setNotice('PDF downloaded');
            });
        } finally {
            setBusy('');
        }
    };

    const handleEmail = async () => {
        setError('');
        setNotice('');
        if (!email.trim()) {
            setError('A valid recipient email is required');
            return;
        }
        setBusy('email');
        try {
            await withPdf(async (blob) => {
                if (blob.size > MAX_PDF_BYTES) {
                    setError('Attachment exceeds 5 MB');
                    return;
                }
                const formData = new FormData();
                formData.append('pdf', blob, fileName);
                formData.append('to', email.trim());
                try {
                    await invoicesApi.sendEmail(invoice.id, formData);
                    setNotice('Invoice emailed');
                } catch (err) {
                    setError(err.response?.data?.message || 'Could not send email');
                }
            });
        } finally {
            setBusy('');
        }
    };

    const handleWhatsApp = async () => {
        setError('');
        setNotice('');
        if (!phone.replace(/\D/g, '')) {
            setError('A phone number is required');
            return;
        }
        setBusy('whatsapp');
        try {
            let data;
            try {
                data = await invoicesApi.share(invoice.id);
            } catch {
                setError('Could not create the invoice link');
                return;
            }
            const text = [
                `${business?.name || 'Invoice'} · ${invoice.invoiceNumber}`,
                formatINR(invoice.total),
                data.shareUrl,
            ].join('\n');
            // Only ever called with a link in hand, never link-less.
            window.open(whatsappUrl(phone, text), 'noopener');
            setNotice('WhatsApp opened');
        } finally {
            setBusy('');
        }
    };

    return (
        <div className="glass p-6">
            <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold">Send invoice</h2>
                <button onClick={onClose} className="btn-ghost px-2 py-1" aria-label="Close">
                    <X size={16} />
                </button>
            </div>

            {error && (
                <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    {error}
                </div>
            )}
            {notice && (
                <div className="mt-4 rounded-xl bg-white/60 px-4 py-3 text-sm font-medium text-primary">
                    {notice}
                </div>
            )}

            <div className="mt-4 grid gap-4">
                <label className="block text-sm font-medium">
                    Email
                    <input
                        type="email"
                        className="glass-input mt-1"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </label>
                <label className="block text-sm font-medium">
                    WhatsApp number
                    <input
                        type="tel"
                        className="glass-input mt-1"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </label>
            </div>

            {!emailEnabled && (
                <p className="mt-4 text-sm text-gray-500">
                    Email is not configured on this server. Add SMTP settings to enable it.
                </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
                <button
                    onClick={handleDownload}
                    disabled={busy !== ''}
                    className="btn-ghost flex items-center gap-2"
                >
                    <Download size={16} /> Download PDF
                </button>
                <button
                    onClick={handleEmail}
                    disabled={busy !== '' || !emailEnabled}
                    className="btn-primary flex items-center gap-2"
                >
                    <Mail size={16} /> Email invoice
                </button>
                <button
                    onClick={handleWhatsApp}
                    disabled={busy !== ''}
                    className="btn-primary flex items-center gap-2"
                >
                    <MessageCircle size={16} /> WhatsApp
                </button>
            </div>
        </div>
    );
}
