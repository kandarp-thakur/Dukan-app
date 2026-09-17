import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { shouldUse3D } from '../utils/webglSupport';
import HeroFallback from '../components/HeroFallback';

const HeroScene = lazy(() => import('../components/HeroScene'));

export default function HeroSection() {
    // Probed once: the probe creates a canvas, so it must not run on every render.
    const [use3D] = useState(() => shouldUse3D());
    const [contextLost, setContextLost] = useState(false);
    const [inView, setInView] = useState(true);
    const [tabVisible, setTabVisible] = useState(true);
    const artRef = useRef(null);

    // Spec §6.3: pause the canvas when the hero scrolls out of view. A WebGL
    // context that draws every frame while offscreen is the first thing a
    // browser reclaims under memory pressure; once reclaimed the canvas stays
    // blank (or unlit) until a reload, which is the "after some time it looks
    // wrong" failure.
    useEffect(() => {
        const node = artRef.current;
        if (!use3D || !node || typeof IntersectionObserver === 'undefined') return undefined;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[entries.length - 1];
                if (entry) setInView(entry.isIntersecting);
            },
            { threshold: 0 }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [use3D]);

    // A background tab also counts as "nothing to draw". r3f's default loop
    // keeps running there, which is pure wasted GPU time.
    useEffect(() => {
        if (!use3D || typeof document === 'undefined') return undefined;

        const update = () => setTabVisible(document.visibilityState !== 'hidden');
        update();
        document.addEventListener('visibilitychange', update);
        return () => document.removeEventListener('visibilitychange', update);
    }, [use3D]);

    // A lost context cannot be rendered from. The static fallback keeps the
    // hero looking intentional rather than leaving a dead canvas behind.
    const handleContextLost = useCallback(() => setContextLost(true), []);

    const show3D = use3D && !contextLost;

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
                <div ref={artRef} aria-hidden="true" className="relative h-72 sm:h-96">
                    {show3D ? (
                        <Suspense fallback={<HeroFallback />}>
                            <HeroScene
                                active={inView && tabVisible}
                                onContextLost={handleContextLost}
                            />
                        </Suspense>
                    ) : (
                        <HeroFallback />
                    )}
                </div>
            </div>
        </section>
    );
}
