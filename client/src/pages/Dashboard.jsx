import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/money';
import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    PiggyBank,
    IndianRupee,
    BookOpen,
    Landmark,
} from 'lucide-react';

const CARDS = [
    { key: 'salesTotal', label: 'Sales', to: '/sales', color: 'text-green-600', icon: TrendingUp },
    { key: 'expensesTotal', label: 'Expenses', to: '/expenses', color: 'text-red-600', icon: TrendingDown },
    { key: 'profit', label: 'Profit', to: '/reports', color: 'text-primary', icon: PiggyBank, ownerOnlyLink: true },
    { key: 'cashBalance', label: 'Cash balance', to: '/dashboard', color: 'text-blue-600', icon: IndianRupee },
    { key: 'receivable', label: 'To collect (khata)', to: '/customers', color: 'text-orange-600', icon: BookOpen },
    { key: 'payable', label: 'To pay (suppliers)', to: '/suppliers', color: 'text-red-700', icon: Landmark },
];

export default function Dashboard() {
    const { user } = useAuth();
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
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <LayoutDashboard size={24} className="text-primary" />
                    </span>
                    Dashboard
                </h1>
                <div className="glass flex gap-2 p-1">
                    <button
                        type="button"
                        onClick={() => setRange('today')}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${range === 'today'
                            ? 'bg-gradient-to-r from-primary to-accent text-white shadow-btn-glow'
                            : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setRange('month')}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${range === 'month'
                            ? 'bg-gradient-to-r from-primary to-accent text-white shadow-btn-glow'
                            : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        This month
                    </button>
                </div>
            </div>

            {error && <div className="glass border border-red-200 p-4 text-sm text-red-600">{error}</div>}
            {loading && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="skeleton h-32" />
                    ))}
                </div>
            )}

            {summary && !loading && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {CARDS.map(({ key, label, to, color, icon: Icon, ownerOnlyLink }) => {
                        const isLinkable = !ownerOnlyLink || user?.role === 'owner';
                        const card = (
                            <>
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                                    <span className="rounded-xl bg-white/60 p-2.5">
                                        <Icon size={24} className={color} />
                                    </span>
                                </div>
                                <p className={`mt-2 text-3xl font-bold ${color}`}>{formatINR(summary[key])}</p>
                                {key === 'profit' && (
                                    <p className="mt-1 text-xs text-gray-400">Sales − expenses for the period</p>
                                )}
                            </>
                        );
                        return isLinkable ? (
                            <Link key={key} to={to} className="glass-card block p-6">
                                {card}
                            </Link>
                        ) : (
                            <div key={key} className="glass-card block p-6">
                                {card}
                            </div>
                        );
                    })}
                </div>
            )}

            {summary && !loading && (
                <div className="glass p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Quick actions
                    </h2>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <Link to="/sales" className="btn-primary">+ New sale</Link>
                        <Link to="/expenses" className="btn-ghost">+ Add expense</Link>
                        <Link to="/customers" className="btn-ghost">Customer khata</Link>
                        <Link to="/products" className="btn-ghost">Products</Link>
                    </div>
                </div>
            )}
        </div>
    );
}
