# Vyapar-style Business Accounting SaaS — Design Document

**Date:** 2026-09-10
**Status:** Approved (all design sections reviewed with stakeholder)
**Project codename:** acc-app-shubham

## 1. Overview

A multi-tenant SaaS web application for small Indian businesses to manage sales, expenses, customer credit (khata), suppliers, basic inventory, invoicing, and business reports — with a light-green glassmorphism UI.

**Target user:** Small shop owners / traders in India who track daily cash/UPI/card sales, give credit to customers, buy on credit from suppliers, and need simple professional invoices.

## 2. Confirmed Decisions

| Decision | Choice |
|---|---|
| Deliverable | Full-stack app (frontend + backend + database) |
| Tenancy | Multi-tenant SaaS — each business sees only its own data |
| Stack | MERN: MongoDB, Express, React (Vite), Node.js |
| Subscription v1 | Plan tiers UI + feature gating (Free/Pro); no payment gateway; Razorpay-ready data model |
| Users per business | Owner + staff roles from day one |
| Tenant isolation | Shared collections with `businessId` scoping enforced by middleware |
| Repo layout | Monorepo: `client/` + `server/` |
| Money storage | Paise integers (₹123.45 → 12345) |
| Invoices | Client-side print-to-PDF via `react-to-print` |
| Auth | JWT (access ~15min + refresh ~7d httpOnly cookie) |

## 3. Features (v1 scope)

1. **Business Dashboard** — sales, expenses, profit, cash balance, outstanding (receivable + payable) totals with charts
2. **Sales Management** — add/edit sales; payment via cash, UPI, card, or credit
3. **Expense Management** — record expenses with category and payment method
4. **Customer Khata** — credit/payment entries, running balance, per-customer statement
5. **Supplier Management** — purchases, supplier payments, outstanding payables
6. **Product & Basic Inventory** — products with prices, stock qty, low-stock indication
7. **Invoice Generation** — generate, download (print-to-PDF), share invoices
8. **Business Reports** — daily/monthly sales, expenses, profit, outstanding reports
9. **Business Profile & Settings** — name, logo, address, GSTIN, invoice settings, currency
10. **Subscription & User Account** — Free/Pro plans, owner + staff management

**Explicitly out of scope for v1:** real payment gateway (Razorpay), email invitations, stock movement audit trail, barcode scanning, GST filing, multi-currency, offline mode.

## 4. Architecture

### 4.1 Project structure

```
acc-app-shubham/
├── client/                  # React 18 + Vite + Tailwind CSS
│   └── src/
│       ├── components/      # Reusable UI (glass cards, modals, tables)
│       ├── pages/           # One per feature area
│       ├── hooks/           # Data-fetching hooks (useSales, useKhata…)
│       ├── api/             # Axios instance + endpoint functions
│       ├── context/         # AuthContext, BusinessContext
│       └── utils/           # money formatting (paise → ₹ display)
└── server/                  # Node + Express + Mongoose
    └── src/
        ├── models/          # Mongoose schemas (one file per collection)
        ├── routes/          # Express routers
        ├── controllers/     # Business logic
        ├── middleware/      # authenticate, tenantScope, requireRole, errors
        └── config/          # db.js, env.js
```

### 4.2 Multi-tenancy model

One MongoDB database, shared collections. Every business document carries `businessId`. Isolation is enforced by:

1. `authenticate` middleware — verifies JWT, loads `req.user` (id, role, businessId)
2. `tenantScope` middleware — injects `req.user.businessId` into every query/body so all reads/writes are scoped to the caller's business
3. `requireRole('owner')` — guards reports, settings, subscription, staff management, and delete operations
4. All DB access goes through controllers that always filter by `businessId` — no raw unscoped queries

### 4.3 Auth design

- **Register** creates user (owner) + business in one transaction; returns tokens
- **Login** returns access token + refresh token (httpOnly cookie)
- **Staff creation:** owner creates staff account with a temp password shared out-of-band; staff can change password later. No email infrastructure in v1
- **Password hashing:** bcrypt
- **Token refresh:** `POST /auth/refresh` rotates access tokens

## 5. Data Model

Money fields are paise integers. All business collections carry `businessId` (indexed).

| Collection | Key fields | Notes |
|---|---|---|
| `users` | name, email (unique), passwordHash, role (`owner`\|`staff`), businessId | JWT auth |
| `businesses` | name, logoUrl, address, gstin, currency (default `INR`), invoicePrefix, invoiceCounter, plan (`free`\|`pro`), planExpiresAt | Settings page edits this |
| `sales` | businessId, items[{productId, name, qty, rate, amount}], subtotal, discount, tax, total, paymentMethod (`cash`\|`upi`\|`card`\|`credit`), customerId?, invoiceNumber, status | Credit sales create khata credit entry |
| `expenses` | businessId, category, amount, paymentMethod, note, date | Categories: rent, salary, stock, transport, electricity, other |
| `customers` | businessId, name, phone, balance | Balance = Σ credits − Σ payments, denormalized for fast lists |
| `khataEntries` | businessId, customerId, type (`credit`\|`payment`), amount, saleId?, note, date | credit = customer owes; payment = customer paid |
| `suppliers` | businessId, name, phone, balance | Payable balance (business owes supplier) |
| `purchases` | businessId, supplierId, items[{productId, name, qty, cost}], total, paymentMethod (`cash`\|`upi`\|`card`\|`credit`), status | Credit purchases increase supplier payable |
| `supplierPayments` | businessId, supplierId, amount, method, note, date | Payments made to suppliers |
| `products` | businessId, name, sku?, purchasePrice, sellingPrice, stockQty, lowStockThreshold | Low stock when stockQty ≤ threshold |
| `invoices` | businessId, saleId, invoiceNumber, pdfUrl? | PDF generated client-side; record kept for history |

**Balance math:**
- Customer balance = Σ(khata credits) − Σ(khata payments); recomputed on write, stored on customer
- Supplier balance = Σ(credit purchases) − Σ(supplier payments); recomputed on write, stored on supplier
- Stock: sale decrements product stockQty; purchase increments it

**Dashboard aggregates:**
- Cash balance = Σ(paid sale payments, i.e. cash+upi+card) − Σ(paid expenses, i.e. cash+upi+card) − Σ(supplier payments). Credit transactions never affect cash balance.
- Outstanding receivable = Σ customer balances; payable = Σ supplier balances
- Profit = Σ(sales revenue) − COGS (items' purchase price) − expenses; v1 simplification: profit = sales total − expenses (COGS-based profit deferred)

## 6. API Design

REST, base path `/api/v1`. Response envelope: `{ success, message, data?, errors? }`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/password` |
| Business | `GET /business`, `PATCH /business` (owner), logo upload via multer → `/uploads` |
| Users/Staff | `GET /users` (owner), `POST /users` (owner), `PATCH /users/:id/role` (owner), `DELETE /users/:id` (owner) |
| Dashboard | `GET /dashboard/summary?range=today\|month` |
| Sales | `GET/POST /sales`, `GET/PATCH/DELETE /sales/:id` (DELETE owner-only) |
| Expenses | `GET/POST /expenses`, `PATCH/DELETE /expenses/:id` (DELETE owner-only) |
| Customers | `GET/POST /customers`, `GET/PATCH/DELETE /customers/:id`, `GET /customers/:id/khata` (statement) |
| Khata | `POST /khata/payments` (record customer payment) |
| Suppliers | `GET/POST /suppliers`, `GET/PATCH/DELETE /suppliers/:id`, `GET /suppliers/:id/statement` |
| Purchases | `GET/POST /purchases`, `PATCH/DELETE /purchases/:id` (owner-only delete) |
| Supplier payments | `POST /supplier-payments` |
| Products | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, `GET /products/low-stock` |
| Reports (owner-only) | `GET /reports/daily?date=`, `GET /reports/monthly?month=`, `GET /reports/outstanding` |
| Plans | `GET /plans`, `POST /business/upgrade-request` (v1: logs intent) |

**Validation:** `express-validator` on body params.
**Error handling:** central error middleware maps Mongoose validation/cast/duplicate errors to 400/409; unknown IDs → 404; unscoped access attempts → 403.

## 7. Frontend Design

### 7.1 Theme — Light Green Glassmorphism

- Background: soft gradient mint `#E8F5E9` → light sage `#F1F8F2`
- Primary: deep green `#2E7D32`; accent: fresh green `#4CAF50`
- Glass surfaces: `bg-white/60 backdrop-blur-xl border border-white/40 shadow-lg` (Tailwind)
- Applied to: stat cards, sidebar, modals, tables, forms

### 7.2 Stack & structure

- React 18 + Vite + Tailwind CSS + React Router v6
- Charts: Recharts (sales trend line, expense pie, cash balance area)
- Invoices: `react-to-print` — A4/A5 professional template with logo, GSTIN, itemized rows, totals, amount-in-words, UPI QR hint area. Download = browser print → Save as PDF. Share = Web Share API / copy-link fallback
- State: React Context (auth, business); custom `useApi` hook wrapping axios with auto token refresh. No Redux
- Routes: public `/login`, `/register`; protected shell with sidebar: `/dashboard`, `/sales`, `/expenses`, `/customers`, `/customers/:id`, `/suppliers`, `/products`, `/reports`, `/settings`, `/subscription`, `/staff` (owner-only)
- PWA-ready: `manifest.json` + meta tags (khata apps are mobile-heavy)

### 7.3 Role-based UI

- Staff sees: dashboard, sales, expenses, customers/khata, suppliers, products
- Owner additionally sees: reports, settings, subscription, staff management
- Enforced client-side (nav) and server-side (middleware)

## 8. Testing Strategy

- **Server (Jest + Supertest):**
  - Tenant isolation: business A cannot read/write business B's data (sales, customers, products, reports)
  - Auth guards: unauthenticated → 401; staff hitting owner routes → 403
  - Balance math: khata credits/payments update customer balance; credit purchases/payments update supplier balance
  - Sales flow: sale decrements stock, credit sale creates khata entry, invoice number increments
- **Client (Vitest + React Testing Library):** login form, sale creation form, khata balance display, money formatting
- **Manual E2E:** register business → add products → make cash sale + credit sale → verify stock, khata, dashboard → generate invoice → check reports

## 9. Non-Functional Requirements

- **Environment:** `.env` for `MONGO_URI`, `JWT_SECRET`, `PORT`; client uses `VITE_API_URL`
- **Security:** bcrypt password hashing, httpOnly refresh cookie, helmet, CORS restricted to client origin, request body limits
- **Performance:** indexes on `businessId` + date fields for all business collections
- **Deployment target:** any Node host (Render/Railway) + MongoDB Atlas; client on Vercel/Netlify

## 10. Future Considerations (not v1)

- Razorpay subscription payments (data model already has plan fields)
- Email invitations for staff
- Stock movement audit trail
- COGS-based profit reporting
- GST reports/filing helpers
- Offline/PWA sync
