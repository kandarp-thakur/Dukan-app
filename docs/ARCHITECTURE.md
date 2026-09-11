# Architecture

**App:** acc-app-shubham — multi-tenant business accounting SaaS
**Context:** see `docs/brain.md` for the project overview. This document describes how the system is built.

## 1. System Overview

```
┌─────────────────────┐         /api/v1 (axios, JWT)         ┌──────────────────────┐
│  React SPA (Vite)   │ ───────────────────────────────────▶ │  Express API (Node)  │
│  client/ :5173      │ ◀─────────────────────────────────── │  server/ :5000       │
│  Tailwind glass UI  │      { success, message, data }      │  Mongoose            │
└─────────────────────┘                                      └─────────┬────────────┘
                                                                       │
                                                             ┌─────────▼────────────┐
                                                             │  MongoDB (shared DB) │
                                                             │  businessId-scoped   │
                                                             │  collections         │
                                                             └──────────────────────┘
```

- **Client:** React 18 + Vite + Tailwind CSS + React Router v6. State via React Context (`AuthContext`) — no Redux. API access through a single axios instance with automatic token refresh.
- **Server:** Express with layered structure — routes → middleware → controllers → Mongoose models. Central error handling.
- **Database:** one MongoDB database, shared collections, tenant isolation by `businessId` on every document.

## 2. Multi-Tenancy Model

Every business document carries an indexed `businessId`. Isolation is enforced by the middleware chain in `server/src/middleware/auth.js`:

1. **`authenticate`** — verifies the JWT access token, loads `req.user` (`id`, `role`, `businessId`)
2. **`tenantScope`** — injects `req.user.businessId` into queries/bodies so all reads/writes are scoped to the caller's business
3. **`requireRole('owner')`** — gates owner-only operations (reports, settings, subscription, staff management, deletes)

Controllers always filter by `businessId` — there are no raw unscoped queries. Business A can never read or write business B's data (covered by server tests).

## 3. Authentication Design

- **Register** creates user (owner) + business; returns tokens
- **Login** returns a short-lived access token (~15 min) plus a refresh token (~7 days) in an httpOnly cookie
- **`POST /auth/refresh`** rotates access tokens; the client axios interceptor retries once on 401 after refreshing
- **Staff creation:** owner creates a staff account with a temp password (shared out-of-band); staff can change password via `PATCH /auth/password`
- Passwords hashed with bcrypt

## 4. Request Lifecycle (Server)

```
request
  → helmet / CORS / body limits / cookie parsing
  → routes/index.js mounts feature routers under /api/v1
  → validate (express-validator) — body param checks
  → authenticate → tenantScope → (requireRole where needed)
  → controller (business logic + Mongoose queries, always businessId-scoped)
  → response envelope { success, message, data?, errors? }
  → central error middleware (errors.js): maps Mongoose
    validation/cast/duplicate → 400/409, unknown IDs → 404, forbidden → 403
```

## 5. Data Model

Money fields are **paise integers** (₹123.45 → 12345). All business collections carry an indexed `businessId`.

| Collection | Key fields | Notes |
|---|---|---|
| `users` | name, email (unique), passwordHash, role (`owner`\|`staff`), businessId | JWT auth |
| `businesses` | name, logoUrl, address, gstin, currency, invoicePrefix, invoiceCounter, plan (`free`\|`pro`), planExpiresAt | Edited from Settings |
| `sales` | items[{productId, name, qty, rate, amount}], subtotal, discount, tax, total, paymentMethod (`cash`\|`upi`\|`card`\|`credit`), customerId?, invoiceNumber, status | Credit sales create a khata credit entry |
| `expenses` | category, amount, paymentMethod, note, date | Categories: rent, salary, stock, transport, electricity, other |
| `customers` | name, phone, balance | Balance denormalized for fast lists |
| `khataEntries` | customerId, type (`credit`\|`payment`), amount, saleId?, note, date | credit = customer owes; payment = customer paid |
| `suppliers` | name, phone, balance | Payable balance (business owes supplier) |
| `purchases` | supplierId, items[{productId, name, qty, cost}], total, paymentMethod, status | Credit purchases increase supplier payable |
| `supplierPayments` | supplierId, amount, method, note, date | Payments made to suppliers |
| `products` | name, sku?, purchasePrice, sellingPrice, stockQty, lowStockThreshold | Low stock when stockQty ≤ threshold |
| `invoices` | saleId, invoiceNumber, pdfUrl? | History of generated invoices |

### Balance & aggregate math

- Customer balance = Σ(khata credits) − Σ(khata payments); recomputed on write, stored on customer
- Supplier balance = Σ(credit purchases) − Σ(supplier payments); same pattern
- Stock: sale decrements `stockQty`, purchase increments it; cancelling a sale restores both stock and khata
- Cash balance = Σ(paid sales) − Σ(paid expenses) − Σ(supplier payments); credit never affects cash
- Profit (v1) = sales total − expenses (COGS-based profit deferred)

## 6. Client Architecture

```
client/src/
├── api/client.js        # axios instance: baseURL /api/v1, interceptors, auto-refresh on 401
├── api/endpoints.js     # typed endpoint groups (productsApi, salesApi, …) unwrapping the envelope
├── context/AuthContext.jsx  # login/logout/refresh, user + business state, hydration via /auth/me
├── components/AppShell.jsx  # sidebar + mobile header + <Outlet/>, role-filtered nav
├── pages/               # one file per route (14 pages)
├── utils/money.js       # paise ⇄ rupees conversion, formatINR
└── utils/format.js      # date formatting
```

- **Routing:** public `/login`, `/register`; everything else wrapped in `ProtectedRoutes` → `AppShell` layout. Owner-only pages additionally filtered by role (client nav + server middleware).
- **Styling:** glassmorphism design system — tokens in `tailwind.config.js`, component classes in `index.css` `@layer components`. See `docs/ui-style-guide.md`.
- **Data fetching:** pages own their `useEffect` + local state pattern with cancellation flags; endpoint functions in `api/endpoints.js`.

## 7. Testing Strategy

- **Server (Jest + Supertest, in-memory MongoDB):** tenant isolation, auth guards (401/403), balance math, sales flow (stock, khata, invoice counter), model validation, middleware behavior
- **Client (Vitest + React Testing Library):** page rendering and interactions queried by text/role/label (decoupled from styling), API client unwrapping, money/format utils, theme smoke tests
- **Manual E2E:** register → products → cash + credit sale → verify stock/khata/dashboard → reports

## 8. Security & Performance

- bcrypt hashing, httpOnly refresh cookie, helmet, CORS restricted to client origin, request body limits
- Indexes on `businessId` + date fields for all business collections
- Deployment target: any Node host (Render/Railway) + MongoDB Atlas; client on Vercel/Netlify

## 9. Future Considerations

Razorpay subscription payments (plan fields already in the model), email staff invitations, stock movement audit trail, COGS-based profit, GST report helpers, PWA/offline sync, Recharts dashboard visualizations.
