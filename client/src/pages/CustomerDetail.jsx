import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { customersApi } from '../api/endpoints';
import { formatINR, rupeesToPaise } from '../utils/money';
import { formatDate } from '../utils/format';
import { Users, BookOpen } from 'lucide-react';

export default function CustomerDetail() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ amount: '', note: '' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const d = await customersApi.khata(id);
                if (!cancelled) setData(d);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load khata');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [id, reloadKey]);

    const setField = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await customersApi.recordPayment({
                customerId: id,
                amount: rupeesToPaise(form.amount),
                note: form.note,
            });
            setForm({ amount: '', note: '' });
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    // Running balance: credit (udhaar) increases what the customer owes,
    // payments reduce it.
    let running = 0;
    const rows = [];
    if (data) {
        for (const entry of data.entries) {
            running += entry.type === 'credit' ? entry.amount : -entry.amount;
            rows.push({ ...entry, running });
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <Users size={24} className="text-primary" />
                    </span>
                    {data ? data.customer.name : 'Khata'}
                </h1>
                <Link to="/customers" className="text-sm font-semibold text-primary hover:underline">
                    ← Back to customers
                </Link>
            </div>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            {loading ? (
                <div className="space-y-6">
                    <div className="skeleton h-24" />
                    <div className="skeleton h-40" />
                </div>
            ) : (
                data && (
                    <>
                        <div className="glass flex items-center justify-between p-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Khata balance (to receive)
                                </p>
                                <p className="mt-1 text-3xl font-bold text-primary">
                                    {formatINR(data.balance)}
                                </p>
                            </div>
                            <span className="rounded-2xl bg-white/60 p-3">
                                <BookOpen size={28} className="text-primary" />
                            </span>
                        </div>
                        <div className="glass p-6">
                            <h2 className="mb-4 text-lg font-semibold">Record payment</h2>
                            <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
                                <label className="block text-sm font-medium">
                                    Amount (₹)
                                    <input
                                        name="amount"
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        className="glass-input mt-1"
                                        value={form.amount}
                                        onChange={setField}
                                        required
                                    />
                                </label>
                                <label className="block text-sm font-medium">
                                    Note
                                    <input
                                        name="note"
                                        className="glass-input mt-1"
                                        value={form.note}
                                        onChange={setField}
                                    />
                                </label>
                                <button type="submit" disabled={submitting} className="btn-primary">
                                    Record payment
                                </button>
                            </form>
                        </div>
                        <div className="glass overflow-x-auto p-6">
                            <h2 className="mb-4 text-lg font-semibold">Statement</h2>
                            {rows.length === 0 ? (
                                <div className="empty-state">
                                    <span className="rounded-full bg-white/60 p-3">
                                        <BookOpen size={28} className="text-primary" />
                                    </span>
                                    <p className="font-semibold">No khata entries yet</p>
                                    <p className="text-sm text-gray-500">Credit sales and payments will appear here.</p>
                                </div>
                            ) : (
                                <table className="glass-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Note</th>
                                            <th className="text-right">Amount</th>
                                            <th className="text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((entry) => (
                                            <tr key={entry.id}>
                                                <td className="text-gray-500">
                                                    {formatDate(entry.date)}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`badge ${entry.type === 'credit' ? 'badge-danger' : 'badge-success'}`}
                                                    >
                                                        {entry.type === 'credit' ? 'Credit (udhaar)' : 'Payment'}
                                                    </span>
                                                </td>
                                                <td className="text-gray-500">{entry.note || '—'}</td>
                                                <td
                                                    className={`text-right font-semibold ${entry.type === 'credit' ? 'text-red-600' : 'text-green-600'
                                                        }`}
                                                >
                                                    {entry.type === 'credit'
                                                        ? `+${formatINR(entry.amount)}`
                                                        : `-${formatINR(entry.amount)}`}
                                                </td>
                                                <td className="text-right font-semibold">
                                                    {formatINR(entry.running)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )
            )}
        </div>
    );
}
