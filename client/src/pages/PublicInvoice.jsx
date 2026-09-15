import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { publicApi } from '../api/endpoints';
import InvoiceDocument from '../components/InvoiceDocument';
import { buildInvoicePdf, downloadBlob } from '../utils/invoicePdf';

export default function PublicInvoice() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const d = await publicApi.getInvoice(token);
                if (!cancelled) setData(d);
            } catch {
                // Invalid, expired, revoked and unknown tokens are indistinguishable on purpose.
                if (!cancelled) setFailed(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const handleDownload = async () => {
        setError('');
        setBusy(true);
        try {
            const blob = await buildInvoicePdf(ref.current);
            downloadBlob(blob, `${data.invoice.invoiceNumber || 'invoice'}.pdf`);
        } catch {
            setError('Could not generate PDF');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-100 p-6">
            {loading && (
                <div className="glass mx-auto max-w-3xl p-10">
                    <div className="skeleton h-8 w-48" />
                    <div className="skeleton mt-6 h-40" />
                </div>
            )}

            {!loading && failed && (
                <div className="glass mx-auto max-w-md p-10 text-center">
                    <p className="text-lg font-semibold">This invoice link is no longer available</p>
                    <p className="mt-2 text-sm text-gray-500">
                        Ask the seller to send a fresh link.
                    </p>
                </div>
            )}

            {!loading && !failed && data && (
                <div className="mx-auto max-w-3xl space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={handleDownload}
                            disabled={busy}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Download size={16} /> Download PDF
                        </button>
                    </div>
                    {error && (
                        <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
                    )}
                    <div ref={ref}>
                        <InvoiceDocument
                            invoice={data.invoice}
                            business={data.business}
                            variant="screen"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
