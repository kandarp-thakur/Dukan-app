import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { salesApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatINR, amountToWords } from '../utils/money';
import { formatDate } from '../utils/format';
import { Receipt } from 'lucide-react';

export default function SaleDetail() {
    const { id } = useParams();
    const { business } = useAuth();
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const printRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await salesApi.get(id);
                if (!cancelled) setSale(data.sale);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load sale');
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
        documentTitle: sale ? `${sale.invoiceNumber} - ${business?.name || 'Invoice'}` : 'Invoice',
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between print:hidden">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <Receipt size={24} className="text-primary" />
                    </span>
                    Invoice
                </h1>
                <div className="flex items-center gap-4">
                    <Link to="/sales" className="text-sm font-semibold text-primary hover:underline">
                        ← Back to sales
                    </Link>
                    {sale && (
                        <button onClick={handlePrint} className="btn-primary">
                            Print invoice
                        </button>
                    )}
                </div>
            </div>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            {loading ? (
                <div className="glass mx-auto max-w-3xl p-10">
                    <div className="skeleton h-8 w-48" />
                    <div className="skeleton mt-6 h-40" />
                </div>
            ) : (
                sale && (
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
                                    <p className="mt-1 text-sm text-gray-500">
                                        GSTIN: {business.gstin}
                                    </p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-wide text-gray-400">
                                    Invoice
                                </p>
                                <p className="text-xl font-bold text-gray-900">
                                    {sale.invoiceNumber}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {formatDate(sale.date)}
                                </p>
                            </div>
                        </div>
                        {sale.status === 'cancelled' && (
                            <div className="mt-6 rounded-xl border-2 border-red-300 px-4 py-2 text-center text-sm font-bold uppercase tracking-widest text-red-600">
                                Cancelled
                            </div>
                        )}
                        <table className="mt-6 w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                                    <th className="pb-2">#</th>
                                    <th className="pb-2">Item</th>
                                    <th className="pb-2 text-right">Qty</th>
                                    <th className="pb-2 text-right">Rate</th>
                                    <th className="pb-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.items.map((it, i) => (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-2 text-gray-400">{i + 1}</td>
                                        <td className="py-2 font-medium text-gray-800">{it.name}</td>
                                        <td className="py-2 text-right">{it.qty}</td>
                                        <td className="py-2 text-right">{formatINR(it.rate)}</td>
                                        <td className="py-2 text-right">{formatINR(it.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-4 flex justify-end">
                            <div className="w-64 space-y-1 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal</span>
                                    <span>{formatINR(sale.subtotal)}</span>
                                </div>
                                {sale.discount > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Discount</span>
                                        <span>-{formatINR(sale.discount)}</span>
                                    </div>
                                )}
                                {sale.tax > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Tax</span>
                                        <span>+{formatINR(sale.tax)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                                    <span>Total</span>
                                    <span>{formatINR(sale.total)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Payment</span>
                                    <span className="uppercase">{sale.paymentMethod}</span>
                                </div>
                            </div>
                        </div>
                        <p className="mt-6 text-xs italic text-gray-500">
                            Amount in words: {amountToWords(sale.total)}
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
