import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { shouldUse3D } from '../utils/webglSupport';
import HeroFallback from '../components/HeroFallback';

const HeroScene = lazy(() => import('../components/HeroScene'));

export default function HeroSection() {
    const use3D = shouldUse3D();

    return (
        <section className="relative overflow-hidden pb-16 pt-28 sm:pt-32">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
                <div>
                    <span className="badge badge-success">Built for Indian small business</span>
                    <h1 className="mt-4 text-4xl font-bold leading-tight text-primary sm:text-5xl">
                        Sales, invoices and khata — all in one place
                    </h1>
                    <p className="mt-4 text-lg text-gray-600">
                        Acc App keeps your books simple: record sales and expenses, send GST invoices, track
                        customer khata and see your profit at a glance.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link to="/register" className="btn-primary">
                            Get started
                        </Link>
                        <Link to="/login" className="btn-ghost">
                            Sign in
                        </Link>
                    </div>
                </div>
                <div aria-hidden="true" className="relative h-72 sm:h-96">
                    {use3D ? (
                        <Suspense fallback={<HeroFallback />}>
                            <HeroScene />
                        </Suspense>
                    ) : (
                        <HeroFallback />
                    )}
                </div>
            </div>
        </section>
    );
}
