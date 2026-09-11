import { useEffect, useState } from 'react';
import { plansApi, businessApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import { useAuth } from '../context/AuthContext';

export default function Subscription() {
    const { user } = useAuth();
    const [plans, setPlans] = useState([]);
    const [currentPlan, setCurrentPlan] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [plansData, businessData] = await Promise.all([plansApi.list(), businessApi.get()]);
                if (!cancelled) {
                    setPlans(plansData.plans);
                    setCurrentPlan(businessData.business.plan);
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load plans');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleUpgrade = async (plan) => {
        if (!window.confirm(`Request an upgrade to the ${plan} plan?`)) return;
        setRequesting(true);
        setError('');
        setNotice('');
        try {
            await businessApi.requestUpgrade(plan);
            setNotice('Upgrade request received. Our team will contact you.');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to request upgrade');
        } finally {
            setRequesting(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-primary">Subscription</h1>

            {error && <div className="glass border border-red-200 p-4 text-sm text-red-600">{error}</div>}
            {notice && <div className="glass border border-green-200 p-4 text-sm text-green-700">{notice}</div>}
            {loading && <div className="glass p-6 text-center text-gray-500">Loading plans…</div>}

            {!loading && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {plans.map((plan) => {
                        const isCurrent = plan.id === currentPlan;
                        return (
                            <div
                                key={plan.id}
                                className={`glass p-6 ${isCurrent ? 'ring-2 ring-primary' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                                    {isCurrent && (
                                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                            Current plan
                                        </span>
                                    )}
                                </div>
                                <p className="mt-3 text-3xl font-bold text-primary">
                                    {formatINR(plan.priceMonthly)}
                                    <span className="text-sm font-normal text-gray-400"> /month</span>
                                </p>
                                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2">
                                            <span className="text-primary">✓</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                {!isCurrent && (
                                    <button
                                        type="button"
                                        onClick={() => handleUpgrade(plan.id)}
                                        disabled={requesting}
                                        className="btn-primary mt-6 w-full"
                                    >
                                        {requesting ? 'Requesting…' : `Upgrade to ${plan.name}`}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && user?.role !== 'owner' && (
                <p className="text-center text-sm text-gray-400">Only the owner can manage the subscription.</p>
            )}
        </div>
    );
}
