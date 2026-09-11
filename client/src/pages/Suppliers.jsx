import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { suppliersApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/money';

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
            <h1 className="text-2xl font-bold text-primary">Suppliers</h1>
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
                    <p className="text-sm text-gray-500">Loading suppliers…</p>
                ) : suppliers.length === 0 ? (
                    <p className="text-sm text-gray-500">No suppliers yet. Add your first supplier above.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-3">Name</th>
                                <th className="pb-3">Phone</th>
                                <th className="pb-3">Payable</th>
                                <th className="pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((s) => (
                                <tr key={s.id} className="border-t border-white/50">
                                    <td className="py-3 font-medium">{s.name}</td>
                                    <td className="py-3 text-gray-500">{s.phone || '—'}</td>
                                    <td className="py-3 font-semibold text-red-600">
                                        {formatINR(s.balance)}
                                    </td>
                                    <td className="py-3">
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/suppliers/${s.id}`}
                                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-white/70"
                                            >
                                                Statement
                                            </Link>
                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDelete(s.id)}
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
