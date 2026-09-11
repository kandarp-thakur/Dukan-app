import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customersApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/money';

export default function Customers() {
    const { user } = useAuth();
    const isOwner = user?.role === 'owner';
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', phone: '' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await customersApi.list();
                if (!cancelled) setCustomers(data.customers);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load customers');
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
            await customersApi.create({ name: form.name, phone: form.phone });
            setForm({ name: '', phone: '' });
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this customer and their khata history?')) return;
        try {
            await customersApi.remove(id);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete customer');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-primary">Customers</h1>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="glass p-6">
                <h2 className="mb-4 text-lg font-semibold">Add customer</h2>
                <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
                    <label className="block text-sm font-medium">
                        Name
                        <input
                            name="name"
                            className="glass-input mt-1"
                            value={form.name}
                            onChange={setField}
                            required
                        />
                    </label>
                    <label className="block text-sm font-medium">
                        Phone
                        <input
                            name="phone"
                            className="glass-input mt-1"
                            value={form.phone}
                            onChange={setField}
                        />
                    </label>
                    <button type="submit" disabled={submitting} className="btn-primary">
                        Add customer
                    </button>
                </form>
            </div>
            <div className="glass overflow-x-auto p-6">
                {loading ? (
                    <p className="text-sm text-gray-500">Loading customers…</p>
                ) : customers.length === 0 ? (
                    <p className="text-sm text-gray-500">No customers yet. Add your first customer above.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-3">Name</th>
                                <th className="pb-3">Phone</th>
                                <th className="pb-3">Balance (to receive)</th>
                                <th className="pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((c) => (
                                <tr key={c.id} className="border-t border-white/50">
                                    <td className="py-3 font-medium">{c.name}</td>
                                    <td className="py-3 text-gray-500">{c.phone || '—'}</td>
                                    <td
                                        className={`py-3 font-semibold ${c.balance > 0 ? 'text-red-600' : 'text-green-600'
                                            }`}
                                    >
                                        {formatINR(c.balance)}
                                    </td>
                                    <td className="py-3">
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/customers/${c.id}`}
                                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-white/70"
                                            >
                                                Khata
                                            </Link>
                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
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
