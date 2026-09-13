import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  LayoutDashboard,
  Receipt,
  FileText,
  Wallet,
  Users,
  Truck,
  Package,
  BarChart3,
  UserCog,
  Settings,
  Crown,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sales', label: 'Sales', icon: Receipt },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/reports', label: 'Reports', icon: BarChart3, ownerOnly: true },
  { to: '/staff', label: 'Staff', icon: UserCog, ownerOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, ownerOnly: true },
  { to: '/subscription', label: 'Subscription', icon: Crown, ownerOnly: true },
];

export default function AppShell() {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const items = NAV_ITEMS.filter((item) => !item.ownerOnly || user?.role === 'owner');
  const initials = (user?.name || 'U').trim().slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="glass m-4 mr-0 hidden w-60 shrink-0 flex-col p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-btn-glow">
              <Store size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-primary">{business?.name || 'My Business'}</p>
              <span className={`badge mt-0.5 ${business?.plan === 'pro' ? 'badge-success' : 'badge-warning'}`}>
                {business?.plan === 'pro' ? 'Pro plan' : 'Free plan'}
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gradient-to-r from-primary to-accent text-white shadow-btn-glow'
                    : 'text-gray-700 hover:bg-white/70'
                }`
              }
            >
              <item.icon size={20} className="shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-white/50 pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800">{user?.name || 'User'}</p>
              <span className="badge badge-neutral">{user?.role || 'staff'}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-ghost mt-3 w-full">
            <span className="inline-flex items-center justify-center gap-2">
              <LogOut size={16} /> Logout
            </span>
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass m-4 mb-0 flex items-center justify-between px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
              <Store size={18} />
            </span>
            <span className="font-bold text-primary">{business?.name || 'My Business'}</span>
          </div>
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
