import { useEffect, useState } from 'react';
import { reportsApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    PiggyBank,
    BookOpen,
    Landmark,
} from 'lucide-react';

const TABS = [
    { key: 'daily', label: 'Daily' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'outstanding', label: 'Outstanding' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = () => new Date().toISOString().slice(0, 7);

export default function Reports() {
    const [tab, setTab] = useState('daily');
    const [date, setDate] = useState(todayStr());
    const [month, setMonth] = useState(monthStr());
    const [report, setReport] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                let data;
                if (tab === 'daily') data = await reportsApi.daily(date);
                else if (tab === 'monthly') data = await reportsApi.monthly(month);
                else data = await reportsApi.outstanding();
                if (!cancelled) setReport(data.report);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load report');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
        // Fetch on tab switch or explicit re-run; date/month are read at fetch time.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, reloadKey]);

    const handleTab = (key) => {
        setReport(null);
        setError('');
        setTab(key);
    };

    const runReport = () => setReloadKey((k) => k + 1);

    return (
        <div className="space-y-6">
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <BarChart3 size={24} className="text-primary" />
                </span>
                Reports
            </h1>

            <div className="glass flex flex-wrap gap-2 p-1">
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => handleTab(key)}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === key
                                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-btn-glow'
                                : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {error && <div className="glass border border-red-200 p-4 text-sm text-red-600">{error}</div>}
            {loading && (
                <div className="glass p-6">
                    <div className="skeleton h-8 w-40" />
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="skeleton h-24" />
                        <div className="skeleton h-24" />
                        <div className="skeleton h-24" />
                    </div>
                </div>
            )}

            {report && !loading && tab === 'daily' && (
                <section className="glass p-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <h2 className="text-lg font-semibold text-gray-800">Daily report</h2>
                        <div className="flex items-end gap-2">
                            <div>
                                <label htmlFor="report-date" className="block text-xs font-semibold text-gray-500">
                                    Date
                                </label>
                                <input
                                    id="report-date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="glass-input mt-1"
                                />
                            </div>
                            <button type="button" onClick={runReport} className="btn-primary">
                                Run report
                            </button>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <TrendingUp size={20} className="text-green-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-green-600">{formatINR(report.salesTotal)}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expenses</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <TrendingDown size={20} className="text-red-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-red-600">{formatINR(report.expensesTotal)}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <PiggyBank size={20} className="text-primary" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-primary">{formatINR(report.profit)}</p>
                        </div>
                    </div>
                </section>
            )}

            {report && !loading && tab === 'monthly' && (
                <section className="glass p-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <h2 className="text-lg font-semibold text-gray-800">Monthly report</h2>
                        <div className="flex items-end gap-2">
                            <div>
                                <label htmlFor="report-month" className="block text-xs font-semibold text-gray-500">
                                    Month
                                </label>
                                <input
                                    id="report-month"
                                    type="month"
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="glass-input mt-1"
                                />
                            </div>
                            <button type="button" onClick={runReport} className="btn-primary">
                                Run report
                            </button>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <TrendingUp size={20} className="text-green-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-green-600">{formatINR(report.salesTotal)}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expenses</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <TrendingDown size={20} className="text-red-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-red-600">{formatINR(report.expensesTotal)}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <PiggyBank size={20} className="text-primary" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-primary">{formatINR(report.profit)}</p>
                        </div>
                    </div>
                </section>
            )}

            {report && !loading && tab === 'outstanding' && (
                <section className="glass p-6">
                    <h2 className="text-lg font-semibold text-gray-800">Outstanding report</h2>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Receivable (khata)
                                </p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <BookOpen size={20} className="text-orange-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-orange-600">
                                {formatINR(report.receivableTotal)}
                            </p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Payable (suppliers)
                                </p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <Landmark size={20} className="text-red-700" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-red-700">{formatINR(report.payableTotal)}</p>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                Customers who owe you
                            </h3>
                            <table className="glass-table mt-2">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Phone</th>
                                        <th className="text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.receivables.map((c) => (
                                        <tr key={c.id}>
                                            <td className="font-medium text-gray-800">{c.name}</td>
                                            <td className="text-gray-500">{c.phone || '—'}</td>
                                            <td className="text-right font-semibold text-orange-600">
                                                {formatINR(c.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.receivables.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="text-center text-gray-400">
                                                No outstanding khata
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                Suppliers you owe
                            </h3>
                            <table className="glass-table mt-2">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Phone</th>
                                        <th className="text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.payables.map((s) => (
                                        <tr key={s.id}>
                                            <td className="font-medium text-gray-800">{s.name}</td>
                                            <td className="text-gray-500">{s.phone || '—'}</td>
                                            <td className="text-right font-semibold text-red-700">
                                                {formatINR(s.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.payables.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="text-center text-gray-400">
                                                No outstanding payables
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
