import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customersApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/money';
import { Users } from 'lucide-react';

export default function Customers() {
    const { user } = useAuth();
    const isOwner = user?.role === 'owner';
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', phone: '', gstin: '', address: '' });
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
        if (form.gstin && form.gstin.length !== 15) {
            setError('GSTIN must be 15 characters');
            return;
        }
        setSubmitting(true);
        try {
            await customersApi.create({
                name: form.name,
                phone: form.phone,
                gstin: form.gstin,
                address: form.address,
            });
            setForm({ name: '', phone: '', gstin: '', address: '' });
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
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Users size={24} className="text-primary" />
                </span>
                Customers
            </h1>
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
                    <label className="block text-sm font-medium">
                        GSTIN
                        <input
                            name="gstin"
                            className="glass-input mt-1"
                            value={form.gstin}
                            onChange={setField}
                        />
                    </label>
                    <label className="block text-sm font-medium">
                        Address
                        <input
                            name="address"
                            className="glass-input mt-1"
                            value={form.address}
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
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : customers.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Users size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No customers yet</p>
                        <p className="text-sm text-gray-500">Add your first customer above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Balance (to receive)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((c) => (
                                <tr key={c.id}>
                                    <td className="font-medium">{c.name}</td>
                                    <td className="text-gray-500">{c.phone || '—'}</td>
                                    <td
                                        className={`font-semibold ${c.balance > 0 ? 'text-red-600' : 'text-green-600'
                                            }`}
                                    >
                                        {formatINR(c.balance)}
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/customers/${c.id}`}
                                                className="btn-ghost px-3 py-1.5 text-xs"
                                            >
                                                Khata
                                            </Link>
                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="btn-danger px-3 py-1.5 text-xs"
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
