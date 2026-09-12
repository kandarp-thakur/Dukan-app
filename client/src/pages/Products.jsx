import { useEffect, useState } from 'react';
import { productsApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatINR, paiseToRupees, rupeesToPaise } from '../utils/money';
import { Package } from 'lucide-react';

const EMPTY_FORM = {
    name: '',
    sku: '',
    purchasePrice: '',
    sellingPrice: '',
    stockQty: '',
    lowStockThreshold: '5',
};

export default function Products() {
    const { user } = useAuth();
    const isOwner = user?.role === 'owner';
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await productsApi.list();
                if (!cancelled) setProducts(data.products);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load products');
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

    const startEdit = (p) => {
        setEditingId(p.id);
        setError('');
        setForm({
            name: p.name,
            sku: p.sku || '',
            purchasePrice: String(paiseToRupees(p.purchasePrice)),
            sellingPrice: String(paiseToRupees(p.sellingPrice)),
            stockQty: String(p.stockQty ?? 0),
            lowStockThreshold: String(p.lowStockThreshold ?? 5),
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const payload = {
                name: form.name,
                sku: form.sku,
                purchasePrice: rupeesToPaise(form.purchasePrice),
                sellingPrice: rupeesToPaise(form.sellingPrice),
                stockQty: Number(form.stockQty) || 0,
                lowStockThreshold: Number(form.lowStockThreshold) || 0,
            };
            if (editingId) {
                await productsApi.update(editingId, payload);
            } else {
                await productsApi.create(payload);
            }
            setForm(EMPTY_FORM);
            setEditingId(null);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this product?')) return;
        try {
            await productsApi.remove(id);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete product');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Package size={24} className="text-primary" />
                </span>
                Products
            </h1>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="glass p-6">
                <h2 className="mb-4 text-lg font-semibold">
                    {editingId ? 'Edit product' : 'Add product'}
                </h2>
                <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                        SKU (optional)
                        <input
                            name="sku"
                            className="glass-input mt-1"
                            value={form.sku}
                            onChange={setField}
                        />
                    </label>
                    <label className="block text-sm font-medium">
                        Purchase price (₹)
                        <input
                            name="purchasePrice"
                            type="number"
                            step="0.01"
                            min="0"
                            className="glass-input mt-1"
                            value={form.purchasePrice}
                            onChange={setField}
                            required
                        />
                    </label>
                    <label className="block text-sm font-medium">
                        Selling price (₹)
                        <input
                            name="sellingPrice"
                            type="number"
                            step="0.01"
                            min="0"
                            className="glass-input mt-1"
                            value={form.sellingPrice}
                            onChange={setField}
                            required
                        />
                    </label>
                    <label className="block text-sm font-medium">
                        Stock qty
                        <input
                            name="stockQty"
                            type="number"
                            min="0"
                            className="glass-input mt-1"
                            value={form.stockQty}
                            onChange={setField}
                        />
                    </label>
                    <label className="block text-sm font-medium">
                        Low stock threshold
                        <input
                            name="lowStockThreshold"
                            type="number"
                            min="0"
                            className="glass-input mt-1"
                            value={form.lowStockThreshold}
                            onChange={setField}
                        />
                    </label>
                    <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
                        <button type="submit" disabled={submitting} className="btn-primary">
                            {editingId ? 'Save changes' : 'Add product'}
                        </button>
                        {editingId && (
                            <button type="button" onClick={cancelEdit} className="btn-ghost">
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>
            <div className="glass overflow-x-auto p-6">
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Package size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No products yet</p>
                        <p className="text-sm text-gray-500">Add your first product above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>SKU</th>
                                <th>Purchase</th>
                                <th>Selling</th>
                                <th>Stock</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => {
                                const low = p.lowStock ?? p.stockQty <= (p.lowStockThreshold ?? 5);
                                return (
                                    <tr key={p.id}>
                                        <td className="font-medium">{p.name}</td>
                                        <td className="text-gray-500">{p.sku || '—'}</td>
                                        <td>{formatINR(p.purchasePrice)}</td>
                                        <td>{formatINR(p.sellingPrice)}</td>
                                        <td>
                                            {p.stockQty}
                                            {low && (
                                                <span className="badge badge-warning ml-2">Low stock</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => startEdit(p)}
                                                    className="btn-ghost px-3 py-1.5 text-xs"
                                                >
                                                    Edit
                                                </button>
                                                {isOwner && (
                                                    <button
                                                        onClick={() => handleDelete(p.id)}
                                                        className="btn-danger px-3 py-1.5 text-xs"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
