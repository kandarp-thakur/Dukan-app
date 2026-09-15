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

## Invoice Delivery

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/invoices/:id/email` | 🔒 | multipart: `pdf` (file, ≤ 5 MB, `application/pdf`), `to`, optional `subject`. 503 if SMTP unset, 502 on transport failure, 400 bad file or recipient, 413 oversize, 404 foreign invoice |
| POST | `/invoices/:id/share` | 🔒 | Returns `{ shareToken, shareUrl, expiresAt }`. Rotates on every call |
| DELETE | `/invoices/:id/share` | 🔒 | Clears the token and its expiry |
| GET | `/public/invoices/:token` | 🌐 | Unauthenticated reduced projection. 404 for unknown, expired or revoked tokens |
| GET | `/config/features` | 🔒 | `{ email: boolean }` |

`🌐` = public (no session); `🔒` = authenticated (any role). The public token route lives outside the tenant
middleware chain — the token itself is the authorization. The public payload is rebuilt field-by-field, so
internal fields (`businessId`, `shareToken`, `shareTokenExpiresAt`, `paymentMethod`, `customerId`) never leak.

### Invoice delivery settings (server env)

| Variable | Default | Purpose |
|---|---|---|
| `SMTP_HOST` | (empty) | SMTP server host. Empty disables email; `POST /invoices/:id/email` then answers 503 |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | `true` for implicit TLS (port 465), `false` for STARTTLS |
| `SMTP_USER` | (empty) | SMTP username |
| `SMTP_PASS` | (empty) | SMTP password |
| `MAIL_FROM` | (empty) | From address on outgoing invoice mail |
| `SHARE_LINK_BASE_URL` | `http://localhost:5173` | Base for public links: `${SHARE_LINK_BASE_URL}/i/${token}` (trailing slash trimmed) |
| `SHARE_LINK_TTL_DAYS` | `30` | Days until a public share link expires |

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
