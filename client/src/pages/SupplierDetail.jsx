import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { suppliersApi } from '../api/endpoints';
import { formatINR, rupeesToPaise } from '../utils/money';
import { formatDate } from '../utils/format';
import { Truck, Landmark } from 'lucide-react';

const EMPTY_PURCHASE = { name: '', qty: '', cost: '', paymentMethod: 'cash' };
const EMPTY_PAYMENT = { amount: '', method: 'upi', note: '' };

export default function SupplierDetail() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [purchaseForm, setPurchaseForm] = useState(EMPTY_PURCHASE);
    const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const d = await suppliersApi.statement(id);
                if (!cancelled) setData(d);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load statement');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [id, reloadKey]);

    const setPurchaseField = (e) =>
        setPurchaseForm({ ...purchaseForm, [e.target.name]: e.target.value });
    const setPaymentField = (e) => setPaymentForm({ ...paymentForm, [e.target.name]: e.target.value });

    const handlePurchase = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await suppliersApi.createPurchase({
                supplierId: id,
                items: [
                    {
                        name: purchaseForm.name,
                        qty: Number(purchaseForm.qty),
                        cost: rupeesToPaise(purchaseForm.cost),
                    },
                ],
                paymentMethod: purchaseForm.paymentMethod,
            });
            setPurchaseForm(EMPTY_PURCHASE);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await suppliersApi.recordPayment({
                supplierId: id,
                amount: rupeesToPaise(paymentForm.amount),
                method: paymentForm.method,
                note: paymentForm.note,
            });
            setPaymentForm(EMPTY_PAYMENT);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    // Chronological statement. Only credit purchases increase the payable
    // balance; payments reduce it. Non-credit purchases are shown but do not
    // affect the running balance.
    let running = 0;
    const rows = [];
    if (data) {
        const events = [
            ...data.purchases.map((p) => ({ kind: 'purchase', date: p.date, purchase: p })),
            ...data.payments.map((p) => ({ kind: 'payment', date: p.date, payment: p })),
        ].sort((a, b) => new Date(a.date) - new Date(b.date));
        for (const ev of events) {
            if (ev.kind === 'purchase') {
                if (ev.purchase.paymentMethod === 'credit') running += ev.purchase.total;
            } else {
                running -= ev.payment.amount;
            }
            rows.push({ ...ev, running });
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <Truck size={24} className="text-primary" />
                    </span>
                    {data ? data.supplier.name : 'Supplier'}
                </h1>
                <Link to="/suppliers" className="text-sm font-semibold text-primary hover:underline">
                    ← Back to suppliers
                </Link>
            </div>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            {loading ? (
                <div className="space-y-6">
                    <div className="skeleton h-24" />
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="skeleton h-72" />
                        <div className="skeleton h-72" />
                    </div>
                </div>
            ) : (
                data && (
                    <>
                        <div className="glass flex items-center justify-between p-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Payable balance
                                </p>
                                <p className="mt-1 text-3xl font-bold text-primary">
                                    {formatINR(data.balance)}
                                </p>
                            </div>
                            <span className="rounded-2xl bg-white/60 p-3">
                                <Landmark size={28} className="text-primary" />
                            </span>
                        </div>
                        <div className="grid gap-6 lg:grid-cols-2">
                            <div className="glass p-6">
                                <h2 className="mb-4 text-lg font-semibold">Record purchase</h2>
                                <form onSubmit={handlePurchase} className="space-y-4">
                                    <label className="block text-sm font-medium">
                                        Item name
                                        <input
                                            name="name"
                                            className="glass-input mt-1"
                                            value={purchaseForm.name}
                                            onChange={setPurchaseField}
                                            required
                                        />
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="block w-28 text-sm font-medium">
                                            Qty
                                            <input
                                                name="qty"
                                                type="number"
                                                min="1"
                                                step="1"
                                                className="glass-input mt-1"
                                                value={purchaseForm.qty}
                                                onChange={setPurchaseField}
                                                required
                                            />
                                        </label>
                                        <label className="block flex-1 text-sm font-medium">
                                            Cost per unit (₹)
                                            <input
                                                name="cost"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="glass-input mt-1"
                                                value={purchaseForm.cost}
                                                onChange={setPurchaseField}
                                                required
                                            />
                                        </label>
                                    </div>
                                    <label className="block text-sm font-medium">
                                        Payment method
                                        <select
                                            name="paymentMethod"
                                            className="glass-input mt-1"
                                            value={purchaseForm.paymentMethod}
                                            onChange={setPurchaseField}
                                        >
                                            <option value="cash">Cash</option>
                                            <option value="upi">UPI</option>
                                            <option value="card">Card</option>
                                            <option value="credit">Credit (udhaar)</option>
                                        </select>
                                    </label>
                                    <button type="submit" disabled={submitting} className="btn-primary">
                                        Record purchase
                                    </button>
                                </form>
                            </div>
                            <div className="glass p-6">
                                <h2 className="mb-4 text-lg font-semibold">Record payment</h2>
                                <form onSubmit={handlePayment} className="space-y-4">
                                    <div className="flex gap-4">
                                        <label className="block flex-1 text-sm font-medium">
                                            Amount (₹)
                                            <input
                                                name="amount"
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                className="glass-input mt-1"
                                                value={paymentForm.amount}
                                                onChange={setPaymentField}
                                                required
                                            />
                                        </label>
                                        <label className="block w-36 text-sm font-medium">
                                            Pay using
                                            <select
                                                name="method"
                                                className="glass-input mt-1"
                                                value={paymentForm.method}
                                                onChange={setPaymentField}
                                            >
                                                <option value="cash">Cash</option>
                                                <option value="upi">UPI</option>
                                                <option value="card">Card</option>
                                            </select>
                                        </label>
                                    </div>
                                    <label className="block text-sm font-medium">
                                        Note
                                        <input
                                            name="note"
                                            className="glass-input mt-1"
                                            value={paymentForm.note}
                                            onChange={setPaymentField}
                                        />
                                    </label>
                                    <button type="submit" disabled={submitting} className="btn-primary">
                                        Record payment
                                    </button>
                                </form>
                            </div>
                        </div>
                        <div className="glass overflow-x-auto p-6">
                            <h2 className="mb-4 text-lg font-semibold">Statement</h2>
                            {rows.length === 0 ? (
                                <div className="empty-state">
                                    <span className="rounded-full bg-white/60 p-3">
                                        <Truck size={28} className="text-primary" />
                                    </span>
                                    <p className="font-semibold">No purchases or payments yet</p>
                                    <p className="text-sm text-gray-500">Record a purchase or payment above.</p>
                                </div>
                            ) : (
                                <table className="glass-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Details</th>
                                            <th className="text-right">Amount</th>
                                            <th className="text-right">Payable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, i) => {
                                            const isPurchase = row.kind === 'purchase';
                                            const details = isPurchase
                                                ? row.purchase.items
                                                    .map((it) => `${it.name} × ${it.qty}`)
                                                    .join(', ')
                                                : row.payment.note || 'Payment';
                                            const credit = isPurchase && row.purchase.paymentMethod === 'credit';
                                            const amountText = isPurchase
                                                ? credit
                                                    ? `+${formatINR(row.purchase.total)}`
                                                    : `${formatINR(row.purchase.total)} (paid)`
                                                : `-${formatINR(row.payment.amount)}`;
                                            return (
                                                <tr key={isPurchase ? row.purchase.id : row.payment.id || i}>
                                                    <td className="text-gray-500">
                                                        {formatDate(row.date)}
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`badge ${isPurchase ? 'badge-neutral' : 'badge-success'}`}
                                                        >
                                                            {isPurchase ? 'Purchase' : 'Payment'}
                                                        </span>
                                                    </td>
                                                    <td className="text-gray-500">{details}</td>
                                                    <td
                                                        className={`text-right font-semibold ${credit || !isPurchase ? 'text-red-600' : 'text-gray-600'
                                                            }`}
                                                    >
                                                        {amountText}
                                                    </td>
                                                    <td className="text-right font-semibold">
                                                        {formatINR(row.running)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
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
