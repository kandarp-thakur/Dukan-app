import { useEffect, useState } from 'react';
import { businessApi } from '../api/endpoints';

const EMPTY_FORM = { name: '', address: '', gstin: '', currency: 'INR', invoicePrefix: 'INV' };

export default function Settings() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await businessApi.get();
                const b = data.business;
                if (!cancelled) {
                    setForm({
                        name: b.name || '',
                        address: b.address || '',
                        gstin: b.gstin || '',
                        currency: b.currency || 'INR',
                        invoicePrefix: b.invoicePrefix || 'INV',
                    });
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load business');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');
        try {
            await businessApi.update({
                name: form.name,
                address: form.address,
                gstin: form.gstin,
                currency: form.currency,
                invoicePrefix: form.invoicePrefix,
            });
            setNotice('Business updated');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update business');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-primary">Settings</h1>

            {error && <div className="glass border border-red-200 p-4 text-sm text-red-600">{error}</div>}
            {notice && <div className="glass border border-green-200 p-4 text-sm text-green-700">{notice}</div>}
            {loading && <div className="glass p-6 text-center text-gray-500">Loading settings…</div>}

            {!loading && (
                <form onSubmit={handleSave} className="glass space-y-4 p-6">
                    <h2 className="text-lg font-semibold text-gray-800">Business profile</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="business-name" className="block text-xs font-semibold text-gray-500">
                                Business name
                            </label>
                            <input
                                id="business-name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                className="glass-input mt-1"
                            />
                        </div>
                        <div>
                            <label htmlFor="business-gstin" className="block text-xs font-semibold text-gray-500">
                                GSTIN
                            </label>
                            <input
                                id="business-gstin"
                                name="gstin"
                                value={form.gstin}
                                onChange={handleChange}
                                className="glass-input mt-1"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label htmlFor="business-address" className="block text-xs font-semibold text-gray-500">
                                Address
                            </label>
                            <textarea
                                id="business-address"
                                name="address"
                                value={form.address}
                                onChange={handleChange}
                                rows={2}
                                className="glass-input mt-1"
                            />
                        </div>
                        <div>
                            <label htmlFor="business-currency" className="block text-xs font-semibold text-gray-500">
                                Currency
                            </label>
                            <select
                                id="business-currency"
                                name="currency"
                                value={form.currency}
                                onChange={handleChange}
                                className="glass-input mt-1"
                            >
                                <option value="INR">INR (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="business-invoice-prefix" className="block text-xs font-semibold text-gray-500">
                                Invoice prefix
                            </label>
                            <input
                                id="business-invoice-prefix"
                                name="invoicePrefix"
                                value={form.invoicePrefix}
                                onChange={handleChange}
                                className="glass-input mt-1"
                            />
                        </div>
                    </div>
                    <button type="submit" disabled={saving} className="btn-primary">
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </form>
            )}
        </div>
    );
}
