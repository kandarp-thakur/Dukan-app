# Owner vs Staff Client-Side Route Guards — Design

**Date:** 2026-09-15
**Status:** Approved (design), pending implementation
**Scope:** Client-only (React). No server changes.

## 1. Problem

The app has two roles, `owner` and `staff`, defined in
[`User.js`](../../../server/src/models/User.js) and enforced server-side by
[`requireRole('owner')`](../../../server/src/middleware/auth.js).

Server-side enforcement is correct: staff receive `403` from the owner-only
endpoints. However, the client only hides owner-only items in the sidebar
navigation ([`AppShell.jsx`](../../../client/src/components/AppShell.jsx),
`ownerOnly: true`). The route table in
[`App.jsx`](../../../client/src/App.jsx) renders those pages for **any**
authenticated user.

Consequently a staff member who types an owner-only URL (or follows a stale
bookmark) reaches the page shell. For example,
[`Subscription.jsx`](../../../client/src/pages/Subscription.jsx) currently
renders a "Only the owner can manage the subscription." fallback for staff.

This is a UX leak, not a security hole — the server still refuses the data —
but it exposes pages the user cannot use and forces per-page fallback logic.

## 2. Goal

Redirect staff away from owner-only client routes, matching the navigation the
sidebar already presents.

Non-goals:

- No change to the role model (still exactly `owner` and `staff`).
- No granular per-staff feature permissions.
- No change to server-side authorization; it remains the enforcement boundary.

## 3. Owner-only routes

Exactly the four routes flagged `ownerOnly` in the navigation:

| Path          | Page                                    |
| ------------- | --------------------------------------- |
| `/reports`    | [`Reports.jsx`](../../../client/src/pages/Reports.jsx)       |
| `/staff`      | [`Staff.jsx`](../../../client/src/pages/Staff.jsx)           |
| `/settings`   | [`Settings.jsx`](../../../client/src/pages/Settings.jsx)     |
| `/subscription` | [`Subscription.jsx`](../../../client/src/pages/Subscription.jsx) |

All other authenticated routes (dashboard, sales, invoices, expenses,
customers, suppliers, products) remain available to both roles.

## 4. Approach

Chosen: **a reusable `RequireOwner` layout route.**

`RequireOwner` reads the authenticated user from
[`AuthContext`](../../../client/src/context/AuthContext.jsx) and either
renders its nested routes (`<Outlet />`) or redirects.

```
const { user } = useAuth();
if (user?.role !== 'owner') return <Navigate to="/dashboard" replace />;
return <Outlet />;
```

In [`App.jsx`](../../../client/src/App.jsx), the four owner-only routes are
grouped under a single nested route:

```
<Route element={<RequireOwner />}>
  <Route path="/reports" element={<Reports />} />
  <Route path="/staff" element={<Staff />} />
  <Route path="/settings" element={<Settings />} />
  <Route path="/subscription" element={<Subscription />} />
</Route>
```

`ProtectedRoutes` already guarantees `user` is non-null before these routes
render, so `RequireOwner` is never evaluated for a logged-out user.

### Alternatives considered

- **Single route-config source of truth** — derive both the nav and the route
  tree from one array so they cannot drift. Correct long-term, but a larger
  refactor of `App.jsx` and `AppShell.jsx` than this fix warrants (YAGNI).
- **Per-page guard inside each of the four pages** — no new component, but
  duplicates the same guard four times and leaves the route table unguarded for
  future pages.

The chosen approach mirrors the `ownerOnly` flag already used for navigation:
one place per concern, easy to test, no page rewrites.

## 5. Behavior

| Actor / action                                  | Result                                              |
| ----------------------------------------------- | --------------------------------------------------- |
| Owner visits an owner-only URL                  | Page renders unchanged                              |
| Staff visits an owner-only URL                  | Redirect to `/dashboard` (history replaced)         |
| Staff uses the sidebar                          | Owner-only items remain hidden (unchanged)          |
| Staff calls an owner-only API directly          | Server returns `403` (unchanged)                    |

Redirect target `/dashboard` matches the existing catch-all redirect in
`App.jsx`, so no new page or empty-state UI is introduced.

## 6. Files touched

| File                                             | Change                                                        |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `client/src/components/RequireOwner.jsx`         | New — guard layout route                                      |
| [`client/src/App.jsx`](../../../client/src/App.jsx)               | Import `RequireOwner`; nest the four owner-only routes        |
| [`client/src/pages/Subscription.jsx`](../../../client/src/pages/Subscription.jsx) | Remove the now-unreachable staff fallback block |
| `client/src/components/RequireOwner.test.jsx`    | New — unit tests                                              |

No server files, no route renames, no new page.

## 7. Testing

Follows the existing client test stack (Vitest + Testing Library), mocking
`AuthContext` as [`AppShell.test.jsx`](../../../client/src/components/AppShell.test.jsx)
does.

New `RequireOwner.test.jsx`:

1. Renders the guarded child when `user.role === 'owner'`.
2. Does not render the guarded child when `user.role === 'staff'`, and instead
   lands on `/dashboard` (asserted with a stub `dashboard` route).
3. A route inside the protected group is reachable for an owner and absent for
   staff.

Regression: run the existing client suite and confirm
[`App.test.jsx`](../../../client/src/App.test.jsx) and
[`AppShell.test.jsx`](../../../client/src/components/AppShell.test.jsx) still
pass.

## 8. Acceptance criteria

- Staff navigating to `/reports`, `/staff`, `/settings`, or `/subscription` end
  up on `/dashboard`.
- Owner can open all four pages as before.
- The sidebar continues to hide owner-only items for staff.
- `Subscription.jsx` no longer contains a staff-only fallback branch.
- All existing client tests pass; new `RequireOwner` tests pass.
- No server behavior changes.
