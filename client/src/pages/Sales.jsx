import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesApi, customersApi } from '../api/endpoints';
import { formatINR, rupeesToPaise } from '../utils/money';
import { formatDate } from '../utils/format';
import { computeGst, isIntraState, stateCodeFromGstin, INDIAN_STATES, GST_RATES } from '../utils/gst';
import { useAuth } from '../context/AuthContext';
import { Receipt } from 'lucide-react';

const EMPTY_ITEM = { name: '', qty: '', rate: '', gstRate: 0, hsn: '' };

export default function Sales() {
    const { business } = useAuth();
    const [sales, setSales] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState(EMPTY_ITEM);
    const [discount, setDiscount] = useState('');
    const [isGst, setIsGst] = useState(false);
    const [buyerName, setBuyerName] = useState('');
    const [buyerGstin, setBuyerGstin] = useState('');
    const [buyerAddress, setBuyerAddress] = useState('');
    const [placeOfSupply, setPlaceOfSupply] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [customerId, setCustomerId] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [salesData, customersData] = await Promise.all([
                    salesApi.list(),
                    customersApi.list(),
                ]);
                if (!cancelled) {
                    setSales(salesData.sales);
                    setCustomers(customersData.customers);
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load sales');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    // Auto-fill buyer fields from the selected customer (editable after).
    useEffect(() => {
        if (!customerId) return;
        const c = customers.find((x) => x.id === customerId);
        if (!c) return;
        setBuyerName(c.name || '');
        setBuyerGstin(c.gstin || '');
        setBuyerAddress(c.address || '');
    }, [customerId, customers]);

    // Derive place of supply from buyer GSTIN, else the business GSTIN.
    useEffect(() => {
        const code = buyerGstin
            ? stateCodeFromGstin(buyerGstin)
            : stateCodeFromGstin(business?.gstin || '');
        setPlaceOfSupply(code);
    }, [buyerGstin, business]);

    const setItemField = (e) => setItem({ ...item, [e.target.name]: e.target.value });

    const preview = computeGst(
        [
            {
                amount: (Number(item.qty) || 0) * rupeesToPaise(item.rate),
                gstRate: isGst ? Number(item.gstRate) || 0 : 0,
            },
        ],
        rupeesToPaise(discount),
        isGst,
        isIntraState(business?.gstin || '', placeOfSupply)
    );

    const resetForm = () => {
        setItem(EMPTY_ITEM);
        setDiscount('');
        setIsGst(false);
        setBuyerName('');
        setBuyerGstin('');
        setBuyerAddress('');
        setPlaceOfSupply('');
        setPaymentMethod('cash');
        setCustomerId('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (paymentMethod === 'credit' && !customerId) {
            setError('Credit sales require a customer (khata)');
            return;
        }
        setSubmitting(true);
        try {
            const line = {
                name: item.name,
                qty: Number(item.qty),
                rate: rupeesToPaise(item.rate),
                gstRate: isGst ? Number(item.gstRate) || 0 : 0,
            };
            if (isGst && item.hsn) line.hsn = item.hsn;
            const payload = {
                items: [line],
                discount: rupeesToPaise(discount),
                isGst,
                paymentMethod,
            };
            if (isGst) {
                if (buyerName) payload.buyerName = buyerName;
                if (buyerGstin) payload.buyerGstin = buyerGstin;
                if (buyerAddress) payload.buyerAddress = buyerAddress;
                if (placeOfSupply) payload.placeOfSupply = placeOfSupply;
            }
            if (customerId) payload.customerId = customerId;
            await salesApi.create(payload);
            resetForm();
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('Cancel this sale? Stock and khata will be restored.')) return;
        try {
            await salesApi.cancel(id);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel sale');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Receipt size={24} className="text-primary" />
                </span>
                Sales
            </h1>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="glass p-6">
                <h2 className="mb-4 text-lg font-semibold">New sale</h2>
                <div className="mb-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setIsGst(false)}
                        aria-pressed={!isGst}
                        className={isGst ? 'btn-ghost' : 'btn-primary'}
                    >
                        Non-GST
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsGst(true)}
                        aria-pressed={isGst}
                        className={isGst ? 'btn-primary' : 'btn-ghost'}
                    >
                        GST invoice
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                        <label className="block min-w-48 flex-1 text-sm font-medium">
                            Item name
                            <input
                                name="name"
                                className="glass-input mt-1"
                                value={item.name}
                                onChange={setItemField}
                                required
                            />
                        </label>
                        <label className="block w-24 text-sm font-medium">
                            Qty
                            <input
                                name="qty"
                                type="number"
                                min="1"
                                step="1"
                                className="glass-input mt-1"
                                value={item.qty}
                                onChange={setItemField}
                                required
                            />
                        </label>
                        <label className="block w-32 text-sm font-medium">
                            Rate (₹)
                            <input
                                name="rate"
                                type="number"
                                step="0.01"
                                min="0"
                                className="glass-input mt-1"
                                value={item.rate}
                                onChange={setItemField}
                                required
                            />
                        </label>
                        {isGst && (
                            <>
                                <label className="block w-32 text-sm font-medium">
                                    GST rate
                                    <select
                                        name="gstRate"
                                        className="glass-input mt-1"
                                        value={item.gstRate}
                                        onChange={setItemField}
                                    >
                                        {GST_RATES.map((r) => (
                                            <option key={r} value={r}>
                                                {r}%
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block w-32 text-sm font-medium">
                                    HSN code
                                    <input
                                        name="hsn"
                                        className="glass-input mt-1"
                                        value={item.hsn}
                                        onChange={setItemField}
                                    />
                                </label>
                            </>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <label className="block w-32 text-sm font-medium">
                            Discount (₹)
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="glass-input mt-1"
                                value={discount}
                                onChange={(e) => setDiscount(e.target.value)}
                            />
                        </label>
                        <label className="block w-40 text-sm font-medium">
                            Payment method
                            <select
                                className="glass-input mt-1"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                                <option value="cash">Cash</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card</option>
                                <option value="credit">Credit (khata)</option>
                            </select>
                        </label>
                        <label className="block min-w-48 flex-1 text-sm font-medium">
                            Customer
                            <select
                                className="glass-input mt-1"
                                value={customerId}
                                onChange={(e) => setCustomerId(e.target.value)}
                            >
                                <option value="">— none —</option>
                                {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {isGst && (
                        <div className="flex flex-wrap gap-4">
                            <label className="block min-w-48 flex-1 text-sm font-medium">
                                Buyer name
                                <input
                                    className="glass-input mt-1"
                                    value={buyerName}
                                    onChange={(e) => setBuyerName(e.target.value)}
                                />
                            </label>
                            <label className="block w-56 text-sm font-medium">
                                Buyer GSTIN
                                <input
                                    className="glass-input mt-1"
                                    value={buyerGstin}
                                    onChange={(e) => setBuyerGstin(e.target.value)}
                                />
                            </label>
                            <label className="block min-w-48 flex-1 text-sm font-medium">
                                Buyer address
                                <input
                                    className="glass-input mt-1"
                                    value={buyerAddress}
                                    onChange={(e) => setBuyerAddress(e.target.value)}
                                />
                            </label>
                            <label className="block w-56 text-sm font-medium">
                                Place of supply
                                <select
                                    className="glass-input mt-1"
                                    value={placeOfSupply}
                                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                                >
                                    <option value="">— select —</option>
                                    {Object.entries(INDIAN_STATES).map(([code, name]) => (
                                        <option key={code} value={code}>
                                            {code} — {name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    )}
                    <div className="rounded-xl bg-white/50 px-4 py-3 text-sm text-gray-600">
                        <span className="mr-4">
                            Subtotal <span className="font-semibold">{formatINR(preview.taxableValue + rupeesToPaise(discount))}</span>
                        </span>
                        <span className="mr-4">
                            Discount <span className="font-semibold">{formatINR(rupeesToPaise(discount))}</span>
                        </span>
                        {isGst && preview.igst > 0 && (
                            <span className="mr-4">
                                IGST <span className="font-semibold">{formatINR(preview.igst)}</span>
                            </span>
                        )}
                        {isGst && preview.igst === 0 && (
                            <span className="mr-4">
                                CGST <span className="font-semibold">{formatINR(preview.cgst)}</span> · SGST{' '}
                                <span className="font-semibold">{formatINR(preview.sgst)}</span>
                            </span>
                        )}
                        <span>
                            Total{' '}
                            <span className="font-semibold text-primary">
                                {formatINR(preview.taxableValue + preview.tax)}
                            </span>
                        </span>
                    </div>
                    <button type="submit" disabled={submitting} className="btn-primary">
                        Record sale
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
                ) : sales.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Receipt size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No sales yet</p>
                        <p className="text-sm text-gray-500">Record your first sale above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Invoice</th>
                                <th>Date</th>
                                <th>Items</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map((s) => (
                                <tr key={s.id}>
                                    <td className="font-medium">
                                        <Link
                                            to={`/sales/${s.id}`}
                                            className="text-primary hover:underline"
                                        >
                                            {s.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="text-gray-500">{formatDate(s.date)}</td>
                                    <td className="text-gray-500">
                                        {s.items.map((it) => `${it.name} × ${it.qty}`).join(', ')}
                                    </td>
                                    <td>
                                        <span className="badge badge-neutral">{s.paymentMethod}</span>
                                    </td>
                                    <td>
                                        <span
                                            className={`badge ${s.status === 'cancelled' ? 'badge-danger' : 'badge-success'}`}
                                        >
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="text-right font-semibold">
                                        {formatINR(s.total)}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                to={`/invoices/${s.id}`}
                                                className="btn-ghost px-3 py-1.5 text-xs"
                                            >
                                                Invoice
                                            </Link>
                                            {s.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleCancel(s.id)}
                                                    className="btn-danger px-3 py-1.5 text-xs"
                                                >
                                                    Cancel
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
