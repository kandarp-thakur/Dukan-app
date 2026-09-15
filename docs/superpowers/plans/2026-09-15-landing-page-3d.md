# Public Landing Page with 3D Hero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public marketing landing page at `/` with a lazy-loaded 3D hero, a shared public navbar/footer layout also used by Login and Register, and landing sections for features, pricing, and a final CTA.

**Architecture:** A new `PublicLayout` route group owns `/`, `/login`, and `/register`; the authenticated tree (`ProtectedRoutes` → `AppShell` → app pages) is untouched. The 3D hero is a `React.lazy` island mounted only when a runtime gate (`shouldUse3D()`) passes, so a single static CSS fallback serves the pre-load, no-WebGL, reduced-motion, and small-screen cases. Pricing reads the existing public `GET /plans` with a mirroring fallback constant.

**Tech Stack:** React 18, react-router-dom 6, Vite 5, Tailwind 3.4, lucide-react, Vitest 3 + Testing Library + jsdom, and (new) `three`, `@react-three/fiber`, `@react-three/drei`.

**Spec:** `docs/superpowers/specs/2026-09-15-landing-page-3d-design.md` (commit `c524584`)

## Global Constraints

- Client-only. **No `server/` file may change.**
- New dependencies are exactly `three`, `@react-three/fiber`, `@react-three/drei` (see spec D3).
- The 3D island is hero-only and lazy; three.js must not enter the entry chunk (spec §6.3).
- **No unit test may require WebGL.** The lazy scene module must never mount in jsdom (spec §10).
- Every hero visual region is `aria-hidden="true"`; all meaning is in real HTML (spec §6.4).
- Pro plan CTA copy is `Get started`. Never "Buy now" or "Subscribe now" (spec §8).
- Pricing values are paise integers rendered through `formatINR` (spec §8).
- Styling uses existing classes only: `.glass`, `.glass-card`, `.btn-primary`, `.btn-ghost`, `.badge-*` (spec §9).
- Brand name in copy is **Acc App** (from `client/index.html`).
- Small-viewport gate threshold is `< 768px`; reduced-motion is `(prefers-reduced-motion: reduce)` (spec §6.2).
- All client commands run from `client/`. Test command is `npx vitest run` (there is no `test` npm script).
- `/plans` returns plans shaped `{ id, name, priceMonthly, features[] }` with `priceMonthly` in paise.

---

## Task 1: Public navbar

**Files:**
- Create: `client/src/components/PublicNavbar.jsx`
- Create: `client/src/components/PublicNavbar.test.jsx`
- Modify: `client/src/index.css` (add navbar classes)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PublicNavbar({ transparent = true })` — default export. Renders a `<header data-testid="public-navbar" data-solid={ 'true' | 'false' }>` with links named `Sign in` (`/login`) and `Get started` (`/register`). `transparent` controls whether the scroll effect is active.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/PublicNavbar.test.jsx`:

```jsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        BrowserRouter: ({ children }) => children,
        Link: ({ to, children, ...props }) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

afterEach(() => {
    window.scrollY = 0;
});

describe('PublicNavbar', () => {
    it('shows sign in and get started links', () => {
        render(
            <MemoryRouter>
                <PublicNavbar transparent={false} />
            </MemoryRouter>
        );
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
        expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
    });

    it('is solid when it has no hero to float over', () => {
        render(
            <MemoryRouter>
                <PublicNavbar transparent={false} />
            </MemoryRouter>
        );
        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'true');
    });

    it('starts transparent and becomes solid after scroll', () => {
        render(
            <MemoryRouter>
                <PublicNavbar transparent />
            </MemoryRouter>
        );
        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'false');

        act(() => {
            window.scrollY = 120;
            window.dispatchEvent(new Event('scroll'));
        });

        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'true');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PublicNavbar.test.jsx`
Expected: FAIL — cannot resolve `./PublicNavbar`.

- [ ] **Step 3: Add the navbar classes to `client/src/index.css`**

Inside the existing `@layer components` block (after the `.badge-neutral` rule), add:

```css
  .navbar-solid {
    @apply border-b border-white/60 bg-white/70 shadow-glass backdrop-blur-xl;
  }
  .navbar-transparent {
    @apply bg-transparent;
  }
```

- [ ] **Step 4: Write the implementation**

Create `client/src/components/PublicNavbar.jsx`:

```jsx
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
            className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
                solid ? 'navbar-solid' : 'navbar-transparent'
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/PublicNavbar.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/PublicNavbar.jsx client/src/components/PublicNavbar.test.jsx client/src/index.css
git commit -m "feat(client): add public navbar with scroll state"
```

---

## Task 2: Public footer

**Files:**
- Create: `client/src/components/PublicFooter.jsx`
- Create: `client/src/components/PublicFooter.test.jsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `PublicFooter()` — default export. Renders the brand line, links named `Home` (`/`), `Sign in` (`/login`), `Get started` (`/register`), and a copyright line containing the current year.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/PublicFooter.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PublicFooter from './PublicFooter';

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        BrowserRouter: ({ children }) => children,
        Link: ({ to, children, ...props }) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

describe('PublicFooter', () => {
    it('renders the brand and product links', () => {
        render(
            <MemoryRouter>
                <PublicFooter />
            </MemoryRouter>
        );
        expect(screen.getByText('Acc App')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
        expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
    });

    it('shows the current year in the copyright line', () => {
        render(
            <MemoryRouter>
                <PublicFooter />
            </MemoryRouter>
        );
        expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PublicFooter.test.jsx`
Expected: FAIL — cannot resolve `./PublicFooter`.

- [ ] **Step 3: Write the implementation**

Create `client/src/components/PublicFooter.jsx`:

```jsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PublicFooter.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/PublicFooter.jsx client/src/components/PublicFooter.test.jsx
git commit -m "feat(client): add public footer"
```

---

## Task 3: Public layout shell

**Files:**
- Create: `client/src/components/PublicLayout.jsx`
- Create: `client/src/components/PublicLayout.test.jsx`

**Interfaces:**
- Consumes: `PublicNavbar` (Task 1), `PublicFooter` (Task 2).
- Produces: `PublicLayout()` — default export, renders `PublicNavbar` (transparent only when `pathname === '/'`), a `<main>` containing `<Outlet/>`, and `PublicFooter`.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/PublicLayout.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicLayout from './PublicLayout';

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        BrowserRouter: ({ children }) => children,
        Link: ({ to, children, ...props }) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

const renderAt = (initialPath) =>
    render(
        <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
                <Route element={<PublicLayout />}>
                    <Route path="/" element={<p>landing child</p>} />
                    <Route path="/login" element={<p>auth child</p>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );

describe('PublicLayout', () => {
    it('renders navbar, outlet content and footer', () => {
        renderAt('/');
        expect(screen.getByTestId('public-navbar')).toBeInTheDocument();
        expect(screen.getByText('landing child')).toBeInTheDocument();
        expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
    });

    it('makes the navbar transparent on the landing page', () => {
        renderAt('/');
        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'false');
    });

    it('makes the navbar solid on an auth page', () => {
        renderAt('/login');
        expect(screen.getByText('auth child')).toBeInTheDocument();
        expect(screen.getByTestId('public-navbar')).toHaveAttribute('data-solid', 'true');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PublicLayout.test.jsx`
Expected: FAIL — cannot resolve `./PublicLayout`.

- [ ] **Step 3: Write the implementation**

Create `client/src/components/PublicLayout.jsx`:

```jsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PublicLayout.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/PublicLayout.jsx client/src/components/PublicLayout.test.jsx
git commit -m "feat(client): add public layout shell"
```

---

## Task 4: WebGL and motion gate helper

**Files:**
- Create: `client/src/utils/webglSupport.js`
- Create: `client/src/utils/webglSupport.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: named exports `supportsWebGL()`, `prefersReducedMotion()`, `isSmallViewport()`, `shouldUse3D()` — all return `boolean`. `shouldUse3D()` is `!prefersReducedMotion() && !isSmallViewport() && supportsWebGL()`.

- [ ] **Step 1: Write the failing test**

Create `client/src/utils/webglSupport.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { supportsWebGL, prefersReducedMotion, isSmallViewport, shouldUse3D } from './webglSupport';

const originalInnerWidth = window.innerWidth;

afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
});

describe('webglSupport', () => {
    it('reports no WebGL when the canvas cannot give a context', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        expect(supportsWebGL()).toBe(false);
    });

    it('reports no WebGL when getContext throws', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
            throw new Error('not implemented');
        });
        expect(supportsWebGL()).toBe(false);
    });

    it('reports WebGL when a context is returned', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
        expect(supportsWebGL()).toBe(true);
    });

    it('detects a reduced-motion preference', () => {
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
        expect(prefersReducedMotion()).toBe(true);
    });

    it('treats a missing matchMedia as no preference', () => {
        vi.stubGlobal('matchMedia', undefined);
        expect(prefersReducedMotion()).toBe(false);
    });

    it('detects a small viewport below 768px', () => {
        Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
        expect(isSmallViewport()).toBe(true);
    });

    it('allows 3D when WebGL works and motion is welcome on a large screen', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        expect(shouldUse3D()).toBe(true);
    });

    it('refuses 3D when the user prefers reduced motion', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
        expect(shouldUse3D()).toBe(false);
    });

    it('refuses 3D on a small viewport', () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
        Object.defineProperty(window, 'innerWidth', { value: 640, configurable: true });
        expect(shouldUse3D()).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/webglSupport.test.js`
Expected: FAIL — cannot resolve `./webglSupport`.

- [ ] **Step 3: Write the implementation**

Create `client/src/utils/webglSupport.js`:

```js
// Pure environment probes. Kept dependency-free so they can be unit tested
// without a browser GPU. See spec 2026-09-15-landing-page-3d-design.md §6.2.

export function supportsWebGL() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        return Boolean(gl);
    } catch {
        return false;
    }
}

export function prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isSmallViewport() {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
}

export function shouldUse3D() {
    return !prefersReducedMotion() && !isSmallViewport() && supportsWebGL();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/webglSupport.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/webglSupport.js client/src/utils/webglSupport.test.js
git commit -m "feat(client): add webgl and motion gate helper"
```

---

## Task 5: Static CSS 3D fallback art

**Files:**
- Create: `client/src/components/HeroFallback.jsx`
- Create: `client/src/components/HeroFallback.test.jsx`
- Modify: `client/src/index.css` (add `.hero-3d`)

**Interfaces:**
- Consumes: nothing.
- Produces: `HeroFallback()` — default export. Renders `<div data-testid="hero-fallback" class="hero-3d ...">` with three glass panels labelled `Sales`, `Expenses`, `Profit`. No WebGL, no animation.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/HeroFallback.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HeroFallback from './HeroFallback';

describe('HeroFallback', () => {
    it('renders the three glass panels', () => {
        render(<HeroFallback />);
        expect(screen.getByText('Sales')).toBeInTheDocument();
        expect(screen.getByText('Expenses')).toBeInTheDocument();
        expect(screen.getByText('Profit')).toBeInTheDocument();
    });

    it('renders the root wrapper used by the hero', () => {
        render(<HeroFallback />);
        expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/HeroFallback.test.jsx`
Expected: FAIL — cannot resolve `./HeroFallback`.

- [ ] **Step 3: Add the perspective class to `client/src/index.css`**

Inside `@layer components`, after the navbar classes added in Task 1:

```css
  .hero-3d {
    perspective: 1000px;
    transform-style: preserve-3d;
  }
```

- [ ] **Step 4: Write the implementation**

Create `client/src/components/HeroFallback.jsx`:

```jsx
const PANELS = [
    { label: 'Sales', value: '₹1,150', top: '6%', left: '2%', rotate: -8, width: 40 },
    { label: 'Expenses', value: '₹860', top: '34%', left: '40%', rotate: 4, width: 60 },
    { label: 'Profit', value: '₹290', top: '62%', left: '10%', rotate: -3, width: 80 },
];

export default function HeroFallback() {
    return (
        <div data-testid="hero-fallback" className="hero-3d relative h-full w-full">
            {PANELS.map((panel, index) => (
                <div
                    key={panel.label}
                    className="glass-card absolute w-40 p-3"
                    style={{
                        top: panel.top,
                        left: panel.left,
                        transform: `rotateY(${panel.rotate}deg) translateZ(${index * 24}px)`,
                    }}
                >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{panel.label}</p>
                    <p className="mt-1 text-xl font-bold text-primary">{panel.value}</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/70">
                        <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-primary to-accent"
                            style={{ width: `${panel.width}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/HeroFallback.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/HeroFallback.jsx client/src/components/HeroFallback.test.jsx client/src/index.css
git commit -m "feat(client): add static 3d fallback art for the hero"
```

---

## Task 6: Features section

**Files:**
- Create: `client/src/sections/FeaturesSection.jsx`
- Create: `client/src/sections/FeaturesSection.test.jsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `FeaturesSection()` — default export. Renders an `<h2>` and six `<h3>` feature titles drawn only from shipped capability.

- [ ] **Step 1: Write the failing test**

Create `client/src/sections/FeaturesSection.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FeaturesSection from './FeaturesSection';

describe('FeaturesSection', () => {
    it('renders all six feature titles', () => {
        render(<FeaturesSection />);
        ['Sales & invoicing', 'GST invoices', 'Expenses', 'Customers & khata', 'Suppliers & purchases', 'Reports & dashboard'].forEach(
            (title) => {
                expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
            }
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sections/FeaturesSection.test.jsx`
Expected: FAIL — cannot resolve `./FeaturesSection`.

- [ ] **Step 3: Write the implementation**

Create `client/src/sections/FeaturesSection.jsx`:

```jsx
import { Receipt, FileText, Wallet, BookOpen, Truck, BarChart3 } from 'lucide-react';

const FEATURES = [
    { icon: Receipt, title: 'Sales & invoicing', text: 'Record sales and create invoices in seconds.' },
    { icon: FileText, title: 'GST invoices', text: 'HSN, tax breakup and PDF download built in.' },
    { icon: Wallet, title: 'Expenses', text: 'Track every business expense against your sales.' },
    { icon: BookOpen, title: 'Customers & khata', text: 'Udhaar balances and payments in one ledger.' },
    { icon: Truck, title: 'Suppliers & purchases', text: 'Purchase entries and supplier payments.' },
    { icon: BarChart3, title: 'Reports & dashboard', text: 'Daily profit, monthly and outstanding views.' },
];

export default function FeaturesSection() {
    return (
        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold text-primary sm:text-3xl">Everything your shop needs</h2>
            <p className="mt-2 text-gray-600">No spreadsheets, no scattered notebooks.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map(({ icon: Icon, title, text }) => (
                    <div key={title} className="glass-card p-5">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/60">
                            <Icon size={24} className="text-primary" />
                        </span>
                        <h3 className="mt-3 font-semibold text-gray-800">{title}</h3>
                        <p className="mt-1 text-sm text-gray-600">{text}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sections/FeaturesSection.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add client/src/sections/FeaturesSection.jsx client/src/sections/FeaturesSection.test.jsx
git commit -m "feat(client): add landing features section"
```

---

## Task 7: Pricing section with live plans and fallback

**Files:**
- Create: `client/src/sections/PricingSection.jsx`
- Create: `client/src/sections/PricingSection.test.jsx`

**Interfaces:**
- Consumes: `plansApi.list()` from `client/src/api/endpoints.js` (returns `{ plans: Plan[] }`); `formatINR(paise)` from `client/src/utils/money.js`.
- Produces: `PricingSection()` — default export; also exports `FALLBACK_PLANS` (array of `{ id, name, priceMonthly, features[] }`) mirroring the server catalog.

- [ ] **Step 1: Write the failing test**

Create `client/src/sections/PricingSection.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PricingSection from './PricingSection';
import { plansApi } from '../api/endpoints';

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        BrowserRouter: ({ children }) => children,
        Link: ({ to, children, ...props }) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

vi.mock('../api/endpoints', () => ({
    plansApi: { list: vi.fn() },
}));

const renderSection = () =>
    render(
        <MemoryRouter>
            <PricingSection />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PricingSection', () => {
    it('renders the plans returned by the API', async () => {
        plansApi.list.mockResolvedValue({
            plans: [
                { id: 'free', name: 'Starter', priceMonthly: 0, features: ['One user'] },
                { id: 'pro', name: 'Growth', priceMonthly: 49900, features: ['Staff accounts'] },
            ],
        });

        renderSection();

        expect(await screen.findByText('Growth')).toBeInTheDocument();
        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('₹499/mo')).toBeInTheDocument();
    });

    it('falls back to the local catalog when the API fails', async () => {
        plansApi.list.mockRejectedValue(new Error('offline'));

        renderSection();

        expect(await screen.findByText('Free')).toBeInTheDocument();
        expect(screen.getByText('₹199/mo')).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: 'Get started' }).length).toBe(2);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sections/PricingSection.test.jsx`
Expected: FAIL — cannot resolve `./PricingSection`.

- [ ] **Step 3: Write the implementation**

Create `client/src/sections/PricingSection.jsx`:

```jsx
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
                            {plan.priceMonthly === 0 ? 'Free' : `${formatINR(plan.priceMonthly)}/mo`}
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sections/PricingSection.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/sections/PricingSection.jsx client/src/sections/PricingSection.test.jsx
git commit -m "feat(client): add landing pricing section with fallback"
```

---

## Task 8: Final CTA section

**Files:**
- Create: `client/src/sections/CtaSection.jsx`
- Create: `client/src/sections/CtaSection.test.jsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `CtaSection()` — default export. Renders an `<h2>` and a `Get started` link to `/register`.

- [ ] **Step 1: Write the failing test**

Create `client/src/sections/CtaSection.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CtaSection from './CtaSection';

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        BrowserRouter: ({ children }) => children,
        Link: ({ to, children, ...props }) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

describe('CtaSection', () => {
    it('offers a get started link to registration', () => {
        render(
            <MemoryRouter>
                <CtaSection />
            </MemoryRouter>
        );
        expect(screen.getByRole('heading', { name: /ready to tidy up your books/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sections/CtaSection.test.jsx`
Expected: FAIL — cannot resolve `./CtaSection`.

- [ ] **Step 3: Write the implementation**

Create `client/src/sections/CtaSection.jsx`:

```jsx
import { Link } from 'react-router-dom';

export default function CtaSection() {
    return (
        <section className="mx-auto max-w-4xl px-4 pb-4">
            <div className="glass p-8 text-center sm:p-12">
                <h2 className="text-2xl font-bold text-primary sm:text-3xl">Ready to tidy up your books?</h2>
                <p className="mt-2 text-gray-600">
                    Create your business account in under a minute — no card required.
                </p>
                <Link to="/register" className="btn-primary mt-6">
                    Get started
                </Link>
            </div>
        </section>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sections/CtaSection.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add client/src/sections/CtaSection.jsx client/src/sections/CtaSection.test.jsx
git commit -m "feat(client): add landing final cta section"
```

---

## Task 9: Hero section with the 3D gate

**Files:**
- Create: `client/src/sections/HeroSection.jsx`
- Create: `client/src/sections/HeroSection.test.jsx`

**Interfaces:**
- Consumes: `shouldUse3D()` (Task 4), `HeroFallback` (Task 5), and a lazily imported `../components/HeroScene` (created in Task 11).
- Produces: `HeroSection()` — default export. Always renders the `<h1>` headline and two links named `Get started` (`/register`) and `Sign in` (`/login`). Renders the 3D canvas only when `shouldUse3D()` is true, otherwise `HeroFallback`.

- [ ] **Step 1: Write the failing test**

Create `client/src/sections/HeroSection.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HeroSection from './HeroSection';
import { shouldUse3D } from '../utils/webglSupport';

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        BrowserRouter: ({ children }) => children,
        Link: ({ to, children, ...props }) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

vi.mock('../utils/webglSupport', () => ({
    shouldUse3D: vi.fn(),
}));

vi.mock('../components/HeroScene', () => ({
    default: () => <div data-testid="hero-scene-mock" />,
}));

const renderHero = () =>
    render(
        <MemoryRouter>
            <HeroSection />
        </MemoryRouter>
    );

describe('HeroSection', () => {
    it('renders the headline and both calls to action', () => {
        shouldUse3D.mockReturnValue(false);
        renderHero();
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
        expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    });

    it('shows the static fallback when 3D is not available', () => {
        shouldUse3D.mockReturnValue(false);
        renderHero();
        expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
        expect(screen.queryByTestId('hero-scene-mock')).not.toBeInTheDocument();
    });

    it('hides the decorative art from assistive technology', () => {
        shouldUse3D.mockReturnValue(false);
        const { container } = renderHero();
        const art = container.querySelector('[aria-hidden="true"]');
        expect(art).not.toBeNull();
        expect(art).toContainElement(screen.getByTestId('hero-fallback'));
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sections/HeroSection.test.jsx`
Expected: FAIL — cannot resolve `./HeroSection`.

- [ ] **Step 3: Write the implementation**

Create `client/src/sections/HeroSection.jsx`:

```jsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sections/HeroSection.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/sections/HeroSection.jsx client/src/sections/HeroSection.test.jsx
git commit -m "feat(client): add hero section with 3d gate"
```

---

## Task 10: Landing page composition with guest redirect

**Files:**
- Create: `client/src/pages/LandingPage.jsx`
- Create: `client/src/pages/LandingPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth()` from `client/src/context/AuthContext.jsx` (returns `{ user, loading }`); `HeroSection` (Task 9); `FeaturesSection` (Task 6); `PricingSection` (Task 7); `CtaSection` (Task 8).
- Produces: `LandingPage()` — default export. Renders a skeleton while `loading`, `<Navigate to="/dashboard" replace />` when `user` exists, otherwise the four sections.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/LandingPage.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import { plansApi } from '../api/endpoints';

const mockAuth = { user: null, loading: false };

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        BrowserRouter: ({ children }) => children,
        Link: ({ to, children, ...props }) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

vi.mock('../api/endpoints', () => ({
    plansApi: { list: vi.fn() },
}));

vi.mock('../utils/webglSupport', () => ({
    shouldUse3D: () => false,
}));

vi.mock('../components/HeroScene', () => ({
    default: () => <div data-testid="hero-scene-mock" />,
}));

const renderLanding = () =>
    render(
        <MemoryRouter>
            <LandingPage />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = null;
    mockAuth.loading = false;
    plansApi.list.mockResolvedValue({ plans: [] });
});

describe('LandingPage', () => {
    it('shows the hero, features, pricing and cta to a guest', async () => {
        renderLanding();
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /everything your shop needs/i })).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: /simple pricing/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /ready to tidy up your books/i })).toBeInTheDocument();
    });

    it('redirects a logged-in user to the dashboard instead of the hero', () => {
        mockAuth.user = { role: 'owner' };
        renderLanding();
        expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/LandingPage.test.jsx`
Expected: FAIL — cannot resolve `./LandingPage`.

- [ ] **Step 3: Write the implementation**

Create `client/src/pages/LandingPage.jsx`:

```jsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/LandingPage.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/LandingPage.jsx client/src/pages/LandingPage.test.jsx
git commit -m "feat(client): add landing page with guest redirect"
```

---

## Task 11: 3D hero scene (new dependencies)

**Files:**
- Modify: `client/package.json` (via `npm install`)
- Create: `client/src/components/HeroScene.jsx`
- Create: `client/src/components/HeroScene.test.jsx`

**Interfaces:**
- Consumes: `three`, `@react-three/fiber`, `@react-three/drei`.
- Produces: `HeroScene()` — default export, a module that renders a `Canvas` with three floating glass panels. Imported only via `lazy()` from `HeroSection` (Task 9).

- [ ] **Step 1: Install the dependencies**

Run (from `client/`):

```bash
npm install three @react-three/fiber @react-three/drei
```

Expected: `client/package.json` gains the three packages under `dependencies`.

- [ ] **Step 2: Write the failing test**

Create `client/src/components/HeroScene.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({
    Canvas: ({ children }) => <div data-testid="r3f-canvas">{children}</div>,
    useFrame: () => {},
}));

vi.mock('@react-three/drei', () => ({
    Float: ({ children }) => <div>{children}</div>,
    RoundedBox: ({ children }) => <div>{children}</div>,
}));

import HeroScene from './HeroScene';

describe('HeroScene', () => {
    it('mounts the canvas without a real WebGL context', () => {
        render(<HeroScene />);
        expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    });
});
```

Note: the mocks keep jsdom free of WebGL — this test proves the module's structure, not GPU behaviour.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/HeroScene.test.jsx`
Expected: FAIL — cannot resolve `./HeroScene`.

- [ ] **Step 4: Write the implementation**

Create `client/src/components/HeroScene.jsx`:

```jsx
import { Canvas } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';

function PanelRows({ y = 0 }) {
    return (
        <>
            <mesh position={[0.32, y + 0.22, 0.05]}>
                <boxGeometry args={[0.8, 0.05, 0.01]} />
                <meshStandardMaterial color="#2E7D32" />
            </mesh>
            <mesh position={[0.17, y + 0.02, 0.05]}>
                <boxGeometry args={[0.5, 0.05, 0.01]} />
                <meshStandardMaterial color="#4CAF50" />
            </mesh>
        </>
    );
}

function Panel({ position, rotation, scale, children }) {
    return (
        <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.5}>
            <group position={position} rotation={rotation} scale={scale}>
                <RoundedBox args={[1.6, 1, 0.06]} radius={0.05} smoothness={4}>
                    <meshPhysicalMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.55}
                        roughness={0.15}
                        metalness={0}
                        transmission={0.4}
                        thickness={0.6}
                    />
                </RoundedBox>
                {children}
            </group>
        </Float>
    );
}

export default function HeroScene() {
    return (
        <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 4], fov: 45 }}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[3, 4, 5]} intensity={1.1} />
            <directionalLight position={[-4, -1, 2]} intensity={0.5} color="#4CAF50" />
            <Panel position={[-0.7, 0.3, 0]} rotation={[0, 0.3, 0]} scale={1}>
                <PanelRows />
            </Panel>
            <Panel position={[0.7, -0.1, -0.4]} rotation={[0, -0.35, 0]} scale={0.9}>
                <PanelRows y={-0.05} />
            </Panel>
            <Panel position={[0, -0.7, -0.8]} rotation={[0.1, 0, 0]} scale={0.8}>
                <PanelRows />
            </Panel>
        </Canvas>
    );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/HeroScene.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/package-lock.json client/src/components/HeroScene.jsx client/src/components/HeroScene.test.jsx
git commit -m "feat(client): add lazy three.js hero scene"
```

---

## Task 12: Wire the public route group and revamp the auth pages

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/pages/Login.jsx` (outer wrapper only)
- Modify: `client/src/pages/Register.jsx` (outer wrapper only)
- Modify: `client/src/App.test.jsx`

**Interfaces:**
- Consumes: `PublicLayout` (Task 3), `LandingPage` (Task 10).
- Produces: routing where `/` is public, `/login` and `/register` share the public layout, and every other path stays protected. `ProtectedRoutes` behaviour is unchanged.

- [ ] **Step 1: Write the failing test**

Replace the contents of `client/src/App.test.jsx` with:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

vi.mock('./api/client', () => ({
    default: {
        post: vi.fn().mockRejectedValue(new Error('no server')),
        get: vi.fn(),
    },
    setAccessToken: vi.fn(),
}));

vi.mock('./utils/webglSupport', () => ({
    shouldUse3D: () => false,
}));

vi.mock('./components/HeroScene', () => ({
    default: () => <div data-testid="hero-scene-mock" />,
}));

describe('App routing', () => {
    it('renders the public landing page for a guest at the root path', async () => {
        render(<App />);
        expect(
            await screen.findByRole('heading', { name: /sales, invoices and khata/i })
        ).toBeInTheDocument();
    });

    it('sends an unauthenticated visitor on a protected path to login', async () => {
        window.history.pushState({}, '', '/reports');
        render(<App />);
        expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
        window.history.pushState({}, '', '/');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.jsx`
Expected: FAIL — the guest at `/` still lands on the login heading, so the first case fails.

- [ ] **Step 3: Add the public route group to `client/src/App.jsx`**

Add these two imports after the existing `PublicInvoice` import:

```jsx
import PublicLayout from './components/PublicLayout';
import LandingPage from './pages/LandingPage';
```

Replace the two standalone auth routes inside `App`'s `<Routes>` with the public group, so the block reads:

```jsx
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
          <Route path="/i/:token" element={<PublicInvoice />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
```

- [ ] **Step 4: Let the auth pages compose inside the layout**

In `client/src/pages/Login.jsx`, change the outer wrapper on the return statement from:

```jsx
    <div className="flex min-h-screen items-center justify-center p-4">
```

to:

```jsx
    <div className="flex items-center justify-center px-4 pb-16 pt-24">
```

In `client/src/pages/Register.jsx`, make the identical change to its outer wrapper:

```jsx
    <div className="flex items-center justify-center px-4 pb-16 pt-24">
```

The inner `glass w-full max-w-md p-8` card, the form fields, the error block, and the `navigate('/dashboard')` call are unchanged.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full client suite**

Run: `npx vitest run`
Expected: PASS — the 136 pre-existing tests plus all new tests, 0 failures.

- [ ] **Step 7: Verify the 3D chunk is split out**

Run: `npm run build`
Expected: build succeeds and the output lists a separate chunk for the three.js scene (its file name contains `HeroScene`).

- [ ] **Step 8: Commit**

```bash
git add client/src/App.jsx client/src/pages/Login.jsx client/src/pages/Register.jsx client/src/App.test.jsx
git commit -m "feat(client): add public landing route group and revamp auth pages"
```

---

## Task 13: Documentation and .gitignore

**Files:**
- Modify: `docs/ui-style-guide.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation of the new public surface; no runtime behaviour.

- [ ] **Step 1: Document the public surface in `docs/ui-style-guide.md`**

Append a new section at the end of the file:

```markdown
## 7. Public (marketing) surface

The public pages — `/` (landing), `/login`, `/register` — share `PublicLayout`
(`client/src/components/PublicLayout.jsx`): `PublicNavbar` + `<main>` + `PublicFooter`.

- The navbar is transparent only on `/` (it floats over the hero) and becomes
  solid after 16px of scroll; on auth pages it is always solid.
- The hero's 3D scene is decorative: its wrapper is `aria-hidden="true"` and it
  is mounted only when `shouldUse3D()` passes (WebGL present, >= 768px wide, no
  reduced-motion preference). Otherwise `HeroFallback` renders instead.
- Landing sections reuse the app's components verbatim: `.glass`, `.glass-card`,
  `.btn-primary`, `.btn-ghost`, `.badge-*`.
- Pricing mirrors the server plan catalog; `PricingSection` exports
  `FALLBACK_PLANS` and reads `/plans` when available.
```

- [ ] **Step 2: Confirm `.gitignore` already covers the local database**

Read `.gitignore` and confirm the `.mongodb/` line is present. If it is not, add it:

```
.mongodb/
```

- [ ] **Step 3: Commit**

```bash
git add docs/ui-style-guide.md .gitignore
git commit -m "docs: document the public landing surface"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §5.1 Routing (public group, `/` public, logged-in redirect, app untouched) | 3, 10, 12 |
| §5.2 Units (`PublicNavbar`, `PublicFooter`, `PublicLayout`, `LandingPage`, `HeroSection`, `HeroScene`, `HeroFallback`, `FeaturesSection`, `PricingSection`, `CtaSection`, `webglSupport`) | 1, 2, 3, 10, 9, 11, 5, 6, 7, 8, 4 |
| §5.3 Modified files (`App.jsx`, `Login.jsx`, `Register.jsx`, `App.test.jsx`, `index.css`) | 12, 1, 5 |
| §6.1 Scene from primitives, no asset files, fixed camera | 11 |
| §6.2 Single fallback + gate (reduced motion, `< 768px`, WebGL probe) | 4, 5, 9 |
| §6.3 Performance (`dpr` cap, chunk split) | 11, 12 |
| §6.4 Accessibility (`aria-hidden`, real CTAs) | 9 |
| §7 Content (hero, features, pricing, cta, footer, brand Acc App) | 9, 6, 7, 8, 2 |
| §8 Pricing from `/plans` with fallback, `formatINR`, `Get started` copy | 7 |
| §9 Styling via existing classes | 1, 5, 6, 7, 8, 9, 2 |
| §10 Testing (all six test files + updated `App.test.jsx`) | 1–12 |
| §12 Out of scope respected (no extra routes, no server change) | all |

**2. Placeholder scan:** no TBD/TODO markers; every code step contains complete, runnable code.

**3. Type consistency:** `PublicNavbar({ transparent })` used by `PublicLayout`; `HeroFallback` imported by name in Tasks 5 and 9; `shouldUse3D()` exported in Task 4 and mocked in Tasks 9, 10, 12; `FALLBACK_PLANS` exported in Task 7; `plansApi.list()` shape `{ plans[] }` consistent between Task 7 and its test.

---

## Acceptance Criteria

- Guest at `/` sees the landing page with a headline, both CTAs, the features grid, pricing, and the final CTA.
- The 3D canvas mounts only when `shouldUse3D()` is true; otherwise the static fallback renders, and both states show identical headline/CTA HTML.
- No unit test requires WebGL and the whole client suite passes (136 pre-existing + new).
- `npm run build` emits the three.js scene as a separate chunk.
- A logged-in user at `/` is redirected to `/dashboard`; an unauthenticated user at any app path is redirected to `/login`.
- No `server/` file is modified.
