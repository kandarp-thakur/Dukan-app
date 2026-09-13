import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { suppliersApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/money';
import { Truck } from 'lucide-react';

export default function Suppliers() {
    const { user } = useAuth();
    const isOwner = user?.role === 'owner';
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', phone: '' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await suppliersApi.list();
                if (!cancelled) setSuppliers(data.suppliers);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load suppliers');
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
            await suppliersApi.create({ name: form.name, phone: form.phone });
            setForm({ name: '', phone: '' });
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this supplier?')) return;
        try {
            await suppliersApi.remove(id);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete supplier');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Truck size={24} className="text-primary" />
                </span>
                Suppliers
            </h1>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="glass p-6">
                <h2 className="mb-4 text-lg font-semibold">Add supplier</h2>
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
                        Add supplier
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
                ) : suppliers.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Truck size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No suppliers yet</p>
                        <p className="text-sm text-gray-500">Add your first supplier above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Payable</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((s) => (
                                <tr key={s.id}>
                                    <td className="font-medium">{s.name}</td>
                                    <td className="text-gray-500">{s.phone || '—'}</td>
                                    <td className="font-semibold text-red-600">
                                        {formatINR(s.balance)}
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/suppliers/${s.id}`}
                                                className="btn-ghost px-3 py-1.5 text-xs"
                                            >
                                                Statement
                                            </Link>
                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDelete(s.id)}
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
