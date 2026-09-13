import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoicesApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import { formatDate } from '../utils/format';
import { FileText } from 'lucide-react';

export default function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [q, setQ] = useState('');
    const [type, setType] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');

    // Debounce the free-text search so we don't query on every keystroke.
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedQ(q.trim()), 300);
        return () => clearTimeout(handle);
    }, [q]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const params = {};
            if (debouncedQ) params.q = debouncedQ;
            if (type) params.type = type;
            if (from) params.from = new Date(from).toISOString();
            if (to) params.to = new Date(to).toISOString();
            try {
                const data = await invoicesApi.list(params);
                if (!cancelled) {
                    setInvoices(data.invoices);
                    setError('');
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load invoices');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [debouncedQ, type, from, to]);

    return (
        <div className="space-y-6">
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <FileText size={24} className="text-primary" />
                </span>
                Invoices
            </h1>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="glass flex flex-wrap items-end gap-4 p-6">
                <label className="block min-w-48 flex-1 text-sm font-medium">
                    Search
                    <input
                        className="glass-input mt-1"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Invoice number or buyer"
                    />
                </label>
                <label className="block w-40 text-sm font-medium">
                    Invoice type
                    <select
                        className="glass-input mt-1"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="gst">GST</option>
                        <option value="non-gst">Non-GST</option>
                    </select>
                </label>
                <label className="block w-40 text-sm font-medium">
                    From
                    <input
                        type="date"
                        className="glass-input mt-1"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                </label>
                <label className="block w-40 text-sm font-medium">
                    To
                    <input
                        type="date"
                        className="glass-input mt-1"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                    />
                </label>
            </div>
            <div className="glass overflow-x-auto p-6">
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <FileText size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No invoices yet</p>
                        <p className="text-sm text-gray-500">Invoices appear here as you record sales.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th>Buyer</th>
                                <th>Type</th>
                                <th className="text-right">Total</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((inv) => (
                                <tr key={inv.id}>
                                    <td className="font-medium">
                                        <Link
                                            to={`/invoices/${inv.id}`}
                                            className="text-primary hover:underline"
                                        >
                                            {inv.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="text-gray-500">{formatDate(inv.date)}</td>
                                    <td className="text-gray-500">{inv.buyerName || '—'}</td>
                                    <td>
                                        <span
                                            className={`badge ${inv.isGst ? 'badge-success' : 'badge-neutral'}`}
                                        >
                                            {inv.isGst ? 'GST' : 'Non-GST'}
                                        </span>
                                    </td>
                                    <td className="text-right font-semibold">
                                        {formatINR(inv.total)}
                                    </td>
                                    <td>
                                        <span
                                            className={`badge ${inv.status === 'cancelled' ? 'badge-danger' : 'badge-success'}`}
                                        >
                                            {inv.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
