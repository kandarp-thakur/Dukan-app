import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/sales', label: 'Sales', icon: '🧾' },
  { to: '/expenses', label: 'Expenses', icon: '💸' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/suppliers', label: 'Suppliers', icon: '🚚' },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/reports', label: 'Reports', icon: '📈', ownerOnly: true },
  { to: '/staff', label: 'Staff', icon: '🧑‍💼', ownerOnly: true },
  { to: '/settings', label: 'Settings', icon: '⚙️', ownerOnly: true },
  { to: '/subscription', label: 'Subscription', icon: '⭐', ownerOnly: true },
];

export default function AppShell() {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const items = NAV_ITEMS.filter((item) => !item.ownerOnly || user?.role === 'owner');

  return (
    <div className="flex min-h-screen">
      <aside className="glass m-4 mr-0 hidden w-60 shrink-0 flex-col p-4 md:flex">
        <div className="mb-6 px-2">
          <p className="text-lg font-bold text-primary">{business?.name || 'My Business'}</p>
          <p className="text-xs text-gray-500">
            {business?.plan === 'pro' ? 'Pro plan' : 'Free plan'}
          </p>
        </div>
        <nav className="flex-1 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary text-white shadow-glass' : 'text-gray-700 hover:bg-white/70'
                }`
              }
            >
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} className="btn-primary mt-4 w-full">
          Logout
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass m-4 mb-0 flex items-center justify-between px-6 py-3 md:hidden">
          <span className="font-bold text-primary">{business?.name || 'My Business'}</span>
          <button onClick={handleLogout} className="text-sm font-semibold text-primary">
            Logout
          </button>
        </header>
        <main className="m-4 flex-1 p-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
