import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { invoicesApi } from '../api/endpoints';
import { formatINR, amountToWords } from '../utils/money';
import { formatDate } from '../utils/format';
import { lineBreakup } from '../utils/gst';
import { FileText } from 'lucide-react';

// Groups invoice lines by HSN + rate for the GST breakup table.
const buildBreakup = (invoice) => {
    const lines = lineBreakup(invoice.items, invoice.discount);
    const groups = new Map();
    invoice.items.forEach((it, i) => {
        const key = `${it.hsn || ''}|${it.gstRate || 0}`;
        const group = groups.get(key) || {
            hsn: it.hsn || '',
            gstRate: it.gstRate || 0,
            taxableValue: 0,
            tax: 0,
        };
        group.taxableValue += lines[i].taxableValue;
        group.tax += lines[i].tax;
        groups.set(key, group);
    });
    return [...groups.values()];
};

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

    const breakup = invoice && invoice.isGst ? buildBreakup(invoice) : [];
    const interState = invoice && invoice.isGst ? invoice.igst > 0 : false;

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
                    <div ref={printRef} className="glass mx-auto max-w-3xl bg-white p-10 print:p-0">
                        <div className="flex items-start justify-between border-b border-gray-200 pb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {business?.name || 'My Business'}
                                </h2>
                                {business?.address && (
                                    <p className="mt-1 text-sm text-gray-500">{business.address}</p>
                                )}
                                {business?.gstin && (
                                    <p className="mt-1 text-sm text-gray-500">GSTIN: {business.gstin}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-wide text-gray-400">Invoice</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {invoice.invoiceNumber}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">{formatDate(invoice.date)}</p>
                            </div>
                        </div>

                        {invoice.isGst && (
                            <div className="mt-6 flex items-start justify-between gap-6">
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-gray-400">Billed to</p>
                                    <p className="font-semibold text-gray-800">
                                        {invoice.buyerName || 'Walk-in customer'}
                                    </p>
                                    {invoice.buyerAddress && (
                                        <p className="text-sm text-gray-500">{invoice.buyerAddress}</p>
                                    )}
                                    {invoice.buyerGstin && (
                                        <p className="text-sm text-gray-500">
                                            GSTIN: {invoice.buyerGstin}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-xs uppercase tracking-wide text-gray-400">
                                        Place of Supply
                                    </p>
                                    <p className="font-semibold text-gray-800">
                                        {invoice.placeOfSupply || '—'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {invoice.status === 'cancelled' && (
                            <div className="mt-6 rounded-xl border-2 border-red-300 px-4 py-2 text-center text-sm font-bold uppercase tracking-widest text-red-600">
                                Cancelled
                            </div>
                        )}

                        <table className="mt-6 w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                                    <th className="pb-2">#</th>
                                    <th className="pb-2">Item</th>
                                    {invoice.isGst && <th className="pb-2">HSN</th>}
                                    <th className="pb-2 text-right">Qty</th>
                                    <th className="pb-2 text-right">Rate</th>
                                    {invoice.isGst && <th className="pb-2 text-right">GST</th>}
                                    <th className="pb-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((it, i) => (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-2 text-gray-400">{i + 1}</td>
                                        <td className="py-2 font-medium text-gray-800">{it.name}</td>
                                        {invoice.isGst && (
                                            <td className="py-2 text-gray-500">{it.hsn || '—'}</td>
                                        )}
                                        <td className="py-2 text-right">{it.qty}</td>
                                        <td className="py-2 text-right">{formatINR(it.rate)}</td>
                                        {invoice.isGst && (
                                            <td className="py-2 text-right">{it.gstRate || 0}%</td>
                                        )}
                                        <td className="py-2 text-right">{formatINR(it.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {invoice.isGst && breakup.length > 0 && (
                            <div className="mt-6">
                                <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
                                    Tax breakup
                                </p>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                                            <th className="pb-2">HSN</th>
                                            <th className="pb-2 text-right">Taxable value</th>
                                            <th className="pb-2 text-right">Rate</th>
                                            <th className="pb-2 text-right">
                                                {interState ? 'IGST' : 'CGST'}
                                            </th>
                                            {!interState && <th className="pb-2 text-right">SGST</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {breakup.map((g, i) => {
                                            const half = Math.ceil(g.tax / 2);
                                            return (
                                                <tr key={i} className="border-b border-gray-100">
                                                    <td className="py-2">{g.hsn || '—'}</td>
                                                    <td className="py-2 text-right">
                                                        {formatINR(g.taxableValue)}
                                                    </td>
                                                    <td className="py-2 text-right">{g.gstRate}%</td>
                                                    {interState ? (
                                                        <td className="py-2 text-right">
                                                            {formatINR(g.tax)}
                                                        </td>
                                                    ) : (
                                                        <>
                                                            <td className="py-2 text-right">
                                                                {formatINR(half)}
                                                            </td>
                                                            <td className="py-2 text-right">
                                                                {formatINR(g.tax - half)}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="mt-4 flex justify-end">
                            <div className="w-64 space-y-1 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal</span>
                                    <span>{formatINR(invoice.subtotal)}</span>
                                </div>
                                {invoice.discount > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Discount</span>
                                        <span>-{formatINR(invoice.discount)}</span>
                                    </div>
                                )}
                                {invoice.isGst && interState && invoice.igst > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>IGST</span>
                                        <span>+{formatINR(invoice.igst)}</span>
                                    </div>
                                )}
                                {invoice.isGst && !interState && invoice.cgst > 0 && (
                                    <>
                                        <div className="flex justify-between text-gray-600">
                                            <span>CGST</span>
                                            <span>+{formatINR(invoice.cgst)}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-600">
                                            <span>SGST</span>
                                            <span>+{formatINR(invoice.sgst)}</span>
                                        </div>
                                    </>
                                )}
                                {!invoice.isGst && invoice.tax > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Tax</span>
                                        <span>+{formatINR(invoice.tax)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                                    <span>Total</span>
                                    <span>{formatINR(invoice.total)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Payment</span>
                                    <span className="uppercase">{invoice.paymentMethod}</span>
                                </div>
                            </div>
                        </div>
                        <p className="mt-6 text-xs italic text-gray-500">
                            Amount in words: {amountToWords(invoice.total)}
                        </p>
                        <div className="mt-8 flex items-end justify-between border-t border-dashed border-gray-200 pt-4 text-xs text-gray-400">
                            <span>Thank you for your business!</span>
                            <span>Scan UPI QR to pay (coming soon)</span>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
