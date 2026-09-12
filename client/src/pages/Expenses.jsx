import { useEffect, useState } from 'react';
import { expensesApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatINR, rupeesToPaise } from '../utils/money';
import { formatDate } from '../utils/format';
import { Wallet } from 'lucide-react';

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
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Wallet size={24} className="text-primary" />
                </span>
                Expenses
            </h1>
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
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Wallet size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No expenses yet</p>
                        <p className="text-sm text-gray-500">Add your first expense above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Note</th>
                                <th>Payment</th>
                                <th className="text-right">Amount</th>
                                {isOwner && <th className="text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((e) => (
                                <tr key={e.id}>
                                    <td className="text-gray-500">{formatDate(e.date)}</td>
                                    <td className="font-medium">{e.category}</td>
                                    <td className="text-gray-500">{e.note || '—'}</td>
                                    <td>
                                        <span className="badge badge-neutral">{e.paymentMethod}</span>
                                    </td>
                                    <td className="text-right font-semibold text-red-600">
                                        {formatINR(e.amount)}
                                    </td>
                                    {isOwner && (
                                        <td className="text-right">
                                            <button
                                                onClick={() => handleDelete(e.id)}
                                                className="btn-danger px-3 py-1.5 text-xs"
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
