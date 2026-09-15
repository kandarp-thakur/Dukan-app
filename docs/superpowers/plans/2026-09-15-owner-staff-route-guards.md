# Owner/Staff Client Route Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redirect staff away from the four owner-only client routes so the URL bar can no longer reach pages the sidebar already hides.

**Architecture:** A new `RequireOwner` layout route reads the authenticated user from `AuthContext` and either renders its nested `<Outlet />` or redirects to `/dashboard`. The four owner-only routes in `App.jsx` are grouped under a single `<Route element={<RequireOwner />}>`. Server-side authorization is untouched.

**Tech Stack:** React 18, react-router-dom 6, Vite, Vitest, @testing-library/react, jsdom.

**Spec:** [`docs/superpowers/specs/2026-09-15-owner-staff-route-guards-design.md`](../specs/2026-09-15-owner-staff-route-guards-design.md)

## Global Constraints

- Client-only change. Do not modify any file under `server/`.
- Roles remain exactly `owner` and `staff`.
- Owner-only routes are exactly: `/reports`, `/staff`, `/settings`, `/subscription`.
- Staff redirect target is `/dashboard` with `replace` (history replaced).
- No new page or empty-state UI.
- Tests use Vitest + Testing Library with a mocked `AuthContext` (`vi.mock('../context/AuthContext')`), matching [`AppShell.test.jsx`](../../../client/src/components/AppShell.test.jsx).
- Run client tests with `npx vitest run` from the `client/` directory (there is no `test` npm script).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `client/src/components/RequireOwner.jsx` | New. Auth gate for nested owner-only routes. |
| `client/src/components/RequireOwner.test.jsx` | New. Unit tests for the gate. |
| `client/src/App.jsx` | Modified. Nest the four owner-only routes under `RequireOwner`. |
| `client/src/pages/Subscription.jsx` | Modified. Remove the now-unreachable staff fallback block. |

---

### Task 1: `RequireOwner` guard component

**Files:**
- Create: `client/src/components/RequireOwner.jsx`
- Test: `client/src/components/RequireOwner.test.jsx`

**Interfaces:**
- Consumes: `useAuth()` from `client/src/context/AuthContext.jsx`, returning `{ user }` where `user.role` is `'owner'` or `'staff'`.
- Produces: default export `RequireOwner`, a React component that renders `<Outlet />` for owners and `<Navigate to="/dashboard" replace />` otherwise. Consumed by Task 2 in `App.jsx`.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/RequireOwner.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RequireOwner from './RequireOwner';

const mockAuth = { user: { role: 'owner' } };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const renderGuarded = (initialPath) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route element={<RequireOwner />}>
          <Route path="/reports" element={<div>Reports page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('RequireOwner', () => {
  beforeEach(() => {
    mockAuth.user = { role: 'owner' };
  });

  it('renders the guarded child for an owner', () => {
    renderGuarded('/reports');
    expect(screen.getByText('Reports page')).toBeInTheDocument();
  });

  it('redirects staff to the dashboard', () => {
    mockAuth.user = { role: 'staff' };
    renderGuarded('/reports');
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
    expect(screen.queryByText('Reports page')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `client/`: `npx vitest run src/components/RequireOwner.test.jsx`
Expected: FAIL — cannot resolve `./RequireOwner` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `client/src/components/RequireOwner.jsx`:

```jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireOwner() {
  const { user } = useAuth();
  if (user?.role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `client/`: `npx vitest run src/components/RequireOwner.test.jsx`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/RequireOwner.jsx client/src/components/RequireOwner.test.jsx
git commit -m "feat(client): add RequireOwner route guard"
```

---

### Task 2: Wire guarded routes and remove dead fallback

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/pages/Subscription.jsx`

**Interfaces:**
- Consumes: default export `RequireOwner` from `client/src/components/RequireOwner.jsx` (Task 1).
- Produces: no new exports; the four owner-only routes are now gated.

- [ ] **Step 1: Add the `RequireOwner` import**

In `client/src/App.jsx`, add the import immediately after the existing `import AppShell from './components/AppShell';` line:

```jsx
import RequireOwner from './components/RequireOwner';
```

- [ ] **Step 2: Group the four owner-only routes under `RequireOwner`**

In `client/src/App.jsx`, replace the four standalone route lines inside `<Route element={<AppShell />}>`:

```jsx
        <Route path="/reports" element={<Reports />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
```

with a nested guarded group, keeping the catch-all last:

```jsx
        <Route element={<RequireOwner />}>
          <Route path="/reports" element={<Reports />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/subscription" element={<Subscription />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
```

All other routes (dashboard, sales, invoices, expenses, customers, suppliers, products) stay unchanged.

- [ ] **Step 3: Remove the dead staff fallback in `Subscription.jsx`**

In `client/src/pages/Subscription.jsx`, the fallback block is the only use of `user`, and `useAuth` is imported only for it. Make three deletions:

1. Delete this JSX block (it can no longer render, since staff are redirected before the page mounts):

```jsx
            {!loading && user?.role !== 'owner' && (
                <p className="text-center text-sm text-gray-400">Only the owner can manage the subscription.</p>
            )}
```

2. Delete the hook call near the top of the component:

```jsx
    const { user } = useAuth();
```

3. Delete the now-unused import at the top of the file:

```jsx
import { useAuth } from '../context/AuthContext';
```

Before saving, search `client/src/pages/Subscription.jsx` for `user` and `useAuth` and confirm zero matches remain.

- [ ] **Step 4: Run the full client suite**

Run from `client/`: `npx vitest run`
Expected: PASS — the new `RequireOwner` tests pass and the existing [`App.test.jsx`](../../../client/src/App.test.jsx), [`AppShell.test.jsx`](../../../client/src/components/AppShell.test.jsx), and [`Subscription.test.jsx`](../../../client/src/pages/Subscription.test.jsx) suites still pass.

Note: `Subscription.test.jsx` mocks `AuthContext` with `user: { role: 'owner' }` and never asserts the removed fallback text, so it should pass unchanged. If it does fail for any reason, fix the assertion rather than restoring the deleted block.

- [ ] **Step 5: Run lint**

Run from `client/`: `npx eslint src/App.jsx src/pages/Subscription.jsx src/components/RequireOwner.jsx`
Expected: no errors (no unused `user`/`useAuth`).

- [ ] **Step 6: Commit**

```bash
git add client/src/App.jsx client/src/pages/Subscription.jsx
git commit -m "feat(client): guard owner-only routes and drop dead subscription fallback"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| §4 Approach — `RequireOwner` layout route | Task 1 |
| §4 Approach — nest four routes in `App.jsx` | Task 2, Steps 1–2 |
| §5 Behavior — staff redirect to `/dashboard` (replace) | Task 1, Step 3; Test step 1 |
| §5 Behavior — owner unchanged | Task 1, Step 1 tests |
| §6 Files touched — `Subscription.jsx` fallback removal | Task 2, Step 3 |
| §7 Testing — new `RequireOwner.test.jsx` | Task 1 |
| §7 Testing — regression run of existing suites | Task 2, Step 4 |
| §8 Acceptance criteria | Covered by Tasks 1–2 |

No spec requirement is unaddressed.

**Placeholder scan:** No TBD/TODO. Every code step contains the actual code. The only conditional instruction (updating `Subscription.test.jsx`) states the exact condition and the required change.

**Type consistency:** `RequireOwner` default export name matches the import in Task 2. `useAuth()` return shape (`{ user }`) matches the existing `AuthContext` provider. Redirect path `/dashboard` matches the existing catch-all in `App.jsx` and the spec.
