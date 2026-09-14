import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { invoicesApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import { FileText } from 'lucide-react';
import InvoiceDocument from '../components/InvoiceDocument';

export default function InvoiceDetail() {
    const { id } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [business, setBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const printRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await invoicesApi.get(id);
                if (!cancelled) {
                    setInvoice(data.invoice);
                    setBusiness(data.business);
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load invoice');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: invoice ? `${invoice.invoiceNumber} - ${business?.name || 'Invoice'}` : 'Invoice',
    });

    const handleShare = async () => {
        if (!invoice) return;
        const summary = `${invoice.invoiceNumber} · ${formatINR(invoice.total)}`;
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: invoice.invoiceNumber, text: summary, url });
                return;
            }
            await navigator.clipboard.writeText(`${summary} ${url}`);
            setNotice('Link copied');
        } catch {
            setNotice('Could not share');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between print:hidden">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <FileText size={24} className="text-primary" />
                    </span>
                    Invoice
                </h1>
                <div className="flex items-center gap-4">
                    <Link to="/invoices" className="text-sm font-semibold text-primary hover:underline">
                        ← Back to invoices
                    </Link>
                    {invoice && (
                        <>
                            <button onClick={handleShare} className="btn-ghost">
                                Share
                            </button>
                            <button onClick={handlePrint} className="btn-primary">
                                Print invoice
                            </button>
                        </>
                    )}
                </div>
            </div>
            {notice && (
                <div className="glass px-4 py-3 text-sm font-medium text-primary print:hidden">
                    {notice}
                </div>
            )}
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            {loading ? (
                <div className="glass mx-auto max-w-3xl p-10">
                    <div className="skeleton h-8 w-48" />
                    <div className="skeleton mt-6 h-40" />
                </div>
            ) : (
                invoice && (
                    <div ref={printRef}>
                        <InvoiceDocument invoice={invoice} business={business} variant="screen" />
                    </div>
                )
            )}
        </div>
    );
}
