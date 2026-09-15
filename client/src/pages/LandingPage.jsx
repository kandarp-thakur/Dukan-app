import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import HeroSection from '../sections/HeroSection';
import FeaturesSection from '../sections/FeaturesSection';
import PricingSection from '../sections/PricingSection';
import CtaSection from '../sections/CtaSection';

export default function LandingPage() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="skeleton h-9 w-64" />
            </div>
        );
    }

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <>
            <HeroSection />
            <FeaturesSection />
            <PricingSection />
            <CtaSection />
        </>
    );
}
