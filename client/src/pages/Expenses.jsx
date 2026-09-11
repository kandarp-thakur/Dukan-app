import { useEffect, useState } from 'react';
import { expensesApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatINR, rupeesToPaise } from '../utils/money';
import { formatDate } from '../utils/format';

const CATEGORIES = ['rent', 'salary', 'stock', 'transport', 'electricity', 'other'];

const EMPTY_FORM = { category: 'rent', amount: '', paymentMethod: 'cash', note: '' };

export default function Expenses() {
    const { user } = useAuth();
    const isOwner = user?.role === 'owner';
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await expensesApi.list();
                if (!cancelled) setExpenses(data.expenses);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load expenses');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const setField = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await expensesApi.create({
                category: form.category,
                amount: rupeesToPaise(form.amount),
                paymentMethod: form.paymentMethod,
                note: form.note,
            });
            setForm(EMPTY_FORM);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this expense?')) return;
        try {
            await expensesApi.remove(id);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete expense');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-primary">Expenses</h1>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="glass p-6">
                <h2 className="mb-4 text-lg font-semibold">Add expense</h2>
                <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
                    <label className="block text-sm font-medium">
                        Category
                        <select
                            name="category"
                            className="glass-input mt-1"
                            value={form.category}
                            onChange={setField}
                        >
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </label>
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
                        Payment method
                        <select
                            name="paymentMethod"
                            className="glass-input mt-1"
                            value={form.paymentMethod}
                            onChange={setField}
                        >
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="card">Card</option>
                        </select>
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
                        Add expense
                    </button>
                </form>
            </div>
            <div className="glass overflow-x-auto p-6">
                {loading ? (
                    <p className="text-sm text-gray-500">Loading expenses…</p>
                ) : expenses.length === 0 ? (
                    <p className="text-sm text-gray-500">No expenses yet. Add your first expense above.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-3">Date</th>
                                <th className="pb-3">Category</th>
                                <th className="pb-3">Note</th>
                                <th className="pb-3">Payment</th>
                                <th className="pb-3 text-right">Amount</th>
                                {isOwner && <th className="pb-3 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((e) => (
                                <tr key={e.id} className="border-t border-white/50">
                                    <td className="py-3 text-gray-500">{formatDate(e.date)}</td>
                                    <td className="py-3 font-medium">{e.category}</td>
                                    <td className="py-3 text-gray-500">{e.note || '—'}</td>
                                    <td className="py-3">{e.paymentMethod}</td>
                                    <td className="py-3 text-right font-semibold text-red-600">
                                        {formatINR(e.amount)}
                                    </td>
                                    {isOwner && (
                                        <td className="py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(e.id)}
                                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
