# brain.md — Project Master Context

**Project:** acc-app-shubham — Business Accounting SaaS for small Indian businesses
**Purpose of this file:** the single "brain" document. Read this first when returning to the project — it captures what the app is, the decisions made, where things live, and what's planned. Kept current by the team.

## 1. What This App Is

A multi-tenant SaaS web app for small Indian businesses (shops/traders) to manage:

- **Sales** (cash / UPI / card / credit) with automatic invoice numbering
- **Expenses** (categorized)
- **Customer khata** — credit ledger per customer, running balance, statements
- **Suppliers** — purchases, supplier payments, outstanding payables
- **Products & basic inventory** — stock, low-stock alerts
- **Reports** (owner-only) — daily / monthly / outstanding
- **Business profile, staff management, Free/Pro subscription tiers** (UI + gating only; no payment gateway in v1)

**Target user:** small shop owners in India who track daily cash/UPI/card sales, give credit to customers, and buy on credit from suppliers.

**Not in v1:** Razorpay payments, email invitations, barcode scanning, GST filing, multi-currency, offline mode, COGS-based profit.

## 2. Stack & Conventions

| Layer | Technology |
|---|---|
| Database | MongoDB (Mongoose), one shared DB, multi-tenant via `businessId` scoping |
| Server | Node.js + Express, JWT auth (access ~15 min + refresh ~7 d httpOnly cookie), bcrypt, helmet, CORS to client origin |
| Client | React 18 + Vite, Tailwind CSS, React Router v6, axios, lucide-react (icons) |
| Tests | Server: Jest + Supertest + in-memory MongoDB · Client: Vitest + React Testing Library |
| Money | Stored as **paise integers** (₹123.45 → 12345); converted at the edges via `client/src/utils/money.js` |
| Response envelope | `{ success, message, data?, errors? }` — client unwraps `.data.data` |

## 3. Repository Layout

```
acc-app-shubham/
├── client/                  # React 18 + Vite + Tailwind
│   └── src/
│       ├── api/             # axios instance (client.js) + endpoint functions (endpoints.js)
│       ├── components/      # AppShell (sidebar + header + outlet)
│       ├── context/         # AuthContext (login/logout/refresh, user + business)
│       ├── pages/           # 14 pages: Login, Register, Dashboard, Sales, SaleDetail,
│       │                    #   Expenses, Customers, CustomerDetail, Suppliers,
│       │                    #   SupplierDetail, Products, Reports, Staff, Settings, Subscription
│       ├── test/            # Vitest setup
│       └── utils/           # money.js (paise ⇄ ₹), format.js (dates)
├── server/
│   └── src/
│       ├── config/          # db.js (Mongoose connect)
│       ├── controllers/     # one per feature area
│       ├── middleware/      # auth.js (authenticate/tenantScope/requireRole), errors.js, validate.js
│       ├── models/          # User, Business, Sale, Expense, Customer, KhataEntry,
│       │                    #   Supplier, Purchase, SupplierPayment, Product, Invoice
│       ├── routes/          # one router per feature, mounted in routes/index.js under /api/v1
│       └── utils/           # tokens.js
└── docs/                    # THIS FILE + specs, plans, style guide, API docs
```

## 4. Core Domain Rules

- **Tenancy:** every business document carries `businessId`. The `authenticate → tenantScope → requireRole` middleware chain scopes all queries to the caller's business; owner-only operations are role-gated.
- **Roles:** `owner` (full access) and `staff` (no reports/settings/subscription/staff pages or endpoints).
- **Customer balance** = Σ khata credits − Σ khata payments (recomputed on write, stored on the customer).
- **Supplier balance** = Σ credit purchases − Σ supplier payments (same pattern).
- **Stock:** sale decrements `stockQty`; purchase increments it. Cancelling a sale restores stock and khata.
- **Cash balance** = Σ(paid sales) − Σ(paid expenses) − Σ(supplier payments). Credit never touches cash.
- **Profit (v1 simplification)** = sales total − expenses.
- **Invoice numbers:** `invoicePrefix + invoiceCounter`, counter incremented per sale.

## 5. Key Flows

1. **Auth:** register → creates owner + business → access token in memory + refresh cookie → `GET /auth/me` hydrates AuthContext. Client axios instance auto-refreshes on 401.
2. **Sale:** pick item/qty/rate → optional discount/tax → payment method; credit requires a customer → server decrements stock, creates khata entry (credit) if needed, increments invoice counter.
3. **Khata payment:** recorded via `POST /khata/payments`; recomputes customer balance.
4. **Supplier flow:** record purchase (credit increases payable) → record supplier payment (decreases payable).

## 6. UI System (Glassmorphism)

- **Style:** rich light glassmorphism, green/mint brand. Full details: `docs/ui-style-guide.md`
- **Design tokens:** `client/tailwind.config.js` — `primary #2E7D32`, `accent #4CAF50`, combined glass shadows (`shadow-glass`, `shadow-glass-lg`), `shadow-btn-glow`
- **Component classes:** `client/src/index.css` `@layer components` — `.glass`, `.glass-card`, `.glass-input`, `.btn-primary` (gradient), `.btn-ghost`, `.btn-danger`, `.badge` + variants, `.skeleton`, `.empty-state`, `.glass-table`
- **Background:** CSS-only multi-blob gradient (mint base + green/blue/lilac/teal blobs), `background-attachment: fixed`
- **Icons:** lucide-react everywhere (no emoji). Nav: LayoutDashboard, Receipt, Wallet, Users, Truck, Package, BarChart3, UserCog, Settings, Crown
- **Motion:** none except `.skeleton` shimmer (deliberate decision)

## 7. Documentation Map

| Doc | What it covers |
|---|---|
| `docs/brain.md` | This file — master context |
| `docs/ARCHITECTURE.md` | System architecture, multi-tenancy, request lifecycle, data model |
| `docs/API.md` | Full REST API reference (all endpoints, payloads, auth requirements) |
| `docs/ui-style-guide.md` | Glass design system: colors, tokens, component classes, recipes |
| `docs/superpowers/specs/2026-09-10-business-accounting-saas-design.md` | Original product design spec (features, data model, API design) |
| `docs/superpowers/specs/2026-09-11-glassmorphism-redesign-design.md` | UI depth redesign spec |
| `docs/superpowers/plans/2026-09-10-foundation.md` | Implementation plan for the foundation build |

## 8. Development Commands

| Command | What it does |
|---|---|
| `npm run install-all` | Installs root + client + server dependencies |
| `npm run dev` | API on :5000 + client on :5173 (client proxies `/api`) |
| `npm run test:server` | Jest + Supertest + in-memory MongoDB |
| `npm run test:client` | Vitest + React Testing Library |
| `cd client && npx eslint .` | Lint the client |

**Env:** server needs `MONGO_URI`, `JWT_SECRET`, `PORT` (see `server/.env.example`); client needs `VITE_API_URL` (see `client/.env.example`).

## 9. Decisions Log

| Date | Decision |
|---|---|
| 2026-09-10 | MERN stack, multi-tenant via `businessId` scoping, paise integers, JWT dual-token auth, Free/Pro tiers without gateway, client-side print-to-PDF invoices |
| 2026-09-11 | UI: rich light glassmorphism (green brand), depth pass only, lucide-react icons, CSS token/class approach (no shared-component extraction), no dark mode, no motion; docs set: brain.md + ARCHITECTURE.md + API.md + ui-style-guide.md |

## 10. Current State & Roadmap

- **Done:** foundation build (auth, business, staff, all feature CRUD, khata, dashboard, reports, subscription UI, full server + client test suites)
- **In progress:** glassmorphism depth redesign (spec approved; implementation plan next)
- **Next candidates:** shared UI components extraction (StatCard/PageHeader/DataTable), Recharts dashboard charts, invoice print-to-PDF template, Razorpay integration, COGS-based profit, GST reports

When making changes: keep this file updated (state, decisions, roadmap), follow the UI style guide for any new surface, and route all new endpoints through the tenant-scope middleware chain.
