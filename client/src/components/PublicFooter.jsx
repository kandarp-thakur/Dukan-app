import { Link } from 'react-router-dom';

export default function PublicFooter() {
    const year = new Date().getFullYear();

    return (
        <footer className="mt-20 border-t border-white/60 bg-white/40">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-lg font-bold text-primary">Acc App</p>
                    <p className="text-sm text-gray-600">Simple accounting for Indian small businesses.</p>
                </div>
                <nav className="flex flex-wrap gap-4 text-sm">
                    <Link to="/" className="text-primary hover:underline">
                        Home
                    </Link>
                    <Link to="/login" className="text-primary hover:underline">
                        Sign in
                    </Link>
                    <Link to="/register" className="text-primary hover:underline">
                        Get started
                    </Link>
                </nav>
            </div>
            <p className="px-4 pb-8 text-center text-xs text-gray-500">
                © {year} Acc App. All rights reserved.
            </p>
        </footer>
    );
}
