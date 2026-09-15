import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';

export default function PublicNavbar({ transparent = true }) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        if (!transparent) return undefined;
        const onScroll = () => setScrolled(window.scrollY > 16);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [transparent]);

    const solid = !transparent || scrolled;

    return (
        <header
            data-testid="public-navbar"
            data-solid={solid ? 'true' : 'false'}
            className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${solid ? 'navbar-solid' : 'navbar-transparent'
                }`}
        >
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                <Link to="/" className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-btn-glow">
                        <Receipt size={20} />
                    </span>
                    <span className="text-lg font-bold text-primary">Acc App</span>
                </Link>
                <div className="flex items-center gap-2">
                    <Link to="/login" className="btn-ghost">
                        Sign in
                    </Link>
                    <Link to="/register" className="btn-primary">
                        Get started
                    </Link>
                </div>
            </nav>
        </header>
    );
}
