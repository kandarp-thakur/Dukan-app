import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { salesApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import { formatDate } from '../utils/format';
import { Receipt } from 'lucide-react';

export default function SaleDetail() {
    const { id } = useParams();
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <Receipt size={24} className="text-primary" />
                    </span>
                    Sale {sale ? sale.invoiceNumber : ''}
                </h1>
                <div className="flex items-center gap-4">
                    <Link to="/sales" className="text-sm font-semibold text-primary hover:underline">
                        ← Back to sales
                    </Link>
                    {sale && (
                        <Link to={`/invoices/${sale.id}`} className="btn-primary">
                            View invoice
                        </Link>
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
                    <div className="glass mx-auto max-w-3xl p-8">
                        <div className="flex items-start justify-between border-b border-white/50 pb-4">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-400">
                                    Invoice
                                </p>
                                <p className="text-xl font-bold text-gray-900">
                                    {sale.invoiceNumber}
                                </p>
                                <p className="text-sm text-gray-500">{formatDate(sale.date)}</p>
                            </div>
                            <div className="text-right">
                                <span
                                    className={`badge ${sale.isGst ? 'badge-success' : 'badge-neutral'}`}
                                >
                                    {sale.isGst ? 'GST' : 'Non-GST'}
                                </span>
                                <span
                                    className={`ml-2 badge ${sale.status === 'cancelled' ? 'badge-danger' : 'badge-success'}`}
                                >
                                    {sale.status}
                                </span>
                            </div>
                        </div>
                        <table className="mt-4 w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/50 text-left text-xs uppercase tracking-wide text-gray-500">
                                    <th className="pb-2">Item</th>
                                    <th className="pb-2 text-right">Qty</th>
                                    <th className="pb-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.items.map((it, i) => (
                                    <tr key={i} className="border-b border-white/30">
                                        <td className="py-2 font-medium text-gray-800">{it.name}</td>
                                        <td className="py-2 text-right">{it.qty}</td>
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
                                <div className="flex justify-between border-t border-white/50 pt-2 text-base font-bold text-gray-900">
                                    <span>Total</span>
                                    <span>{formatINR(sale.total)}</span>
                                </div>
                            </div>
                        </div>
                        <p className="mt-6 text-sm text-gray-500">
                            Open the invoice view to print or share this document.
                        </p>
                    </div>
                )
            )}
        </div>
    );
}
