import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { plansApi } from '../api/endpoints';
import { formatINR } from '../utils/money';

// Mirrors server/src/controllers/planController.js PLANS so the landing page
// still prices correctly if /plans is unreachable.
export const FALLBACK_PLANS = [
    {
        id: 'free',
        name: 'Free',
        priceMonthly: 0,
        features: [
            'Up to 1 user (owner)',
            'Unlimited sales & expenses',
            'Customer khata',
            'Basic reports (daily)',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        priceMonthly: 19900,
        features: [
            'Owner + staff accounts',
            'Everything in Free',
            'Monthly & outstanding reports',
            'Invoice customization',
            'Priority support',
        ],
    },
];

export default function PricingSection() {
    const [plans, setPlans] = useState(FALLBACK_PLANS);

    useEffect(() => {
        let active = true;
        plansApi
            .list()
            .then((data) => {
                const list = data?.plans;
                if (active && Array.isArray(list) && list.length > 0) setPlans(list);
            })
            .catch(() => {
                // Keep FALLBACK_PLANS.
            });
        return () => {
            active = false;
        };
    }, []);

    return (
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold text-primary sm:text-3xl">Simple pricing</h2>
            <p className="mt-2 text-gray-600">Start free. Upgrade when your team grows.</p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {plans.map((plan) => (
                    <div key={plan.id} className="glass-card p-6">
                        <span className={`badge ${plan.id === 'pro' ? 'badge-success' : 'badge-warning'}`}>
                            {plan.name}
                        </span>
                        <p className="mt-4 text-3xl font-bold text-primary">
                            {plan.priceMonthly === 0
                                ? formatINR(plan.priceMonthly)
                                : `${formatINR(plan.priceMonthly)}/mo`}
                        </p>
                        <ul className="mt-4 space-y-2">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                                    <Check size={18} className="mt-0.5 shrink-0 text-accent" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <Link
                            to="/register"
                            className={`${plan.id === 'pro' ? 'btn-primary' : 'btn-ghost'} mt-6 w-full`}
                        >
                            Get started
                        </Link>
                    </div>
                ))}
            </div>
        </section>
    );
}
