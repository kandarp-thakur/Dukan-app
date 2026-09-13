# Invoices Section with GST & Non-GST Support — Design

**Date:** 2026-09-13
**Status:** Approved (in-chat design validated section by section)
**Scope:** Dedicated Invoices section (list, detail, print, share) for the accounting app, with GST and non-GST invoice support on the sale-driven model.

---

## 1. Context & Goal

The app (MERN, multi-tenant via `businessId`, paise integers, glassmorphism UI) currently has:

- An [`Invoice`](server/src/models/Invoice.js) model (businessId, saleId, invoiceNumber, pdfUrl) auto-created per sale in [`saleController.createSale`](server/src/controllers/saleController.js)
- A printable invoice view embedded in [`SaleDetail.jsx`](client/src/pages/SaleDetail.jsx) via `react-to-print`
- No dedicated Invoices section: no nav item, no `/invoices` routes, no invoice list page, no invoice API endpoints
- A single flat `tax` field on sales; no GST structure (no CGST/SGST/IGST, no buyer GSTIN, no HSN)

**Goal:** A full Invoices section supporting both GST and non-GST invoices, where:

- Invoices stay **sale-driven** — every sale auto-generates its invoice; the Invoices section lists/prints/shares invoices for existing sales
- The sale form gains a **GST toggle** plus GST fields (per-item GST rate, HSN, buyer GSTIN/address, place of supply)
- GST invoices render with a proper GST template: buyer block, HSN-wise tax breakup, CGST/SGST/IGST split

**Chosen approach (of three considered):** GST fields live on the Sale document; `/invoices` endpoints are a read model over Sales. The existing `Invoice` collection remains the history record (future pdfUrl). This keeps one source of truth, computes totals where they already are, and gives dashboard/reports GST data for free. Rejected alternatives: GST snapshot on the Invoice document (totals computed in two places, reports blind to GST) and a fully denormalized immutable invoice store (duplication, sync burden, overkill since sales can't be edited).

## 2. Data Model

### 2.1 Sale schema changes ([`Sale.js`](server/src/models/Sale.js))

Sale items gain:

| Field | Type | Default | Notes |
|---|---|---|---|
| `gstRate` | Number | `0` | One of `[0, 5, 12, 18, 28]` (percent) |
| `hsn` | String | `''` | HSN/SAC code, shown on GST invoice |

The sale document gains:

| Field | Type | Default | Notes |
|---|---|---|---|
| `isGst` | Boolean | `false` | The GST / non-GST toggle |
| `buyerGstin` | String | `''` | Snapshot; auto-filled from customer, editable |
| `buyerName` | String | `''` | Snapshot |
| `buyerAddress` | String | `''` | Snapshot |
| `placeOfSupply` | String | `''` | Two-letter Indian state code (e.g. `MH`) |
| `cgst` | Number | `0` | Paise, computed |
| `sgst` | Number | `0` | Paise, computed |
| `igst` | Number | `0` | Paise, computed |

### 2.2 GST computation

**Division of labor:** the `pre('validate')` hook on [`Sale.js`](server/src/models/Sale.js) keeps computing line arithmetic (`amount`, `subtotal`, `total`) as today. The **GST split is computed by the sale controller** via the shared `computeGst()` util — because the intra/inter-state decision needs the business GSTIN, which only the controller has (it already loads the business for invoice numbering). The computed `cgst`/`sgst`/`igst`/`tax` are set on the `Sale.create()` payload, so the hook's `total = subtotal − discount + tax` picks them up.

1. Line totals as today: `amount = qty × rate` (rates are pre-GST / tax-exclusive)
2. Discount stays sale-level and is **allocated proportionally across lines** before GST is applied, so the taxable base is correct: `taxableValue_i = amount_i − discount × (amount_i / subtotal)`. Each line's taxable value is rounded to the nearest paise; the **last line absorbs the rounding remainder** so allocated discount always sums exactly to `discount`.
3. If `isGst` is true:
   - `gstTotal = Σ(taxableValue_i × gstRate_i / 100)` (rounded to nearest paise)
   - Inter-state (`placeOfSupply` ≠ business GSTIN state code): `igst = gstTotal`, `cgst = sgst = 0`
   - Intra-state: `cgst = sgst = gstTotal / 2`; paise rounding remainder (odd `gstTotal`) goes to CGST
   - `tax = cgst + sgst + igst` — the existing field keeps meaning "total tax", so dashboard/reports continue to work unchanged
4. `total = subtotal − discount + tax` (unchanged formula, computed in the hook)
5. If `isGst` is false: `cgst = sgst = igst = 0`; `tax` behaves as before (accepted from payload for backward compatibility)

### 2.3 GSTIN state derivation — shared `utils/gst.js`

A new server util `server/src/utils/gst.js`, mirrored as `client/src/utils/gst.js`:

- `stateCodeFromGstin(gstin)` — first 2 digits of a GSTIN are the state code
- `INDIAN_STATES` — map of state code → name (all 37 codes)
- `isIntraState(businessGstin, placeOfSupply)` — compares derived state codes
- `computeGst(items, discount, isGst, intraState)` — pure function returning `{ cgst, sgst, igst, tax, taxableValue }` used by both the model hook (via require) and the client's live preview

### 2.4 Migration

Old sales have none of the new fields → Mongoose defaults make them non-GST (`isGst: false`, zero tax split). They display exactly as today. **No data migration script needed.**

### 2.5 Customer schema changes ([`Customer.js`](server/src/models/Customer.js))

Add `gstin` (String, default `''`) and `address` (String, default `''`). Customer create/edit forms gain these fields; GSTIN validated as 15 chars when present (same rule the business already uses).

## 3. API

### 3.1 New invoice endpoints

New `server/src/routes/invoiceRoutes.js` + `server/src/controllers/invoiceController.js`, mounted at `/invoices` in [`routes/index.js`](server/src/routes/index.js), following the existing router pattern (`authenticate` + `tenantScope`):

| Method | Path | Auth | Query | Response |
|---|---|---|---|---|
| GET | `/invoices` | 🔒 | `q` (invoice number or customer/buyer name, case-insensitive regex), `type` (`gst`\|`non-gst`), `from`/`to` (ISO dates) | `{ invoices }` — sales with `invoiceNumber` set, sorted by date desc; each item: `id`, `invoiceNumber`, `date`, `buyerName`, `total`, `isGst`, `status` |
| GET | `/invoices/:id` | 🔒 | — | `{ invoice }` — the full sale document (same shape as `GET /sales/:id`) plus a `business` snapshot (name, address, gstin) so the print view is self-contained |

Query validation (express-validator): `type` ∈ {`gst`, `non-gst`} if present; `from`/`to` ISO8601 if present; `to >= from` else 400.

### 3.2 `POST /sales` changes

Validation ([`saleRoutes.js`](server/src/routes/saleRoutes.js)) accepts new fields:

- `isGst` (boolean, optional)
- `items.*.gstRate` — one of 0/5/12/18/28
- `items.*.hsn` (optional string)
- `buyerGstin` / `buyerName` / `buyerAddress` (optional strings; `buyerGstin` 15 chars when present)
- `placeOfSupply` (optional, must be a known 2-letter state code)

Controller rules ([`saleController.js`](server/src/controllers/saleController.js)):

- If `isGst` → business must have `gstin` set, else 400 `"GST invoice requires business GSTIN"`
- If `isGst` and any line has `gstRate > 0` but no `hsn` → 400 `"HSN code is required for taxed items"`
- When a `customerId` is provided, `buyerName` defaults from the customer record (explicit payload value wins) — for **every** sale, so invoice search by customer name works on non-GST sales too. When `isGst` is additionally true, `buyerGstin`/`buyerAddress` also default from the customer record; explicit payload values win.
- The old `tax` input is **removed from the sale form** (GST computed from rates). The API keeps accepting `tax` for backward compatibility but ignores it when `isGst` is true.

### 3.3 Client API layer

New `invoicesApi = { list, get }` in [`endpoints.js`](client/src/api/endpoints.js) alongside `salesApi`.

## 4. Client UI

### 4.1 Navigation & routing

- New "Invoices" nav item (lucide `FileText` icon) in [`AppShell.jsx`](client/src/components/AppShell.jsx) after Sales, visible to all roles
- New routes in [`App.jsx`](client/src/App.jsx): `/invoices` and `/invoices/:id`

### 4.2 Invoices list page (`client/src/pages/Invoices.jsx`)

Follows the glassmorphism patterns of [`Sales.jsx`](client/src/pages/Sales.jsx):

- Filter bar: search input (invoice number / buyer name), `type` select (All / GST / Non-GST), `from`/`to` date inputs — debounced, re-querying `invoicesApi.list(params)`
- `.glass-table` columns: Invoice #, Date, Buyer, Type (badge: `badge-success` GST / `badge-neutral` non-GST), Total, Status — row click → `/invoices/:id`
- Skeleton rows while loading, `FileText` empty state, error banner — matching existing page conventions

### 4.3 Invoice detail page (`client/src/pages/InvoiceDetail.jsx`)

Dedicated print-optimized view replacing the invoice rendering embedded in SaleDetail:

- **Non-GST:** today's layout (business header, items table, totals, amount-in-words, thank-you footer) — unchanged
- **GST:** buyer block (name, address, GSTIN) opposite the seller block; `Place of Supply` line; HSN + GST-rate columns in the items table; **HSN-wise tax breakup table** (HSN, taxable value, CGST, SGST/IGST rate+amount, total tax) above the totals block; totals show CGST / SGST / IGST lines instead of a single "Tax" line
- Actions: "Print invoice" (existing `react-to-print` pattern) and **Share** — Web Share API (`navigator.share` with title + text summary) with copy-to-clipboard fallback (copies invoice number + total + link)
- The invoice card stays white/opaque and print-optimized (`print:hidden` chrome), per the glassmorphism plan's constraint
- [`SaleDetail.jsx`](client/src/pages/SaleDetail.jsx) keeps sale-management actions (cancel/delete) and links to `/invoices/:id` for the invoice view; its embedded print card is removed to avoid duplication

### 4.4 Sale form changes ([`Sales.jsx`](client/src/pages/Sales.jsx))

- **GST toggle button** ("GST invoice" / "Non-GST") at the top of the form
- When GST is on: per-item `gstRate` select (0/5/12/18/28%) + `hsn` input appear; buyer fields (name, GSTIN, address) auto-fill from the selected customer and become editable; place-of-supply select (Indian states) auto-derived from buyer GSTIN vs business GSTIN, overridable
- The old flat "Tax (₹)" input is removed (GST computed from rates); discount stays
- Live preview line under the form: subtotal, discount, CGST/SGST or IGST, total — computed client-side with the mirrored `utils/gst.js` so the user sees the math before saving

### 4.5 Customers page

Customer form gains GSTIN + address fields (optional, GSTIN 15-char validation when present).

## 5. Error Handling

**Server (all flow through the existing [`errors.js`](server/src/middleware/errors.js) middleware → `{ success: false, message }` envelope):**

| Condition | Response |
|---|---|
| GST sale without business GSTIN | 400 `"GST invoice requires business GSTIN"` |
| GST sale, line with `gstRate > 0` but no `hsn` | 400 `"HSN code is required for taxed items"` |
| `buyerGstin` present but not 15 chars | 400 (express-validator) |
| `placeOfSupply` not a known state code | 400 (express-validator) |
| `gstRate` outside allowed set | 400 (express-validator) |
| `to < from` on invoice list | 400 `"'to' must be after 'from'"` |

**Client:** server messages surface in the existing red error banners on the sale form and invoice pages; the share fallback silently degrades to clipboard copy; clipboard failure shows a toast-style inline message.

## 6. Testing

### 6.1 Server (Jest + Supertest, in-memory MongoDB)

New `tests/invoices.test.js` + additions to `tests/sales.test.js`:

- GST math: intra-state (CGST = SGST = half), inter-state (IGST full), mixed rates across items, discount-allocated GST base, paise rounding (odd remainder to CGST)
- Validation: all 400 rules above; `gstRate` outside allowed set rejected
- Tenant isolation: business A cannot list/get business B's invoices
- List endpoint: search by invoice number, by buyer name, `type` filter, date range, empty result shape
- Backward compatibility: sale created without GST fields → `isGst: false`, totals unchanged vs. old behavior

### 6.2 Client (Vitest + React Testing Library)

New `Invoices.test.jsx`, `InvoiceDetail.test.jsx`; updates to `Sales.test.jsx`, `Customers.test.jsx`:

- Invoices list: renders rows, filter controls present, GST/non-GST badges, empty state
- InvoiceDetail: GST fields (buyer GSTIN, HSN breakup table, CGST/SGST/IGST lines) and non-GST layout; print button; share button with clipboard fallback
- Sale form: GST toggle reveals rate/HSN/buyer fields; live tax preview math; customer auto-fill of buyer fields
- Customer form: GSTIN + address inputs, 15-char validation message

### 6.3 Manual E2E (user-run; no browser automation)

Set business GSTIN → create GST sale with 18% item → verify invoice shows HSN breakup + CGST/SGST → create inter-state variant → verify IGST → print both → verify non-GST sale renders as before.

## 7. Out of Scope (v1)

- e-Way Bill generation (separate future feature)
- PDF generation beyond print-to-PDF (`pdfUrl` stays unused)
- GST reports (GSTR-style summaries) — data now exists; reports are a future milestone
- Editing/cancelled-invoice credit notes
- Multi-currency (stays INR)
