import { useEffect, useState } from 'react';
import { reportsApi } from '../api/endpoints';
import { formatINR } from '../utils/money';

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
            <h1 className="text-2xl font-bold text-primary">Reports</h1>

            <div className="glass flex flex-wrap gap-2 p-1">
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => handleTab(key)}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === key ? 'bg-primary text-white' : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {error && <div className="glass border border-red-200 p-4 text-sm text-red-600">{error}</div>}
            {loading && <div className="glass p-6 text-center text-gray-500">Loading report…</div>}

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
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales</p>
                            <p className="mt-2 text-2xl font-bold text-green-600">{formatINR(report.salesTotal)}</p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expenses</p>
                            <p className="mt-2 text-2xl font-bold text-red-600">{formatINR(report.expensesTotal)}</p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit</p>
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
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales</p>
                            <p className="mt-2 text-2xl font-bold text-green-600">{formatINR(report.salesTotal)}</p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expenses</p>
                            <p className="mt-2 text-2xl font-bold text-red-600">{formatINR(report.expensesTotal)}</p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit</p>
                            <p className="mt-2 text-2xl font-bold text-primary">{formatINR(report.profit)}</p>
                        </div>
                    </div>
                </section>
            )}

            {report && !loading && tab === 'outstanding' && (
                <section className="glass p-6">
                    <h2 className="text-lg font-semibold text-gray-800">Outstanding report</h2>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Receivable (khata)
                            </p>
                            <p className="mt-2 text-2xl font-bold text-orange-600">
                                {formatINR(report.receivableTotal)}
                            </p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Payable (suppliers)
                            </p>
                            <p className="mt-2 text-2xl font-bold text-red-700">{formatINR(report.payableTotal)}</p>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                Customers who owe you
                            </h3>
                            <table className="mt-2 w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
                                        <th className="pb-2">Name</th>
                                        <th className="pb-2">Phone</th>
                                        <th className="pb-2 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.receivables.map((c) => (
                                        <tr key={c.id} className="border-b border-gray-100">
                                            <td className="py-2 font-medium text-gray-800">{c.name}</td>
                                            <td className="py-2 text-gray-500">{c.phone || '—'}</td>
                                            <td className="py-2 text-right font-semibold text-orange-600">
                                                {formatINR(c.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.receivables.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-3 text-center text-gray-400">
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
                            <table className="mt-2 w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
                                        <th className="pb-2">Name</th>
                                        <th className="pb-2">Phone</th>
                                        <th className="pb-2 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.payables.map((s) => (
                                        <tr key={s.id} className="border-b border-gray-100">
                                            <td className="py-2 font-medium text-gray-800">{s.name}</td>
                                            <td className="py-2 text-gray-500">{s.phone || '—'}</td>
                                            <td className="py-2 text-right font-semibold text-red-700">
                                                {formatINR(s.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.payables.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-3 text-center text-gray-400">
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
