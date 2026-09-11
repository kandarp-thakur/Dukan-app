import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/endpoints';
import { formatINR } from '../utils/money';

const CARDS = [
    { key: 'salesTotal', label: 'Sales', to: '/sales', color: 'text-green-600' },
    { key: 'expensesTotal', label: 'Expenses', to: '/expenses', color: 'text-red-600' },
    { key: 'profit', label: 'Profit', to: '/reports', color: 'text-primary' },
    { key: 'cashBalance', label: 'Cash balance', to: '/dashboard', color: 'text-blue-600' },
    { key: 'receivable', label: 'To collect (khata)', to: '/customers', color: 'text-orange-600' },
    { key: 'payable', label: 'To pay (suppliers)', to: '/suppliers', color: 'text-red-700' },
];

export default function Dashboard() {
    const [range, setRange] = useState('today');
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await dashboardApi.summary(range);
                if (!cancelled) setSummary(data.summary);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load summary');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [range]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
                <div className="glass flex gap-2 p-1">
                    <button
                        type="button"
                        onClick={() => setRange('today')}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${range === 'today' ? 'bg-primary text-white' : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setRange('month')}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${range === 'month' ? 'bg-primary text-white' : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        This month
                    </button>
                </div>
            </div>

            {error && <div className="glass border border-red-200 p-4 text-sm text-red-600">{error}</div>}
            {loading && <div className="glass p-6 text-center text-gray-500">Loading summary…</div>}

            {summary && !loading && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {CARDS.map(({ key, label, to, color }) => (
                        <Link key={key} to={to} className="glass block p-6 transition hover:shadow-lg">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                            <p className={`mt-2 text-3xl font-bold ${color}`}>{formatINR(summary[key])}</p>
                            {key === 'profit' && (
                                <p className="mt-1 text-xs text-gray-400">Sales − expenses for the period</p>
                            )}
                        </Link>
                    ))}
                </div>
            )}

            {summary && !loading && (
                <div className="glass p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Quick actions
                    </h2>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <Link to="/sales" className="btn-primary">+ New sale</Link>
                        <Link to="/expenses" className="btn-primary">+ Add expense</Link>
                        <Link to="/customers" className="btn-primary">Customer khata</Link>
                        <Link to="/products" className="btn-primary">Products</Link>
                    </div>
                </div>
            )}
        </div>
    );
}
