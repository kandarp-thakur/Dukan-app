# API Reference

**Base URL:** `/api/v1` (dev: client proxies `/api` → server on :5000)
**Envelope:** all responses use `{ success, message, data?, errors? }` — the client unwraps `data`.
**Auth:** `Authorization: Bearer <accessToken>` (short-lived). Refresh token rides an httpOnly cookie.
**Money:** all amounts are **paise integers** (₹123.45 → `12345`).

Legend: 🔓 public · 🔒 authenticated (any role) · 👑 owner-only

## Auth

| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/auth/register` | 🔓 | `{ name, email, password, businessName }` | user + business + tokens |
| POST | `/auth/login` | 🔓 | `{ email, password }` | user + tokens (refresh in httpOnly cookie) |
| POST | `/auth/refresh` | 🔓 (cookie) | — | new access token |
| POST | `/auth/logout` | 🔓 | — | clears refresh cookie |
| GET | `/auth/me` | 🔒 | — | user + business |
| PATCH | `/auth/password` | 🔒 | `{ currentPassword, newPassword }` | success |

## Business

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/business` | 🔒 | — | business profile |
| PATCH | `/business` | 👑 | `{ name?, address?, gstin?, currency?, invoicePrefix? }` | updated business |
| POST | `/business/upgrade-request` | 👑 | `{ plan }` | logs upgrade intent (v1: no gateway) |

## Users / Staff

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/users` | 👑 | — | staff list |
| POST | `/users` | 👑 | `{ name, email, password, role }` | created user (temp password flow) |
| PATCH | `/users/:id/role` | 👑 | `{ role }` | updated user |
| DELETE | `/users/:id` | 👑 | — | success |

## Dashboard

| Method | Path | Auth | Query | Returns |
|---|---|---|---|---|
| GET | `/dashboard/summary` | 🔒 | `range=today\|month` | `{ salesTotal, expensesTotal, profit, cashBalance, receivable, payable }` |

## Sales

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/sales` | 🔒 | — | sales list |
| GET | `/sales/:id` | 🔒 | — | sale detail |
| POST | `/sales` | 🔒 | `{ items:[{ name, qty, rate }], discount?, tax?, paymentMethod, customerId? }` | created sale (decrements stock; credit → khata entry; increments invoice counter) |
| PATCH | `/sales/:id/cancel` | 🔒 | — | cancelled sale (restores stock + khata) |
| DELETE | `/sales/:id` | 👑 | — | success |

`paymentMethod`: `cash` | `upi` | `card` | `credit` (credit requires `customerId`).

## Expenses

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/expenses` | 🔒 | — | expense list |
| POST | `/expenses` | 🔒 | `{ category, amount, paymentMethod, note?, date? }` | created expense |
| PATCH | `/expenses/:id` | 🔒 | partial updates | updated expense |
| DELETE | `/expenses/:id` | 👑 | — | success |

`category`: `rent` | `salary` | `stock` | `transport` | `electricity` | `other`.

## Customers & Khata

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/customers` | 🔒 | — | customers (with balances) |
| POST | `/customers` | 🔒 | `{ name, phone? }` | created customer |
| PATCH | `/customers/:id` | 🔒 | partial updates | updated customer |
| DELETE | `/customers/:id` | 👑 | — | success |
| GET | `/customers/:id/khata` | 🔒 | — | khata statement (entries + balance) |
| POST | `/khata/payments` | 🔒 | `{ customerId, amount, note?, date? }` | payment entry, recomputed balance |

## Suppliers, Purchases & Supplier Payments

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/suppliers` | 🔒 | — | suppliers (with payables) |
| POST | `/suppliers` | 🔒 | `{ name, phone? }` | created supplier |
| PATCH | `/suppliers/:id` | 🔒 | partial updates | updated supplier |
| DELETE | `/suppliers/:id` | 👑 | — | success |
| GET | `/suppliers/:id/statement` | 🔒 | — | purchases + payments + balance |
| POST | `/purchases` | 🔒 | `{ supplierId, items:[{ name, qty, cost }], paymentMethod }` | created purchase (credit → payable; increments stock) |
| GET | `/purchases` | 🔒 | — | purchase list |
| POST | `/supplier-payments` | 🔒 | `{ supplierId, amount, method, note?, date? }` | payment, recomputed payable |

## Products

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/products` | 🔒 | — | product list |
| GET | `/products/low-stock` | 🔒 | — | products at/below threshold |
| POST | `/products` | 🔒 | `{ name, sku?, purchasePrice, sellingPrice, stockQty, lowStockThreshold? }` | created product |
| PATCH | `/products/:id` | 🔒 | partial updates | updated product |
| DELETE | `/products/:id` | 👑 | — | success |

## Reports (owner-only)

| Method | Path | Auth | Query | Returns |
|---|---|---|---|---|
| GET | `/reports/daily` | 👑 | `date=YYYY-MM-DD` | day summary |
| GET | `/reports/monthly` | 👑 | `month=YYYY-MM` | month summary |
| GET | `/reports/outstanding` | 👑 | — | receivables + payables |

## Plans

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/plans` | 🔓 | available plans (Free / Pro) |

## Error Codes

| Status | Meaning |
|---|---|
| 400 | validation / cast error (see `errors`) |
| 401 | missing/invalid token |
| 403 | role-gated operation or cross-tenant access |
| 404 | unknown ID / route |
| 409 | duplicate (e.g. email already registered) |
| 500 | unexpected server error |

## Client Usage

Endpoint functions live in `client/src/api/endpoints.js` (e.g. `salesApi.create(payload)`), built on the axios instance in `client/src/api/client.js` which auto-refreshes the access token on 401 and unwraps the response envelope.
