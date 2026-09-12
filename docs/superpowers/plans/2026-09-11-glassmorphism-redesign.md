# Glassmorphism Depth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the app's light glassmorphism UI into a rich, detailed, modern visual system while keeping the green/mint brand: multi-blob gradient background, upgraded glass panels with combined ambient+inset shadows, lucide-react SVG icons replacing every emoji, status badges, styled tables, skeleton loaders, and polished empty states — across the app shell and all 14 pages. Visual depth pass only: no routes, logic, API, or server changes.

**Architecture:** Approach 1 (approved): design tokens in `client/tailwind.config.js` + CSS component classes in `client/src/index.css` `@layer components`; pages apply the classes and lucide icons directly. No shared-component extraction. The background is a pure-CSS multi-blob gradient stack on `body` (no blob DOM elements). Tailwind shadow utilities cannot stack, so `shadow-glass` / `shadow-glass-lg` are single combined `box-shadow` values (ambient + inset top highlight).

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3.4 (existing) + `lucide-react` (new, only new dependency). Tests: Vitest + React Testing Library (existing suites must stay green and unmodified, except `theme.test.jsx` which is extended and `AppShell.test.jsx` whose staff-role assertions are scoped to the nav — see Task 2 Step 3).

**Spec:** `docs/superpowers/specs/2026-09-11-glassmorphism-redesign-design.md` (approved). Visual reference: `docs/ui-style-guide.md` (already documents the target state).

## Global Constraints

- **Visual-only pass.** Do not change routes, handlers, API calls, payloads, validation, or any server file. Do not rename props, state, or exported components.
- **Existing tests must pass UNCHANGED**, except `client/src/theme.test.jsx` (extended with new assertions only) and `client/src/components/AppShell.test.jsx` (staff-role assertions scoped to the nav via `within`, because the new sidebar footer renders the user's name, which can collide with whole-screen text queries — see Task 2 Step 3). Tests query by text/role/label — therefore **button texts, link texts, labels, and rendered values must stay byte-identical** (e.g. `Record sale`, `Khata`, `Low stock`, `Current plan`, `₹1,400`, `completed`, `cash`).
- **No browser testing by the agent (user rule).** Verify with Vitest (jsdom) + eslint; the user visually verifies via the already-running dev server (client on :5173).
- **No emoji anywhere in `client/src` after this plan.** All icons come from `lucide-react`.
- **No motion** beyond the `.skeleton` shimmer (`animate-pulse`). No transforms, lifts, tilts, or page transitions. Color/shadow `transition` utilities are allowed (they animate properties, not position).
- **Exact token values** (combined shadows — Tailwind shadow utilities cannot stack):
  - `shadow-glass`: `0 8px 32px 0 rgba(31, 38, 135, 0.10), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)`
  - `shadow-glass-lg`: `0 12px 40px 0 rgba(31, 38, 135, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)`
  - `shadow-btn-glow`: `0 4px 16px 0 rgba(46, 125, 50, 0.30)`
- **Pseudo-state styles in `index.css` are written as separate plain rules** (e.g. `.glass-card:hover { … }`), not `hover:` variants inside `@apply` — zero-risk compilation.
- **SaleDetail's invoice card stays white and print-optimized** (`bg-white p-10 print:p-0`, `print:hidden` chrome). Only its page chrome (header, loading) is restyled. Never apply `.glass-table` or translucent backgrounds to the printable invoice.
- **Icon name collision:** in `Settings.jsx` import the lucide icon as `Settings as SettingsIcon` (the page component is already named `Settings`).
- Shell is Windows cmd. Commands run from repo root `e:/client_projects/acc-app-shubham` unless noted; chain with `&&`. Test commands: `npm run test:client` (all), `cd client && npx vitest run <files>` (targeted), `cd client && npx eslint .` (lint).
- Commit after every green task using conventional commits (`feat:`, `docs:`). Work on the current branch (`feature/foundation`).
- lucide icon sizes: 20 nav, 24 page headers, 24 stat cards, 28 empty states, 16 inline (Check/LogOut).

---

### Task 1: Design system foundation — lucide-react, tokens, component classes

**Files:**
- Modify: `client/package.json` (via npm — adds `lucide-react`)
- Modify: `client/tailwind.config.js`
- Modify: `client/src/index.css`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: tokens `shadow-glass` (combined), `shadow-glass-lg` (combined), `shadow-btn-glow`; CSS component classes `.glass`, `.glass-card`, `.glass-input`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.badge` + `.badge-success/-danger/-warning/-neutral`, `.skeleton`, `.empty-state`, `.glass-table` (with `thead th` / `tbody tr` / `tbody td` descendant rules); multi-blob fixed background on `body`. No page uses them yet — this task is purely additive, all existing tests stay green.

- [ ] **Step 1: Install lucide-react**

```bash
cd client && npm install lucide-react
```

- [ ] **Step 2: Replace `client/tailwind.config.js` with the full new content**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2E7D32',
        accent: '#4CAF50',
        mint: '#E8F5E9',
        sage: '#F1F8F2',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.10), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)',
        'glass-lg': '0 12px 40px 0 rgba(31, 38, 135, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)',
        'btn-glow': '0 4px 16px 0 rgba(46, 125, 50, 0.30)',
      },
      backgroundImage: {
        'app-gradient': 'linear-gradient(135deg, #E8F5E9 0%, #F1F8F2 100%)',
      },
    },
  },
  plugins: [],
};
```

Note: `shadow-glass` and `shadow-glass-lg` are single combined values (ambient + inset). Never stack two shadow utilities on one element.

- [ ] **Step 3: Replace `client/src/index.css` with the full new content**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply min-h-screen text-gray-800 antialiased;
    background-color: #E8F5E9;
    background-image:
      radial-gradient(ellipse 60% 50% at 15% 10%, rgba(76, 175, 80, 0.20), transparent 70%),
      radial-gradient(ellipse 50% 45% at 90% 50%, rgba(64, 140, 255, 0.14), transparent 70%),
      radial-gradient(ellipse 55% 45% at 10% 90%, rgba(167, 139, 250, 0.14), transparent 70%),
      radial-gradient(ellipse 50% 40% at 85% 90%, rgba(77, 208, 190, 0.12), transparent 70%),
      linear-gradient(135deg, #E8F5E9 0%, #F1F8F2 100%);
    background-attachment: fixed;
  }
}

@layer components {
  .glass {
    @apply rounded-2xl border border-white/60 bg-white/55 shadow-glass backdrop-blur-xl;
  }
  .glass-card {
    @apply block rounded-2xl border border-white/60 bg-white/55 shadow-glass backdrop-blur-xl transition duration-200;
  }
  .glass-card:hover {
    @apply bg-white/70 shadow-glass-lg;
  }
  .glass-input {
    @apply w-full rounded-xl border border-white/70 bg-white/70 px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30;
  }
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent px-4 py-2.5 font-semibold text-white shadow-btn-glow transition;
  }
  .btn-primary:hover {
    @apply brightness-110;
  }
  .btn-ghost {
    @apply inline-flex items-center justify-center gap-2 rounded-xl border border-white/60 px-4 py-2.5 font-semibold text-primary transition;
  }
  .btn-ghost:hover {
    @apply bg-white/60;
  }
  .btn-danger {
    @apply inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/90 px-4 py-2.5 font-semibold text-white transition;
  }
  .btn-danger:hover {
    @apply bg-red-500;
  }
  .badge {
    @apply inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold;
  }
  .badge-success {
    @apply bg-green-100/80 text-green-700;
  }
  .badge-danger {
    @apply bg-red-100/80 text-red-700;
  }
  .badge-warning {
    @apply bg-amber-100/80 text-amber-700;
  }
  .badge-neutral {
    @apply bg-white/60 text-gray-600;
  }
  .skeleton {
    @apply animate-pulse rounded-xl bg-white/50;
  }
  .empty-state {
    @apply flex flex-col items-center gap-2 py-10 text-center;
  }
  .glass-table {
    @apply w-full text-sm;
  }
  .glass-table thead th {
    @apply bg-white/40 pb-3 text-left text-xs uppercase tracking-wide text-gray-500;
  }
  .glass-table tbody tr {
    @apply border-t border-white/50;
  }
  .glass-table tbody tr:hover {
    @apply bg-white/40;
  }
  .glass-table tbody td {
    @apply py-3;
  }
}
```

Notes:
- The old `bg-app-gradient` on `body` is replaced by the explicit blob stack; the `app-gradient` token stays in the config (harmless, documented).
- `.glass-table` descendant rules mean page markup no longer needs per-cell `pb-3` / `py-3` / row border classes — utilities like `text-right` / `font-medium` still win because `@layer utilities` comes after `@layer components`.

- [ ] **Step 4: Run the full client test suite**

```bash
npm run test:client
```

Expected: all suites pass (nothing consumes the new classes yet; jsdom assertions are text/role-based).

- [ ] **Step 5: Commit**

```bash
git add client/package.json client/package-lock.json client/tailwind.config.js client/src/index.css && git commit -m "feat: add lucide-react and glass design system tokens and classes"
```

---

### Task 2: AppShell — lucide nav icons, plan badge, avatar footer, gradient active nav + theme test extension

**Files:**
- Modify: `client/src/components/AppShell.jsx`
- Modify: `client/src/theme.test.jsx`
- Modify: `client/src/components/AppShell.test.jsx`

**Interfaces:**
- Consumes: `.glass`, `.badge*`, `.btn-ghost`, `shadow-btn-glow` (Task 1); `lucide-react` icons `Store`, `LayoutDashboard`, `Receipt`, `Wallet`, `Users`, `Truck`, `Package`, `BarChart3`, `UserCog`, `Settings`, `Crown`, `LogOut`
- Produces: same nav routes/labels/role filtering as before; sidebar now renders an SVG per nav item, a plan badge (`Free plan` / `Pro plan`), and a user footer (initials avatar, name, role chip). `AppShell.test.jsx` keeps its assertions (`Dashboard`…`Subscription` labels, `Owner Shop`, owner-only filtering) with the staff-role queries scoped to the nav (Step 3), because the new footer renders the user's name and the staff mock's name is `Staff`, which would otherwise collide with the whole-screen `queryByText('Staff')`.

- [ ] **Step 1: Replace `client/src/components/AppShell.jsx` with the full new content**

```jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  LayoutDashboard,
  Receipt,
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
```

- [ ] **Step 2: Replace `client/src/theme.test.jsx` with the full new content**

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import AppShell from './components/AppShell';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({ user: null, business: null, logout: vi.fn() }),
}));

describe('theme wiring smoke test', () => {
  it('renders a themed app shell with the default business name', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );
    expect(screen.getAllByText('My Business').length).toBeGreaterThan(0);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders the glass sidebar with lucide svg icons', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );
    const sidebar = document.querySelector('aside');
    expect(sidebar).not.toBeNull();
    expect(sidebar.className).toContain('glass');
    expect(sidebar.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('renders the plan chip as a badge', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>
    );
    const chip = screen.getByText('Free plan');
    expect(chip.className).toContain('badge');
  });
});
```

- [ ] **Step 3: Replace `client/src/components/AppShell.test.jsx` with the full new content**

The new sidebar footer renders the signed-in user's name, and this suite's staff mock uses `name: 'Staff'` — a whole-screen `queryByText('Staff')` would match the footer paragraph instead of asserting nav filtering. Scope the owner-only assertions to the nav (the test's intent) with `within`; the owner test is unchanged:

```jsx
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppShell from './AppShell';

const mockAuth = {
  user: { role: 'owner', name: 'Owner' },
  business: { name: 'Owner Shop', plan: 'free' },
  logout: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const renderShell = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<AppShell />} />
      </Routes>
    </MemoryRouter>
  );

describe('AppShell', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows all nav items for owner', () => {
    renderShell();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Suppliers')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getAllByText('Owner Shop').length).toBeGreaterThan(0);
  });

  it('hides owner-only nav items for staff', () => {
    mockAuth.user = { role: 'staff', name: 'Staff' };
    renderShell();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('Sales')).toBeInTheDocument();
    expect(within(nav).queryByText('Reports')).toBeNull();
    expect(within(nav).queryByText('Staff')).toBeNull();
    expect(within(nav).queryByText('Settings')).toBeNull();
    expect(within(nav).queryByText('Subscription')).toBeNull();
    mockAuth.user = { role: 'owner', name: 'Owner' };
  });
});
```

- [ ] **Step 4: Run the targeted tests, then the full suite**

```bash
cd client && npx vitest run src/components/AppShell.test.jsx src/theme.test.jsx
```

```bash
npm run test:client
```

Expected: all pass. (`My Business` still renders in sidebar + mobile header; nav labels are direct text nodes of the `NavLink`s, so `getByText('Dashboard')` etc. still match; owner-only filtering unchanged. In `AppShell.test.jsx`, the staff-role assertions are scoped to the nav, so the footer's `Staff` user name no longer collides with `queryByText('Staff')`.)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AppShell.jsx client/src/theme.test.jsx client/src/components/AppShell.test.jsx && git commit -m "feat: restyle app shell with lucide icons, badges, and gradient nav"
```

---

### Task 3: Loading screen + auth pages (Login, Register)

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/pages/Login.jsx`
- Modify: `client/src/pages/Register.jsx`

**Interfaces:**
- Consumes: `.glass`, `.skeleton`, `.btn-primary` (Task 1); icons `LogIn`, `UserPlus`
- Produces: glass loading card with skeleton blocks; auth cards with gradient icon headers. `App.test.jsx` (`heading /welcome back/i`) and `authPages.test.jsx` (labels, `/sign in/`, `/create account/`, error text) remain satisfied — form fields, ids, and button texts unchanged.

- [ ] **Step 1: In `client/src/App.jsx`, replace the loading block**

Replace:

```jsx
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="glass px-8 py-4 font-medium text-primary">Loading…</div>
        </div>
      );
    }
```

With:

```jsx
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="glass w-full max-w-md p-8">
            <div className="skeleton h-9 w-44" />
            <div className="skeleton mt-4 h-4 w-60" />
          </div>
        </div>
      );
    }
```

- [ ] **Step 2: In `client/src/pages/Login.jsx`, add the icon import and replace the header**

After the existing `import { useAuth } from '../context/AuthContext';` line add:

```jsx
import { LogIn } from 'lucide-react';
```

Replace:

```jsx
        <h1 className="text-2xl font-bold text-primary">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in to your business account</p>
```

With:

```jsx
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-btn-glow">
            <LogIn size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-primary">Welcome back</h1>
            <p className="text-sm text-gray-600">Sign in to your business account</p>
          </div>
        </div>
```

Leave the error block, form fields, submit button, and footer link exactly as they are.

- [ ] **Step 3: In `client/src/pages/Register.jsx`, add the icon import and replace the header**

After the existing `import { useAuth } from '../context/AuthContext';` line add:

```jsx
import { UserPlus } from 'lucide-react';
```

Replace:

```jsx
        <h1 className="text-2xl font-bold text-primary">Create your account</h1>
        <p className="mt-1 text-sm text-gray-600">Set up your business in under a minute</p>
```

With:

```jsx
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-btn-glow">
            <UserPlus size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-primary">Create your account</h1>
            <p className="text-sm text-gray-600">Set up your business in under a minute</p>
          </div>
        </div>
```

Leave the error block, form fields, submit button, and footer link exactly as they are.

- [ ] **Step 4: Run the targeted tests, then commit**

```bash
cd client && npx vitest run src/App.test.jsx src/pages/authPages.test.jsx
```

```bash
git add client/src/App.jsx client/src/pages/Login.jsx client/src/pages/Register.jsx && git commit -m "feat: restyle loading screen and auth pages with glass depth"
```

---

### Task 4: Dashboard — glass stat cards, icons, gradient toggle, skeleton grid

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `.glass-card`, `.btn-primary`, `.btn-ghost`, `.skeleton`, `shadow-btn-glow` (Task 1); icons `LayoutDashboard`, `TrendingUp`, `TrendingDown`, `PiggyBank`, `IndianRupee`, `BookOpen`, `Landmark`
- Produces: six `.glass-card` stat cards with tinted icon squares; segmented range toggle with gradient active segment; skeleton grid while loading; quick actions with one `.btn-primary` + three `.btn-ghost`. `Dashboard.test.jsx` (`₹1,400` etc., `/this month/` button, `Summary unavailable` error) remains satisfied — values, labels, and error block unchanged.

- [ ] **Step 1: Add the icon import**

After the existing `import { formatINR } from '../utils/money';` line add:

```jsx
import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    PiggyBank,
    IndianRupee,
    BookOpen,
    Landmark,
} from 'lucide-react';
```

- [ ] **Step 2: Replace the CARDS array**

Replace:

```jsx
const CARDS = [
    { key: 'salesTotal', label: 'Sales', to: '/sales', color: 'text-green-600' },
    { key: 'expensesTotal', label: 'Expenses', to: '/expenses', color: 'text-red-600' },
    { key: 'profit', label: 'Profit', to: '/reports', color: 'text-primary' },
    { key: 'cashBalance', label: 'Cash balance', to: '/dashboard', color: 'text-blue-600' },
    { key: 'receivable', label: 'To collect (khata)', to: '/customers', color: 'text-orange-600' },
    { key: 'payable', label: 'To pay (suppliers)', to: '/suppliers', color: 'text-red-700' },
];
```

With:

```jsx
const CARDS = [
    { key: 'salesTotal', label: 'Sales', to: '/sales', color: 'text-green-600', icon: TrendingUp },
    { key: 'expensesTotal', label: 'Expenses', to: '/expenses', color: 'text-red-600', icon: TrendingDown },
    { key: 'profit', label: 'Profit', to: '/reports', color: 'text-primary', icon: PiggyBank },
    { key: 'cashBalance', label: 'Cash balance', to: '/dashboard', color: 'text-blue-600', icon: IndianRupee },
    { key: 'receivable', label: 'To collect (khata)', to: '/customers', color: 'text-orange-600', icon: BookOpen },
    { key: 'payable', label: 'To pay (suppliers)', to: '/suppliers', color: 'text-red-700', icon: Landmark },
];
```

- [ ] **Step 3: Replace the page header + range toggle**

Replace:

```jsx
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
                <div className="glass flex gap-2 p-1">
                    <button
                        type="button"
                        onClick={() => setRange('today')}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${range === 'today' ? 'bg-primary text-white' : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setRange('month')}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${range === 'month' ? 'bg-primary text-white' : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        This month
                    </button>
                </div>
            </div>
```

With:

```jsx
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <LayoutDashboard size={24} className="text-primary" />
                    </span>
                    Dashboard
                </h1>
                <div className="glass flex gap-2 p-1">
                    <button
                        type="button"
                        onClick={() => setRange('today')}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${range === 'today'
                                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-btn-glow'
                                : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setRange('month')}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${range === 'month'
                                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-btn-glow'
                                : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        This month
                    </button>
                </div>
            </div>
```

- [ ] **Step 4: Replace the loading line**

Replace:

```jsx
            {loading && <div className="glass p-6 text-center text-gray-500">Loading summary…</div>}
```

With:

```jsx
            {loading && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="skeleton h-32" />
                    ))}
                </div>
            )}
```

- [ ] **Step 5: Replace the stat card map**

Replace:

```jsx
                    {CARDS.map(({ key, label, to, color }) => (
                        <Link key={key} to={to} className="glass block p-6 transition hover:shadow-lg">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                            <p className={`mt-2 text-3xl font-bold ${color}`}>{formatINR(summary[key])}</p>
                            {key === 'profit' && (
                                <p className="mt-1 text-xs text-gray-400">Sales − expenses for the period</p>
                            )}
                        </Link>
                    ))}
```

With:

```jsx
                    {CARDS.map(({ key, label, to, color, icon: Icon }) => (
                        <Link key={key} to={to} className="glass-card block p-6">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                                <span className="rounded-xl bg-white/60 p-2.5">
                                    <Icon size={24} className={color} />
                                </span>
                            </div>
                            <p className={`mt-2 text-3xl font-bold ${color}`}>{formatINR(summary[key])}</p>
                            {key === 'profit' && (
                                <p className="mt-1 text-xs text-gray-400">Sales − expenses for the period</p>
                            )}
                        </Link>
                    ))}
```

- [ ] **Step 6: Replace the quick-action links**

Replace:

```jsx
                    <div className="mt-4 flex flex-wrap gap-3">
                        <Link to="/sales" className="btn-primary">+ New sale</Link>
                        <Link to="/expenses" className="btn-primary">+ Add expense</Link>
                        <Link to="/customers" className="btn-primary">Customer khata</Link>
                        <Link to="/products" className="btn-primary">Products</Link>
                    </div>
```

With:

```jsx
                    <div className="mt-4 flex flex-wrap gap-3">
                        <Link to="/sales" className="btn-primary">+ New sale</Link>
                        <Link to="/expenses" className="btn-ghost">+ Add expense</Link>
                        <Link to="/customers" className="btn-ghost">Customer khata</Link>
                        <Link to="/products" className="btn-ghost">Products</Link>
                    </div>
```

- [ ] **Step 7: Run the targeted tests, then commit**

```bash
cd client && npx vitest run src/pages/Dashboard.test.jsx
```

```bash
git add client/src/pages/Dashboard.jsx && git commit -m "feat: restyle dashboard with glass cards, icons, and skeletons"
```

---

### Task 5: Sales + SaleDetail — glass table, badges, skeleton, empty state

**Files:**
- Modify: `client/src/pages/Sales.jsx`
- Modify: `client/src/pages/SaleDetail.jsx`

**Interfaces:**
- Consumes: `.glass-table`, `.badge*`, `.btn-ghost`, `.btn-danger`, `.skeleton`, `.empty-state` (Task 1); icon `Receipt`
- Produces: sales list as `.glass-table` with `badge-neutral` payment, `badge-success`/`badge-danger` status, ghost/danger mini row actions, skeleton rows, `Receipt` empty state; SaleDetail page chrome (header icon + skeleton) restyled while the printable invoice card stays white and untouched. `Sales.test.jsx` (`INV-1`, `₹14`, `cash`, `completed`, labels, `/record sale/`, `/cancel/`, invoice fields, `/print invoice/`) remains satisfied.

- [ ] **Step 1: In `client/src/pages/Sales.jsx`, add the icon import**

After the existing `import { formatDate } from '../utils/format';` line add:

```jsx
import { Receipt } from 'lucide-react';
```

- [ ] **Step 2: Replace the page header**

Replace:

```jsx
            <h1 className="text-2xl font-bold text-primary">Sales</h1>
```

With:

```jsx
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Receipt size={24} className="text-primary" />
                </span>
                Sales
            </h1>
```

- [ ] **Step 3: Replace the list section (loading / empty / table)**

Replace:

```jsx
                {loading ? (
                    <p className="text-sm text-gray-500">Loading sales…</p>
                ) : sales.length === 0 ? (
                    <p className="text-sm text-gray-500">No sales yet. Record your first sale above.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-3">Invoice</th>
                                <th className="pb-3">Date</th>
                                <th className="pb-3">Items</th>
                                <th className="pb-3">Payment</th>
                                <th className="pb-3">Status</th>
                                <th className="pb-3 text-right">Total</th>
                                <th className="pb-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map((s) => (
                                <tr key={s.id} className="border-t border-white/50">
                                    <td className="py-3 font-medium">
                                        <Link
                                            to={`/sales/${s.id}`}
                                            className="text-primary hover:underline"
                                        >
                                            {s.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="py-3 text-gray-500">{formatDate(s.date)}</td>
                                    <td className="py-3 text-gray-500">
                                        {s.items.map((it) => `${it.name} × ${it.qty}`).join(', ')}
                                    </td>
                                    <td className="py-3">{s.paymentMethod}</td>
                                    <td className="py-3">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === 'cancelled'
                                                ? 'bg-red-100 text-red-600'
                                                : 'bg-green-100 text-green-700'
                                                }`}
                                        >
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right font-semibold">
                                        {formatINR(s.total)}
                                    </td>
                                    <td className="py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                to={`/sales/${s.id}`}
                                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-white/70"
                                            >
                                                Invoice
                                            </Link>
                                            {s.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleCancel(s.id)}
                                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
```

With:

```jsx
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : sales.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Receipt size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No sales yet</p>
                        <p className="text-sm text-gray-500">Record your first sale above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Invoice</th>
                                <th>Date</th>
                                <th>Items</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map((s) => (
                                <tr key={s.id}>
                                    <td className="font-medium">
                                        <Link
                                            to={`/sales/${s.id}`}
                                            className="text-primary hover:underline"
                                        >
                                            {s.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="text-gray-500">{formatDate(s.date)}</td>
                                    <td className="text-gray-500">
                                        {s.items.map((it) => `${it.name} × ${it.qty}`).join(', ')}
                                    </td>
                                    <td>
                                        <span className="badge badge-neutral">{s.paymentMethod}</span>
                                    </td>
                                    <td>
                                        <span
                                            className={`badge ${s.status === 'cancelled' ? 'badge-danger' : 'badge-success'}`}
                                        >
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="text-right font-semibold">
                                        {formatINR(s.total)}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                to={`/sales/${s.id}`}
                                                className="btn-ghost px-3 py-1.5 text-xs"
                                            >
                                                Invoice
                                            </Link>
                                            {s.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleCancel(s.id)}
                                                    className="btn-danger px-3 py-1.5 text-xs"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
```

Leave the "New sale" form section and error block exactly as they are.

- [ ] **Step 4: In `client/src/pages/SaleDetail.jsx`, add the icon import**

After the existing `import { formatDate } from '../utils/format';` line add:

```jsx
import { Receipt } from 'lucide-react';
```

- [ ] **Step 5: Replace the SaleDetail page header**

Replace:

```jsx
            <div className="flex items-center justify-between print:hidden">
                <h1 className="text-2xl font-bold text-primary">Invoice</h1>
```

With:

```jsx
            <div className="flex items-center justify-between print:hidden">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <Receipt size={24} className="text-primary" />
                    </span>
                    Invoice
                </h1>
```

- [ ] **Step 6: Replace the SaleDetail loading block**

Replace:

```jsx
            {loading ? (
                <p className="text-sm text-gray-500">Loading invoice…</p>
```

With:

```jsx
            {loading ? (
                <div className="glass mx-auto max-w-3xl p-10">
                    <div className="skeleton h-8 w-48" />
                    <div className="skeleton mt-6 h-40" />
                </div>
```

Do NOT touch the invoice card (`<div ref={printRef} className="glass mx-auto max-w-3xl bg-white p-10 print:p-0">`) or its inner table — they are print-optimized and stay white/opaque by design.

- [ ] **Step 7: Run the targeted tests, then commit**

```bash
cd client && npx vitest run src/pages/Sales.test.jsx
```

```bash
git add client/src/pages/Sales.jsx client/src/pages/SaleDetail.jsx && git commit -m "feat: restyle sales list and invoice chrome with glass depth"
```

---

### Task 6: Expenses + Products — glass tables, badges, skeletons, empty states

**Files:**
- Modify: `client/src/pages/Expenses.jsx`
- Modify: `client/src/pages/Products.jsx`

**Interfaces:**
- Consumes: `.glass-table`, `.badge-warning`, `.badge-neutral`, `.btn-ghost`, `.btn-danger`, `.skeleton`, `.empty-state` (Task 1); icons `Wallet`, `Package`
- Produces: both pages with icon headers, `.glass-table` lists, `badge-neutral` payment methods, `badge-warning` low-stock flag, ghost/danger mini actions, skeleton rows, empty states. `Expenses.test.jsx` and `Products.test.jsx` (`rent`, `₹1,500`, `Low stock`, `40`, labels, `/add expense/`, `/add product/`, `/edit/`, `/save changes/`, `/delete/`) remain satisfied.

- [ ] **Step 1: In `client/src/pages/Expenses.jsx`, add the icon import**

After the existing `import { formatDate } from '../utils/format';` line add:

```jsx
import { Wallet } from 'lucide-react';
```

- [ ] **Step 2: Replace the Expenses page header**

Replace:

```jsx
            <h1 className="text-2xl font-bold text-primary">Expenses</h1>
```

With:

```jsx
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Wallet size={24} className="text-primary" />
                </span>
                Expenses
            </h1>
```

- [ ] **Step 3: Replace the Expenses list section**

Replace:

```jsx
                {loading ? (
                    <p className="text-sm text-gray-500">Loading expenses…</p>
                ) : expenses.length === 0 ? (
                    <p className="text-sm text-gray-500">No expenses yet. Add your first expense above.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-3">Date</th>
                                <th className="pb-3">Category</th>
                                <th className="pb-3">Note</th>
                                <th className="pb-3">Payment</th>
                                <th className="pb-3 text-right">Amount</th>
                                {isOwner && <th className="pb-3 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((e) => (
                                <tr key={e.id} className="border-t border-white/50">
                                    <td className="py-3 text-gray-500">{formatDate(e.date)}</td>
                                    <td className="py-3 font-medium">{e.category}</td>
                                    <td className="py-3 text-gray-500">{e.note || '—'}</td>
                                    <td className="py-3">{e.paymentMethod}</td>
                                    <td className="py-3 text-right font-semibold text-red-600">
                                        {formatINR(e.amount)}
                                    </td>
                                    {isOwner && (
                                        <td className="py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(e.id)}
                                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
```

With:

```jsx
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Wallet size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No expenses yet</p>
                        <p className="text-sm text-gray-500">Add your first expense above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Note</th>
                                <th>Payment</th>
                                <th className="text-right">Amount</th>
                                {isOwner && <th className="text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((e) => (
                                <tr key={e.id}>
                                    <td className="text-gray-500">{formatDate(e.date)}</td>
                                    <td className="font-medium">{e.category}</td>
                                    <td className="text-gray-500">{e.note || '—'}</td>
                                    <td>
                                        <span className="badge badge-neutral">{e.paymentMethod}</span>
                                    </td>
                                    <td className="text-right font-semibold text-red-600">
                                        {formatINR(e.amount)}
                                    </td>
                                    {isOwner && (
                                        <td className="text-right">
                                            <button
                                                onClick={() => handleDelete(e.id)}
                                                className="btn-danger px-3 py-1.5 text-xs"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
```

Leave the "Add expense" form and error block exactly as they are.

- [ ] **Step 4: In `client/src/pages/Products.jsx`, add the icon import**

After the existing `import { formatDate } from '../utils/format';` line add:

```jsx
import { Package } from 'lucide-react';
```

- [ ] **Step 5: Replace the Products page header**

Replace:

```jsx
            <h1 className="text-2xl font-bold text-primary">Products</h1>
```

With:

```jsx
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Package size={24} className="text-primary" />
                </span>
                Products
            </h1>
```

- [ ] **Step 6: Replace the Products cancel-edit button**

Replace:

```jsx
                        {editingId && (
                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-xl px-4 py-2.5 font-semibold text-gray-600 hover:bg-white/70"
                            >
                                Cancel
                            </button>
                        )}
```

With:

```jsx
                        {editingId && (
                            <button type="button" onClick={cancelEdit} className="btn-ghost">
                                Cancel
                            </button>
                        )}
```

- [ ] **Step 7: Replace the Products list section**

Replace:

```jsx
                {loading ? (
                    <p className="text-sm text-gray-500">Loading products…</p>
                ) : products.length === 0 ? (
                    <p className="text-sm text-gray-500">No products yet. Add your first product above.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-3">Name</th>
                                <th className="pb-3">SKU</th>
                                <th className="pb-3">Purchase</th>
                                <th className="pb-3">Selling</th>
                                <th className="pb-3">Stock</th>
                                <th className="pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => {
                                const low = p.lowStock ?? p.stockQty <= (p.lowStockThreshold ?? 5);
                                return (
                                    <tr key={p.id} className="border-t border-white/50">
                                        <td className="py-3 font-medium">{p.name}</td>
                                        <td className="py-3 text-gray-500">{p.sku || '—'}</td>
                                        <td className="py-3">{formatINR(p.purchasePrice)}</td>
                                        <td className="py-3">{formatINR(p.sellingPrice)}</td>
                                        <td className="py-3">
                                            {p.stockQty}
                                            {low && (
                                                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                                                    Low stock
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => startEdit(p)}
                                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-white/70"
                                                >
                                                    Edit
                                                </button>
                                                {isOwner && (
                                                    <button
                                                        onClick={() => handleDelete(p.id)}
                                                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
```

With:

```jsx
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Package size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No products yet</p>
                        <p className="text-sm text-gray-500">Add your first product above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>SKU</th>
                                <th>Purchase</th>
                                <th>Selling</th>
                                <th>Stock</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => {
                                const low = p.lowStock ?? p.stockQty <= (p.lowStockThreshold ?? 5);
                                return (
                                    <tr key={p.id}>
                                        <td className="font-medium">{p.name}</td>
                                        <td className="text-gray-500">{p.sku || '—'}</td>
                                        <td>{formatINR(p.purchasePrice)}</td>
                                        <td>{formatINR(p.sellingPrice)}</td>
                                        <td>
                                            {p.stockQty}
                                            {low && (
                                                <span className="badge badge-warning ml-2">Low stock</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => startEdit(p)}
                                                    className="btn-ghost px-3 py-1.5 text-xs"
                                                >
                                                    Edit
                                                </button>
                                                {isOwner && (
                                                    <button
                                                        onClick={() => handleDelete(p.id)}
                                                        className="btn-danger px-3 py-1.5 text-xs"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
```

Leave the product form and error block exactly as they are.

- [ ] **Step 8: Run the targeted tests, then commit**

```bash
cd client && npx vitest run src/pages/Expenses.test.jsx src/pages/Products.test.jsx
```

```bash
git add client/src/pages/Expenses.jsx client/src/pages/Products.jsx && git commit -m "feat: restyle expenses and products pages with glass depth"
```

---

### Task 7: Customers + CustomerDetail + Suppliers + SupplierDetail — khata/parties glass pass

**Files:**
- Modify: `client/src/pages/Customers.jsx`
- Modify: `client/src/pages/CustomerDetail.jsx`
- Modify: `client/src/pages/Suppliers.jsx`
- Modify: `client/src/pages/SupplierDetail.jsx`

**Interfaces:**
- Consumes: `.glass-table`, `.badge-success`, `.badge-danger`, `.badge-neutral`, `.btn-ghost`, `.btn-danger`, `.skeleton`, `.empty-state` (Task 1); icons `Users`, `BookOpen`, `Truck`, `Landmark`
- Produces: party lists as `.glass-table` with ghost/danger mini actions; detail pages with icon headers, balance cards with icon tiles, statement tables with type badges (`Credit (udhaar)` → danger, `Payment` → success; supplier `Purchase` → neutral), skeletons, empty states. `Customers.test.jsx` / `Suppliers.test.jsx` (names, `₹1,250`, `+₹20`, `-₹5`, running balances, labels, `/add customer/`, `/add supplier/`, `/khata/` + `/statement/` links, `/record payment/`, `/record purchase/`) remain satisfied.

- [ ] **Step 1: In `client/src/pages/Customers.jsx`, add the icon import**

After the existing `import { formatINR } from '../utils/money';` line add:

```jsx
import { Users } from 'lucide-react';
```

- [ ] **Step 2: Replace the Customers page header**

Replace:

```jsx
            <h1 className="text-2xl font-bold text-primary">Customers</h1>
```

With:

```jsx
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Users size={24} className="text-primary" />
                </span>
                Customers
            </h1>
```

- [ ] **Step 3: Replace the Customers list section**

Replace:

```jsx
                {loading ? (
                    <p className="text-sm text-gray-500">Loading customers…</p>
                ) : customers.length === 0 ? (
                    <p className="text-sm text-gray-500">No customers yet. Add your first customer above.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-3">Name</th>
                                <th className="pb-3">Phone</th>
                                <th className="pb-3">Balance (to receive)</th>
                                <th className="pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((c) => (
                                <tr key={c.id} className="border-t border-white/50">
                                    <td className="py-3 font-medium">{c.name}</td>
                                    <td className="py-3 text-gray-500">{c.phone || '—'}</td>
                                    <td
                                        className={`py-3 font-semibold ${c.balance > 0 ? 'text-red-600' : 'text-green-600'
                                            }`}
                                    >
                                        {formatINR(c.balance)}
                                    </td>
                                    <td className="py-3">
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/customers/${c.id}`}
                                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-white/70"
                                            >
                                                Khata
                                            </Link>
                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
```

With:

```jsx
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : customers.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Users size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No customers yet</p>
                        <p className="text-sm text-gray-500">Add your first customer above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Balance (to receive)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((c) => (
                                <tr key={c.id}>
                                    <td className="font-medium">{c.name}</td>
                                    <td className="text-gray-500">{c.phone || '—'}</td>
                                    <td
                                        className={`font-semibold ${c.balance > 0 ? 'text-red-600' : 'text-green-600'
                                            }`}
                                    >
                                        {formatINR(c.balance)}
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/customers/${c.id}`}
                                                className="btn-ghost px-3 py-1.5 text-xs"
                                            >
                                                Khata
                                            </Link>
                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="btn-danger px-3 py-1.5 text-xs"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
```

Leave the "Add customer" form and error block exactly as they are.

- [ ] **Step 4: In `client/src/pages/CustomerDetail.jsx`, add the icon import**

After the existing `import { formatDate } from '../utils/format';` line add:

```jsx
import { Users, BookOpen } from 'lucide-react';
```

- [ ] **Step 5: Replace the CustomerDetail page header**

Replace:

```jsx
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-primary">
                    {data ? data.customer.name : 'Khata'}
                </h1>
```

With:

```jsx
            <div className="flex items-center justify-between">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <Users size={24} className="text-primary" />
                    </span>
                    {data ? data.customer.name : 'Khata'}
                </h1>
```

- [ ] **Step 6: Replace the CustomerDetail loading block**

Replace:

```jsx
            {loading ? (
                <p className="text-sm text-gray-500">Loading khata…</p>
```

With:

```jsx
            {loading ? (
                <div className="space-y-6">
                    <div className="skeleton h-24" />
                    <div className="skeleton h-40" />
                </div>
```

- [ ] **Step 7: Replace the CustomerDetail balance card**

Replace:

```jsx
                        <div className="glass p-6">
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                                Khata balance (to receive)
                            </p>
                            <p className="mt-1 text-3xl font-bold text-primary">
                                {formatINR(data.balance)}
                            </p>
                        </div>
```

With:

```jsx
                        <div className="glass flex items-center justify-between p-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Khata balance (to receive)
                                </p>
                                <p className="mt-1 text-3xl font-bold text-primary">
                                    {formatINR(data.balance)}
                                </p>
                            </div>
                            <span className="rounded-2xl bg-white/60 p-3">
                                <BookOpen size={28} className="text-primary" />
                            </span>
                        </div>
```

- [ ] **Step 8: Replace the CustomerDetail statement section (empty + table)**

Replace:

```jsx
                            {rows.length === 0 ? (
                                <p className="text-sm text-gray-500">No khata entries yet.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                            <th className="pb-3">Date</th>
                                            <th className="pb-3">Type</th>
                                            <th className="pb-3">Note</th>
                                            <th className="pb-3 text-right">Amount</th>
                                            <th className="pb-3 text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((entry) => (
                                            <tr key={entry.id} className="border-t border-white/50">
                                                <td className="py-3 text-gray-500">
                                                    {formatDate(entry.date)}
                                                </td>
                                                <td className="py-3 font-medium">
                                                    {entry.type === 'credit' ? 'Credit (udhaar)' : 'Payment'}
                                                </td>
                                                <td className="py-3 text-gray-500">{entry.note || '—'}</td>
                                                <td
                                                    className={`py-3 text-right font-semibold ${entry.type === 'credit' ? 'text-red-600' : 'text-green-600'
                                                        }`}
                                                >
                                                    {entry.type === 'credit'
                                                        ? `+${formatINR(entry.amount)}`
                                                        : `-${formatINR(entry.amount)}`}
                                                </td>
                                                <td className="py-3 text-right font-semibold">
                                                    {formatINR(entry.running)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
```

With:

```jsx
                            {rows.length === 0 ? (
                                <div className="empty-state">
                                    <span className="rounded-full bg-white/60 p-3">
                                        <BookOpen size={28} className="text-primary" />
                                    </span>
                                    <p className="font-semibold">No khata entries yet</p>
                                    <p className="text-sm text-gray-500">Credit sales and payments will appear here.</p>
                                </div>
                            ) : (
                                <table className="glass-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Note</th>
                                            <th className="text-right">Amount</th>
                                            <th className="text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((entry) => (
                                            <tr key={entry.id}>
                                                <td className="text-gray-500">
                                                    {formatDate(entry.date)}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`badge ${entry.type === 'credit' ? 'badge-danger' : 'badge-success'}`}
                                                    >
                                                        {entry.type === 'credit' ? 'Credit (udhaar)' : 'Payment'}
                                                    </span>
                                                </td>
                                                <td className="text-gray-500">{entry.note || '—'}</td>
                                                <td
                                                    className={`text-right font-semibold ${entry.type === 'credit' ? 'text-red-600' : 'text-green-600'
                                                        }`}
                                                >
                                                    {entry.type === 'credit'
                                                        ? `+${formatINR(entry.amount)}`
                                                        : `-${formatINR(entry.amount)}`}
                                                </td>
                                                <td className="text-right font-semibold">
                                                    {formatINR(entry.running)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
```

Leave the "Record payment" form and error block exactly as they are.

- [ ] **Step 9: In `client/src/pages/Suppliers.jsx`, add the icon import**

After the existing `import { formatINR } from '../utils/money';` line add:

```jsx
import { Truck } from 'lucide-react';
```

- [ ] **Step 10: Replace the Suppliers page header**

Replace:

```jsx
            <h1 className="text-2xl font-bold text-primary">Suppliers</h1>
```

With:

```jsx
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Truck size={24} className="text-primary" />
                </span>
                Suppliers
            </h1>
```

- [ ] **Step 11: Replace the Suppliers list section**

Replace:

```jsx
                {loading ? (
                    <p className="text-sm text-gray-500">Loading suppliers…</p>
                ) : suppliers.length === 0 ? (
                    <p className="text-sm text-gray-500">No suppliers yet. Add your first supplier above.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-3">Name</th>
                                <th className="pb-3">Phone</th>
                                <th className="pb-3">Payable</th>
                                <th className="pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((s) => (
                                <tr key={s.id} className="border-t border-white/50">
                                    <td className="py-3 font-medium">{s.name}</td>
                                    <td className="py-3 text-gray-500">{s.phone || '—'}</td>
                                    <td className="py-3 font-semibold text-red-600">
                                        {formatINR(s.balance)}
                                    </td>
                                    <td className="py-3">
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/suppliers/${s.id}`}
                                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-white/70"
                                            >
                                                Statement
                                            </Link>
                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDelete(s.id)}
                                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
```

With:

```jsx
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : suppliers.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Truck size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No suppliers yet</p>
                        <p className="text-sm text-gray-500">Add your first supplier above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Payable</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((s) => (
                                <tr key={s.id}>
                                    <td className="font-medium">{s.name}</td>
                                    <td className="text-gray-500">{s.phone || '—'}</td>
                                    <td className="font-semibold text-red-600">
                                        {formatINR(s.balance)}
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Link
                                                to={`/suppliers/${s.id}`}
                                                className="btn-ghost px-3 py-1.5 text-xs"
                                            >
                                                Statement
                                            </Link>
                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDelete(s.id)}
                                                    className="btn-danger px-3 py-1.5 text-xs"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
```

Leave the "Add supplier" form and error block exactly as they are.

- [ ] **Step 12: In `client/src/pages/SupplierDetail.jsx`, add the icon import**

After the existing `import { formatDate } from '../utils/format';` line add:

```jsx
import { Truck, Landmark } from 'lucide-react';
```

- [ ] **Step 13: Replace the SupplierDetail page header**

Replace:

```jsx
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-primary">
                    {data ? data.supplier.name : 'Supplier'}
                </h1>
```

With:

```jsx
            <div className="flex items-center justify-between">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <Truck size={24} className="text-primary" />
                    </span>
                    {data ? data.supplier.name : 'Supplier'}
                </h1>
```

- [ ] **Step 14: Replace the SupplierDetail loading block**

Replace:

```jsx
            {loading ? (
                <p className="text-sm text-gray-500">Loading statement…</p>
```

With:

```jsx
            {loading ? (
                <div className="space-y-6">
                    <div className="skeleton h-24" />
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="skeleton h-72" />
                        <div className="skeleton h-72" />
                    </div>
                </div>
```

- [ ] **Step 15: Replace the SupplierDetail balance card**

Replace:

```jsx
                        <div className="glass p-6">
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                                Payable balance
                            </p>
                            <p className="mt-1 text-3xl font-bold text-primary">
                                {formatINR(data.balance)}
                            </p>
                        </div>
```

With:

```jsx
                        <div className="glass flex items-center justify-between p-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Payable balance
                                </p>
                                <p className="mt-1 text-3xl font-bold text-primary">
                                    {formatINR(data.balance)}
                                </p>
                            </div>
                            <span className="rounded-2xl bg-white/60 p-3">
                                <Landmark size={28} className="text-primary" />
                            </span>
                        </div>
```

- [ ] **Step 16: Replace the SupplierDetail statement section (empty + table)**

Replace:

```jsx
                            {rows.length === 0 ? (
                                <p className="text-sm text-gray-500">No purchases or payments yet.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                            <th className="pb-3">Date</th>
                                            <th className="pb-3">Type</th>
                                            <th className="pb-3">Details</th>
                                            <th className="pb-3 text-right">Amount</th>
                                            <th className="pb-3 text-right">Payable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, i) => {
                                            const isPurchase = row.kind === 'purchase';
                                            const details = isPurchase
                                                ? row.purchase.items
                                                    .map((it) => `${it.name} × ${it.qty}`)
                                                    .join(', ')
                                                : row.payment.note || 'Payment';
                                            const credit = isPurchase && row.purchase.paymentMethod === 'credit';
                                            const amountText = isPurchase
                                                ? credit
                                                    ? `+${formatINR(row.purchase.total)}`
                                                    : `${formatINR(row.purchase.total)} (paid)`
                                                : `-${formatINR(row.payment.amount)}`;
                                            return (
                                                <tr key={isPurchase ? row.purchase.id : row.payment.id || i} className="border-t border-white/50">
                                                    <td className="py-3 text-gray-500">
                                                        {formatDate(row.date)}
                                                    </td>
                                                    <td className="py-3 font-medium">
                                                        {isPurchase ? 'Purchase' : 'Payment'}
                                                    </td>
                                                    <td className="py-3 text-gray-500">{details}</td>
                                                    <td
                                                        className={`py-3 text-right font-semibold ${credit || !isPurchase ? 'text-red-600' : 'text-gray-600'
                                                            }`}
                                                    >
                                                        {amountText}
                                                    </td>
                                                    <td className="py-3 text-right font-semibold">
                                                        {formatINR(row.running)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
```

With:

```jsx
                            {rows.length === 0 ? (
                                <div className="empty-state">
                                    <span className="rounded-full bg-white/60 p-3">
                                        <Truck size={28} className="text-primary" />
                                    </span>
                                    <p className="font-semibold">No purchases or payments yet</p>
                                    <p className="text-sm text-gray-500">Record a purchase or payment above.</p>
                                </div>
                            ) : (
                                <table className="glass-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Details</th>
                                            <th className="text-right">Amount</th>
                                            <th className="text-right">Payable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, i) => {
                                            const isPurchase = row.kind === 'purchase';
                                            const details = isPurchase
                                                ? row.purchase.items
                                                    .map((it) => `${it.name} × ${it.qty}`)
                                                    .join(', ')
                                                : row.payment.note || 'Payment';
                                            const credit = isPurchase && row.purchase.paymentMethod === 'credit';
                                            const amountText = isPurchase
                                                ? credit
                                                    ? `+${formatINR(row.purchase.total)}`
                                                    : `${formatINR(row.purchase.total)} (paid)`
                                                : `-${formatINR(row.payment.amount)}`;
                                            return (
                                                <tr key={isPurchase ? row.purchase.id : row.payment.id || i}>
                                                    <td className="text-gray-500">
                                                        {formatDate(row.date)}
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`badge ${isPurchase ? 'badge-neutral' : 'badge-success'}`}
                                                        >
                                                            {isPurchase ? 'Purchase' : 'Payment'}
                                                        </span>
                                                    </td>
                                                    <td className="text-gray-500">{details}</td>
                                                    <td
                                                        className={`text-right font-semibold ${credit || !isPurchase ? 'text-red-600' : 'text-gray-600'
                                                            }`}
                                                    >
                                                        {amountText}
                                                    </td>
                                                    <td className="text-right font-semibold">
                                                        {formatINR(row.running)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
```

Leave both record forms and the error block exactly as they are.

- [ ] **Step 17: Run the targeted tests, then commit**

```bash
cd client && npx vitest run src/pages/Customers.test.jsx src/pages/Suppliers.test.jsx
```

```bash
git add client/src/pages/Customers.jsx client/src/pages/CustomerDetail.jsx client/src/pages/Suppliers.jsx client/src/pages/SupplierDetail.jsx && git commit -m "feat: restyle customer and supplier pages with glass depth"
```

---

### Task 8: Reports + Staff + Settings + Subscription — owner pages glass pass

**Files:**
- Modify: `client/src/pages/Reports.jsx`
- Modify: `client/src/pages/Staff.jsx`
- Modify: `client/src/pages/Settings.jsx`
- Modify: `client/src/pages/Subscription.jsx`

**Interfaces:**
- Consumes: `.glass-card`, `.glass-table`, `.badge-success`, `.btn-primary`, `.btn-danger`, `.skeleton`, `shadow-btn-glow` (Task 1); icons `BarChart3`, `TrendingUp`, `TrendingDown`, `PiggyBank`, `BookOpen`, `Landmark`, `UserCog`, `Settings as SettingsIcon`, `Crown`, `Check`
- Produces: Reports with gradient tab segments, `.glass-card` stat tiles with icons, `.glass-table` outstanding lists; Staff with `.glass-table` and danger mini remove; Settings with icon header + skeleton; Subscription with gradient-border current plan card, `Check` feature icons, `badge-success` current-plan chip, skeleton cards. All four test suites (`Daily report`, amounts, `/run report/`, `/monthly/`, `/outstanding/`, staff emails/roles, settings labels, `/save changes/`, `Free`/`Pro`/`₹0`/`₹199`/`/current plan/`/`/upgrade to pro/`) remain satisfied.

- [ ] **Step 1: In `client/src/pages/Reports.jsx`, add the icon import**

After the existing `import { formatINR } from '../utils/money';` line add:

```jsx
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    PiggyBank,
    BookOpen,
    Landmark,
} from 'lucide-react';
```

- [ ] **Step 2: Replace the Reports page header**

Replace:

```jsx
            <h1 className="text-2xl font-bold text-primary">Reports</h1>
```

With:

```jsx
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <BarChart3 size={24} className="text-primary" />
                </span>
                Reports
            </h1>
```

- [ ] **Step 3: Replace the Reports tab toggle**

Replace:

```jsx
            <div className="glass flex flex-wrap gap-2 p-1">
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => handleTab(key)}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === key ? 'bg-primary text-white' : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
```

With:

```jsx
            <div className="glass flex flex-wrap gap-2 p-1">
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => handleTab(key)}
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === key
                                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-btn-glow'
                                : 'text-primary hover:bg-white/50'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
```

- [ ] **Step 4: Replace the Reports loading line**

Replace:

```jsx
            {loading && <div className="glass p-6 text-center text-gray-500">Loading report…</div>}
```

With:

```jsx
            {loading && (
                <div className="glass p-6">
                    <div className="skeleton h-8 w-40" />
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="skeleton h-24" />
                        <div className="skeleton h-24" />
                        <div className="skeleton h-24" />
                    </div>
                </div>
            )}
```

- [ ] **Step 5: Replace the daily report stat grid**

Replace:

```jsx
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales</p>
                            <p className="mt-2 text-2xl font-bold text-green-600">{formatINR(report.salesTotal)}</p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expenses</p>
                            <p className="mt-2 text-2xl font-bold text-red-600">{formatINR(report.expensesTotal)}</p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit</p>
                            <p className="mt-2 text-2xl font-bold text-primary">{formatINR(report.profit)}</p>
                        </div>
                    </div>
                </section>
            )}

            {report && !loading && tab === 'monthly' && (
```

With:

```jsx
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <TrendingUp size={20} className="text-green-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-green-600">{formatINR(report.salesTotal)}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expenses</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <TrendingDown size={20} className="text-red-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-red-600">{formatINR(report.expensesTotal)}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <PiggyBank size={20} className="text-primary" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-primary">{formatINR(report.profit)}</p>
                        </div>
                    </div>
                </section>
            )}

            {report && !loading && tab === 'monthly' && (
```

(The trailing context lines are identical in both blocks — they anchor the replacement to the **daily** grid, not the monthly one.)

- [ ] **Step 6: Replace the monthly report stat grid**

Replace:

```jsx
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales</p>
                            <p className="mt-2 text-2xl font-bold text-green-600">{formatINR(report.salesTotal)}</p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expenses</p>
                            <p className="mt-2 text-2xl font-bold text-red-600">{formatINR(report.expensesTotal)}</p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit</p>
                            <p className="mt-2 text-2xl font-bold text-primary">{formatINR(report.profit)}</p>
                        </div>
                    </div>
                </section>
            )}

            {report && !loading && tab === 'outstanding' && (
```

With:

```jsx
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <TrendingUp size={20} className="text-green-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-green-600">{formatINR(report.salesTotal)}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expenses</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <TrendingDown size={20} className="text-red-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-red-600">{formatINR(report.expensesTotal)}</p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profit</p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <PiggyBank size={20} className="text-primary" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-primary">{formatINR(report.profit)}</p>
                        </div>
                    </div>
                </section>
            )}

            {report && !loading && tab === 'outstanding' && (
```

- [ ] **Step 7: Replace the outstanding summary cards**

Replace:

```jsx
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Receivable (khata)
                            </p>
                            <p className="mt-2 text-2xl font-bold text-orange-600">
                                {formatINR(report.receivableTotal)}
                            </p>
                        </div>
                        <div className="glass p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Payable (suppliers)
                            </p>
                            <p className="mt-2 text-2xl font-bold text-red-700">{formatINR(report.payableTotal)}</p>
                        </div>
                    </div>
```

With:

```jsx
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Receivable (khata)
                                </p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <BookOpen size={20} className="text-orange-600" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-orange-600">
                                {formatINR(report.receivableTotal)}
                            </p>
                        </div>
                        <div className="glass-card p-5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Payable (suppliers)
                                </p>
                                <span className="rounded-xl bg-white/60 p-2">
                                    <Landmark size={20} className="text-red-700" />
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-bold text-red-700">{formatINR(report.payableTotal)}</p>
                        </div>
                    </div>
```

- [ ] **Step 8: Replace the outstanding receivables table**

Replace:

```jsx
                            <table className="mt-2 w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
                                        <th className="pb-2">Name</th>
                                        <th className="pb-2">Phone</th>
                                        <th className="pb-2 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.receivables.map((c) => (
                                        <tr key={c.id} className="border-b border-gray-100">
                                            <td className="py-2 font-medium text-gray-800">{c.name}</td>
                                            <td className="py-2 text-gray-500">{c.phone || '—'}</td>
                                            <td className="py-2 text-right font-semibold text-orange-600">
                                                {formatINR(c.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.receivables.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-3 text-center text-gray-400">
                                                No outstanding khata
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
```

With:

```jsx
                            <table className="glass-table mt-2">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Phone</th>
                                        <th className="text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.receivables.map((c) => (
                                        <tr key={c.id}>
                                            <td className="font-medium text-gray-800">{c.name}</td>
                                            <td className="text-gray-500">{c.phone || '—'}</td>
                                            <td className="text-right font-semibold text-orange-600">
                                                {formatINR(c.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.receivables.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="text-center text-gray-400">
                                                No outstanding khata
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
```

- [ ] **Step 9: Replace the outstanding payables table**

Replace:

```jsx
                            <table className="mt-2 w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
                                        <th className="pb-2">Name</th>
                                        <th className="pb-2">Phone</th>
                                        <th className="pb-2 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.payables.map((s) => (
                                        <tr key={s.id} className="border-b border-gray-100">
                                            <td className="py-2 font-medium text-gray-800">{s.name}</td>
                                            <td className="py-2 text-gray-500">{s.phone || '—'}</td>
                                            <td className="py-2 text-right font-semibold text-red-700">
                                                {formatINR(s.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.payables.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-3 text-center text-gray-400">
                                                No outstanding payables
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
```

With:

```jsx
                            <table className="glass-table mt-2">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Phone</th>
                                        <th className="text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.payables.map((s) => (
                                        <tr key={s.id}>
                                            <td className="font-medium text-gray-800">{s.name}</td>
                                            <td className="text-gray-500">{s.phone || '—'}</td>
                                            <td className="text-right font-semibold text-red-700">
                                                {formatINR(s.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {report.payables.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="text-center text-gray-400">
                                                No outstanding payables
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
```

- [ ] **Step 10: In `client/src/pages/Staff.jsx`, add the icon import and replace the header**

After the existing `import { useAuth } from '../context/AuthContext';` line add:

```jsx
import { UserCog } from 'lucide-react';
```

Replace:

```jsx
            <h1 className="text-2xl font-bold text-primary">Staff</h1>
```

With:

```jsx
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <UserCog size={24} className="text-primary" />
                </span>
                Staff
            </h1>
```

- [ ] **Step 11: Replace the Staff loading line**

Replace:

```jsx
            {loading && <div className="glass p-6 text-center text-gray-500">Loading staff…</div>}
```

With:

```jsx
            {loading && (
                <div className="glass p-6">
                    <div className="skeleton h-10 w-48" />
                    <div className="mt-4 space-y-2">
                        <div className="skeleton h-10" />
                        <div className="skeleton h-10" />
                    </div>
                </div>
            )}
```

- [ ] **Step 12: Replace the Staff table**

Replace:

```jsx
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
                                <th className="pb-2">Name</th>
                                <th className="pb-2">Email</th>
                                <th className="pb-2">Role</th>
                                <th className="pb-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id} className="border-b border-gray-100">
                                    <td className="py-2 font-medium text-gray-800">
                                        {u.name}
                                        {u.id === user?.id && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                                    </td>
                                    <td className="py-2 text-gray-500">{u.email}</td>
                                    <td className="py-2">
                                        <label htmlFor={`role-${u.id}`} className="sr-only">
                                            Role for {u.name}
                                        </label>
                                        <select
                                            id={`role-${u.id}`}
                                            value={u.role}
                                            onChange={(e) => handleRole(u.id, e.target.value)}
                                            className="glass-input py-1"
                                        >
                                            <option value="staff">staff</option>
                                            <option value="owner">owner</option>
                                        </select>
                                    </td>
                                    <td className="py-2 text-right">
                                        {u.id !== user?.id && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(u.id)}
                                                className="text-sm font-semibold text-red-600 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
```

With:

```jsx
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td className="font-medium text-gray-800">
                                        {u.name}
                                        {u.id === user?.id && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                                    </td>
                                    <td className="text-gray-500">{u.email}</td>
                                    <td>
                                        <label htmlFor={`role-${u.id}`} className="sr-only">
                                            Role for {u.name}
                                        </label>
                                        <select
                                            id={`role-${u.id}`}
                                            value={u.role}
                                            onChange={(e) => handleRole(u.id, e.target.value)}
                                            className="glass-input py-1"
                                        >
                                            <option value="staff">staff</option>
                                            <option value="owner">owner</option>
                                        </select>
                                    </td>
                                    <td className="text-right">
                                        {u.id !== user?.id && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(u.id)}
                                                className="btn-danger px-3 py-1.5 text-xs"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
```

Leave the add-staff form, error, and notice blocks exactly as they are.

- [ ] **Step 13: In `client/src/pages/Settings.jsx`, add the icon import and replace the header**

After the existing `import { businessApi } from '../api/endpoints';` line add:

```jsx
import { Settings as SettingsIcon } from 'lucide-react';
```

(The alias avoids colliding with the page component named `Settings`.)

Replace:

```jsx
            <h1 className="text-2xl font-bold text-primary">Settings</h1>
```

With:

```jsx
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <SettingsIcon size={24} className="text-primary" />
                </span>
                Settings
            </h1>
```

- [ ] **Step 14: Replace the Settings loading line**

Replace:

```jsx
            {loading && <div className="glass p-6 text-center text-gray-500">Loading settings…</div>}
```

With:

```jsx
            {loading && (
                <form className="glass space-y-4 p-6">
                    <div className="skeleton h-8 w-40" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="skeleton h-11" />
                        <div className="skeleton h-11" />
                        <div className="skeleton h-11 sm:col-span-2" />
                        <div className="skeleton h-11" />
                        <div className="skeleton h-11" />
                    </div>
                </form>
            )}
```

Leave the business profile form, error, and notice blocks exactly as they are.

- [ ] **Step 15: In `client/src/pages/Subscription.jsx`, add the icon import and replace the header**

After the existing `import { useAuth } from '../context/AuthContext';` line add:

```jsx
import { Crown, Check } from 'lucide-react';
```

Replace:

```jsx
            <h1 className="text-2xl font-bold text-primary">Subscription</h1>
```

With:

```jsx
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Crown size={24} className="text-primary" />
                </span>
                Subscription
            </h1>
```

- [ ] **Step 16: Replace the Subscription loading line**

Replace:

```jsx
            {loading && <div className="glass p-6 text-center text-gray-500">Loading plans…</div>}
```

With:

```jsx
            {loading && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="skeleton h-72" />
                    <div className="skeleton h-72" />
                </div>
            )}
```

- [ ] **Step 17: Replace the Subscription plan card**

Replace:

```jsx
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
```

With:

```jsx
                    {plans.map((plan) => {
                        const isCurrent = plan.id === currentPlan;
                        return (
                            <div
                                key={plan.id}
                                className={`rounded-2xl p-[2px] ${isCurrent
                                        ? 'bg-gradient-to-r from-primary to-accent shadow-btn-glow'
                                        : 'bg-white/60'
                                    }`}
                            >
                                <div className="glass h-full p-6">
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                                        {isCurrent && (
                                            <span className="badge badge-success">Current plan</span>
                                        )}
                                    </div>
                                    <p className="mt-3 text-3xl font-bold text-primary">
                                        {formatINR(plan.priceMonthly)}
                                        <span className="text-sm font-normal text-gray-400"> /month</span>
                                    </p>
                                    <ul className="mt-4 space-y-2 text-sm text-gray-600">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-2">
                                                <Check size={16} className="mt-0.5 shrink-0 text-primary" />
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
                            </div>
                        );
                    })}
```

(The `p-[2px]` gradient wrapper is the "gradient border" for the current plan; non-current cards get a subtle white border layer.)

Leave the error, notice, and owner note blocks exactly as they are.

- [ ] **Step 18: Run the targeted tests, then commit**

```bash
cd client && npx vitest run src/pages/Reports.test.jsx src/pages/Staff.test.jsx src/pages/Settings.test.jsx src/pages/Subscription.test.jsx
```

```bash
git add client/src/pages/Reports.jsx client/src/pages/Staff.jsx client/src/pages/Settings.jsx client/src/pages/Subscription.jsx && git commit -m "feat: restyle reports, staff, settings, and subscription with glass depth"
```

---

### Task 9: Full verification, emoji sweep, brain.md update, final commit

**Files:**
- Modify: `docs/brain.md`

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified green suite + lint, zero emoji in `client/src`, updated project state in `docs/brain.md`

- [ ] **Step 1: Run the full client test suite**

```bash
npm run test:client
```

Expected: every suite passes, including the extended `src/theme.test.jsx`.

- [ ] **Step 2: Lint the client**

```bash
cd client && npx eslint .
```

Expected: no errors (watch for unused lucide imports — every imported icon must be used).

- [ ] **Step 3: Emoji sweep**

Search `client/src` for emoji characters (any of `📊 🧾 💸 👥 🚚 📦 📈 🧑‍💼 ⚙️ ⭐ ✓` and similar). Expected: zero matches — all replaced by lucide icons. (The `✓` in Subscription was replaced by the `Check` icon in Task 8.)

- [ ] **Step 4: Update `docs/brain.md` — documentation map**

Replace:

```markdown
| `docs/superpowers/plans/2026-09-10-foundation.md` | Implementation plan for the foundation build |
```

With:

```markdown
| `docs/superpowers/plans/2026-09-10-foundation.md` | Implementation plan for the foundation build |
| `docs/superpowers/plans/2026-09-11-glassmorphism-redesign.md` | Implementation plan for the UI depth redesign |
```

- [ ] **Step 5: Update `docs/brain.md` — current state**

Replace:

```markdown
- **Done:** foundation build (auth, business, staff, all feature CRUD, khata, dashboard, reports, subscription UI, full server + client test suites)
- **In progress:** glassmorphism depth redesign (spec approved; implementation plan next)
```

With:

```markdown
- **Done:** foundation build (auth, business, staff, all feature CRUD, khata, dashboard, reports, subscription UI, full server + client test suites); glassmorphism depth redesign (multi-blob background, glass cards/tables, lucide icons, badges, skeletons, empty states across the shell and all 14 pages)
- **In progress:** —
```

- [ ] **Step 6: Commit and ask the user to visually verify**

```bash
git add docs/brain.md && git commit -m "docs: record glassmorphism redesign completion in brain.md"
```

Then ask the user to visually verify the running dev server (client on :5173): background blobs, sidebar, dashboard cards, a list page, a detail page, and a printed invoice (must stay white/clean). Do not use a browser yourself.

---

## Verification Summary (what "done" means)

- `npm run test:client` — all suites green, only `theme.test.jsx` (extended) and `AppShell.test.jsx` (owner-only assertions scoped to the nav) changed
- `cd client && npx eslint .` — clean
- Zero emoji in `client/src`; every page uses lucide icons
- Visual check by the user: rich light glass on every surface, green brand intact, invoice prints clean
- 9 conventional commits on `feature/foundation`
