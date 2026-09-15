import { Outlet, useLocation } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';

export default function PublicLayout() {
    const { pathname } = useLocation();
    const hasHero = pathname === '/';

    return (
        <div className="flex min-h-screen flex-col">
            <PublicNavbar transparent={hasHero} />
            <main className={`flex-1 ${hasHero ? '' : 'pt-20'}`}>
                <Outlet />
            </main>
            <PublicFooter />
        </div>
    );
}
