# Invoice Delivery (PDF, Email, WhatsApp, Public Link) — Design

**Date:** 2026-09-14
**Status:** Approved (in-chat design validated section by section)
**Scope:** Sub-project A of the invoice-enhancements request. Deliver an invoice to a customer: download as PDF, email it with the PDF attached, send a WhatsApp message with a public link, and serve a read-only public invoice page from an expiring share token.

---

## 1. Context & Goal

The Invoices section shipped in [`2026-09-13-invoices-gst-design.md`](docs/superpowers/specs/2026-09-13-invoices-gst-design.md) gives a print-optimized invoice at `/invoices/:id`, built as a read model over `Sale` documents ([`invoiceController.js`](server/src/controllers/invoiceController.js)). Today the only delivery paths are "Print" (via `react-to-print`) and "Share" (`navigator.share` with a clipboard fallback) — both of which require the invoice to already be on screen, and neither puts a file or a lasting link in the customer's hands.

**Goal:** four delivery capabilities for an existing invoice:

1. **Download** the invoice as a PDF file, generated in the browser.
2. **Email** the invoice to a recipient, with the PDF attached.
3. **WhatsApp** a summary plus a public link to the invoice.
4. A **public, read-only invoice page** that the link opens, with no login.

**Chosen approach (of three considered):**

- **Client-side PDF** — `html2canvas` captures the existing printable DOM, `jsPDF` slices it into an A4 page and emits a `Blob`. No server-side Chromium, no PDF storage, no second template. Rejected: server-side headless-Chromium rendering (heavy deploy dependency) and a server-side PDF library with its own layout code (a second template that drifts from the on-screen one).
- **WhatsApp deep link** — `https://wa.me/<digits>?text=<summary + link>`. No Meta Business account, no template approval, no messaging fees. Rejected: WhatsApp Cloud API (setup burden far outweighs the benefit at this stage; also cannot attach the PDF without a template message).
- **Email over nodemailer + SMTP**, behind a single `emailService` seam, with credentials only in `server/.env`. Rejected: a transactional-email SaaS (another vendor account before the feature can be tried at all).

The one new durable artifact is a **share token** on the Sale document. It is opaque, single-invoice, read-only, expiring and revocable.

**Explicitly out of scope:** payment details below the invoice and the UPI QR (sub-project B — the "coming soon" footer placeholder survives the extraction in §3 and stays functionally untouched), warranty (C), e-way bill (D).

---

## 2. Architecture

One printable document, rendered in three places, from one component:

```
                    InvoiceDocument.jsx  (the single printable template)
                              |
        +---------------------+---------------------+
        |                     |                     |
  /invoices/:id         PDF capture           /i/:token
  (authenticated)     (html2canvas ->       (public, no auth)
   variant=screen       jsPDF -> Blob)       variant=screen
                              |
                     Download | Email | WhatsApp
```

- **Server owns** the SMTP credentials and the share-token lifecycle. The browser never sees SMTP config.
- **Browser owns** the PDF bytes. Unless the invoice is emailed, no PDF ever reaches the server.
- **The public page** reads a reduced projection over `GET /public/invoices/:token` and renders the same `InvoiceDocument`.

## 3. InvoiceDocument Extraction

The printable markup currently lives inside [`InvoiceDetail.jsx`](client/src/pages/InvoiceDetail.jsx:29) (317 lines, template from line 29 to 316). It is extracted **as part of this sub-project** so the on-screen page, the PDF capture and the public page cannot drift apart.

### 3.1 New component — `client/src/components/InvoiceDocument.jsx`

- Props: `{ invoice, business, variant }`
- `variant="screen"` — the authenticated page: glass panel, shadow, rounded corners (current appearance)
- `variant="print"` — plain white, **no `backdrop-filter`, no `box-shadow`, no rounded corners**. html2canvas does not reproduce those effects faithfully, so the capture variant renders without them.
- `buildBreakup(invoice)` moves with the component, alongside the JSX it serves.
- Renders, unchanged from today: business header (name, address, GSTIN), invoice number and date, "Billed to" block and Place of Supply when `isGst`, the cancelled banner, the items table (HSN + GST-rate columns when GST), the HSN-wise tax breakup table, the totals block (CGST/SGST or IGST lines when GST), amount in words, and the footer.

### 3.2 [`InvoiceDetail.jsx`](client/src/pages/InvoiceDetail.jsx) after extraction

Keeps only orchestration — load the invoice, `useReactToPrint` for the print action, and the delivery actions. Renders `<InvoiceDocument variant="screen" />` inside `printRef`.

### 3.3 Regression guard

[`InvoiceDetail.test.jsx`](client/src/pages/InvoiceDetail.test.jsx) must pass **unchanged in behaviour** after the extraction — same labels, same amounts, same GST-breakup columns, same cancelled banner. The extraction lands and proves green before any PDF, email or token work begins.

## 4. Server Components

### 4.1 `server/src/utils/shareToken.js`

```js
generateShareToken()  // crypto.randomBytes(32).toString('base64url') -> 43-char opaque string
isTokenExpired(sale)  // true when shareTokenExpiresAt is missing/not a Date, or is not in the future
```

256 bits of entropy; enumeration is infeasible, which is why the public route carries no rate limiter in v1 (§8).

`isTokenExpired` **fails closed**: a token whose expiry is null is treated as expired, never as a permanent link.

### 4.2 `server/src/services/emailService.js` — the single email seam

```js
isEmailConfigured()                                   // true when SMTP_HOST + SMTP_USER + SMTP_PASS are set
sendInvoiceEmail({ to, subject, html, pdf, fileName }) // resolves on accepted, rejects on transport error
```

- Builds the nodemailer transport lazily from `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
- This is the only module that knows about SMTP. Swapping to a SaaS provider later means reimplementing this one file.
- Tests mock this seam; no test constructs a transport.

### 4.3 `server/src/services/emailTemplates.js`

`invoiceEmailHtml({ business, invoice, link })` returns the email body HTML — business name, invoice number, date, total, amount in words, the public link button, and a line noting the PDF is attached. Plain, table-based markup; no email-client-specific tricks.

### 4.4 `server/src/middleware/pdfUpload.js`

Multer with `memoryStorage()`:

- Field name `pdf`, single file
- `fileFilter` accepts `application/pdf` only
- `limits.fileSize` = 5 MB
- Rejections map to `400` (wrong type) / `413` (`LIMIT_FILE_SIZE`) and are returned in the same `{ success, message }` envelope every other error uses

## 5. Data Model

### 5.1 [`Sale.js`](server/src/models/Sale.js)

| Field | Type | Default | Notes |
|---|---|---|---|
| `shareToken` | String | `''` | Indexed. Empty means no active public link |
| `shareTokenExpiresAt` | Date | `null` | Set on every token creation from `SHARE_LINK_TTL_DAYS`. A null expiry alongside a token is treated as expired, not as a permanent link |

### 5.2 [`Customer.js`](server/src/models/Customer.js)

| Field | Type | Default | Notes |
|---|---|---|---|
| `email` | String | `''` | `lowercase`, `trim`. Used to prefill the email recipient |

### 5.3 Business

No schema change. Payment/contact details on the business are sub-project B's concern. The email and public page use the existing `{ name, address, gstin }` snapshot that `getInvoice` already returns.

### 5.4 Migration

Both new fields default to empty/null. Existing sales have no public link and existing customers have no email — no migration script.

## 6. API

### 6.1 New endpoints

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| POST | `/invoices/:id/email` | 🔒 | multipart: `pdf` (file, required), `to` (string, required), `subject` (optional) | `{ message }` on success |
| POST | `/invoices/:id/share` | 🔒 | — | `{ shareToken, shareUrl, expiresAt }` |
| DELETE | `/invoices/:id/share` | 🔒 | — | `{ message }` |
| GET | `/public/invoices/:token` | 🌐 none | — | `{ invoice, business }` — reduced projection |
| GET | `/config/features` | 🔒 | — | `{ email: boolean }` |

Paths are relative to the existing `/api/v1` mount.

- `POST /invoices/:id/share` **rotates** on every call: an existing token is replaced, so a previously leaked link stops working.
- `shareUrl` is built server-side as `${SHARE_LINK_BASE_URL}/i/${shareToken}`. The client never constructs it, so moving to a real domain later is a server-only change.
- All authenticated routes go through `authenticate` + `tenantScope` and resolve the sale with `{ _id, businessId }`, so another tenant's invoice is a `404`, never a `403`.
- `/public/invoices/:token` is mounted **outside** the authenticated router group — no `authenticate`, no `tenantScope`. The token itself is the authorization.

### 6.2 Public projection

`GET /public/invoices/:token` returns only what `InvoiceDocument` needs:

- `invoice`: `invoiceNumber`, `date`, `items`, `subtotal`, `discount`, `tax`, `isGst`, `cgst`, `sgst`, `igst`, `buyerName`, `buyerAddress`, `buyerGstin`, `placeOfSupply`, `total`, `status`
- `business`: `name`, `address`, `gstin`

**Deliberately omitted:** `_id`/`id`, `businessId`, `customerId`, `paymentMethod`, the customer's ledger balance, and every plan/billing field on Business. This is a narrow read model, not a serialized document — the test suite asserts the absence of those keys.

### 6.3 Client API layer — [`endpoints.js`](client/src/api/endpoints.js)

```js
invoicesApi.sendEmail(id, formData)  // POST multipart
invoicesApi.share(id)                // POST -> { shareToken, shareUrl, expiresAt }
invoicesApi.revokeShare(id)          // DELETE
publicApi.getInvoice(token)          // GET, no auth header needed
configApi.features()                 // GET -> { email }
```

## 7. Data Flows

### 7.1 Download PDF

1. User opens **Send invoice** on `/invoices/:id`.
2. **Download** calls `buildInvoicePdf(element, meta)` in `client/src/utils/invoicePdf.js` — the single PDF seam.
3. `html2canvas(element, { scale: 2, backgroundColor: '#ffffff' })` → canvas.
4. The canvas is sliced into A4-proportioned pages (`210 × 297 mm`) and each slice is added with `jsPDF.addImage`, advancing per page.
5. jsPDF emits a `Blob`, saved as `${invoiceNumber}.pdf`.
6. No network call. Works offline.

### 7.2 Email

1. Dialog opens with the recipient prefilled from `customer.email` (editable).
2. The PDF `Blob` is built exactly as in 7.1 and checked against the 5 MB cap **before** upload.
3. `POST /invoices/:id/email` as multipart (`pdf` + `to`).
4. Server: multer validates type and size → `tenantScope` proves the sale belongs to the caller's business → [`emailService.sendInvoiceEmail`](server/src/services/emailService.js) attaches the buffer as `${invoiceNumber}.pdf` and sends.
5. Credentials never reach the client; failure that is not "unconfigured" is logged server-side and returned as a generic error.

### 7.3 WhatsApp

1. Dialog normalises the phone number: strip non-digits, drop a leading `0`, and prefix `91` when exactly 10 digits remain.
2. `POST /invoices/:id/share` gets (or rotates) the token.
3. `window.open('https://wa.me/<digits>?text=<encoded summary + link>', 'noopener')`. The summary is invoice number, business name, total and the public URL.
4. The send is completed by the user in WhatsApp itself. The app only opens the chat.

### 7.4 Public link

1. `/i/:token` is a **public route** — declared outside `ProtectedRoutes` in [`App.jsx`](client/src/App.jsx), so no auth check and no redirect to login.
2. [`PublicInvoice.jsx`](client/src/pages/PublicInvoice.jsx) fetches `GET /public/invoices/:token`.
3. On success it renders `<InvoiceDocument variant="screen" />` plus a client-side **Download PDF** button (the same `buildInvoicePdf` seam).
4. Read-only: no print chrome from the app shell, no nav, no actions other than download.
5. **Token lifetime:** default 30 days; `shareTokenExpiresAt` is set at creation. Revoking (`DELETE`) clears both fields. Expired, revoked and unknown tokens all resolve to the same "link unavailable" state.
6. A **cancelled** sale still resolves; the existing cancelled banner renders, so the customer sees the true status.

## 8. Error Handling

**Server** (all through the [`errors.js`](server/src/middleware/errors.js) envelope):

| Condition | Response |
|---|---|
| `SMTP_*` env not set | 503 `"Email is not configured"` |
| SMTP auth / connection / timeout failure | 502 `"Could not send email"`; full error logged server-side only, no raw SMTP text in the response |
| No `pdf` part or wrong mimetype | 400 `"A PDF attachment is required"` |
| PDF over 5 MB | 413 `"Attachment exceeds 5 MB"` (multer `LIMIT_FILE_SIZE`) |
| Missing or invalid `to` | 400 `"A valid recipient email is required"` |
| Sale not found, or another tenant's sale | 404 — never 403, to avoid disclosing existence |
| Share token invalid / expired / revoked | 404 on `GET /public/invoices/:token` |

**Client:**

- `buildInvoicePdf` is the only module touching html2canvas and jsPDF; either failure surfaces as one caught rejection and shows "Could not generate PDF".
- The Email button is disabled when `GET /config/features` reports `email: false`, so the unconfigured case is prevented rather than discovered.
- The dialog checks `blob.size` against 5 MB before uploading and reports the limit locally.
- WhatsApp: if the share call fails, the dialog shows the error and does **not** open `wa.me` with a link-less message.
- The public page collapses every failure (404 from invalid, expired, revoked or unknown) into one identical "link unavailable" card — no distinction, no detail.

**Rate limiting on the public route is deliberately absent in v1**, since a 256-bit opaque token makes enumeration infeasible. It is recorded as future work, not silently skipped.

## 9. Testing

### 9.1 Server (Jest + Supertest, in-memory MongoDB)

New `tests/invoiceDelivery.test.js`:

- `emailService` is mocked at the seam; no real transport is constructed.
- `POST /invoices/:id/email`: happy path asserts the seam is called once with the right `to`, subject, attachment `fileName` and a `Buffer`; 503 when SMTP env is absent; 400 wrong mimetype; 413 with an oversize synthetic buffer; 404 cross-tenant; 400 invalid `to`.
- `POST` / `DELETE /invoices/:id/share`: token created, persisted and returned once; `DELETE` clears both `shareToken` and `shareTokenExpiresAt`; a second `POST` rotates to a different token; both routes 404 cross-tenant.
- `shareToken.js`: length/charset of a generated token; `isTokenExpired` boundary (exactly at expiry counts as expired); `null`/empty handling.
- `GET /public/invoices/:token`: succeeds **without** an `Authorization` header; the valid response asserts the **absence** of `_id`/`id`, `businessId`, `customerId`, `paymentMethod`, and any plan field; expired, revoked and unknown tokens each 404; the response shape matches what `InvoiceDocument` consumes.
- Existing [`invoices.test.js`](server/tests/invoices.test.js) and [`sales.test.js`](server/tests/sales.test.js) stay green.

### 9.2 Client (Vitest + RTL + jsdom — run as `npx vitest run`; there is no `test` script in [`client/package.json`](client/package.json))

- `InvoiceDocument.test.jsx`: renders a GST and a non-GST sale; the HSN breakup table and amount in words are present; `variant="print"` omits the shadow/glass classes.
- `SendInvoiceDialog.test.jsx`: Download calls the PDF seam and triggers a save; Email posts multipart with the blob and is disabled when `features.email === false`; WhatsApp calls the share endpoint then opens the `wa.me` URL with the expected digits and an encoded summary; phone normalisation is covered for 10 digits, `+91`, spaces and a leading `0`.
- `PublicInvoice.test.jsx`: loading, success, and one shared "link unavailable" state for every failure code.
- [`InvoiceDetail.test.jsx`](client/src/pages/InvoiceDetail.test.jsx) passes **unchanged** — the extraction regression guard from §3.3.

### 9.3 Manual acceptance (user-run)

Per the project rule that forbids browser automation during development, and because real SMTP and WhatsApp traffic cannot be exercised by the assistant, these steps are run manually:

1. Configure SMTP credentials in `server/.env` and restart; confirm `GET /config/features` reports `email: true`.
2. Download the PDF for a GST invoice and a non-GST invoice; check the totals block, the amount in words and the HSN breakup table in the file itself.
3. Email the invoice and confirm the message arrives with `${invoiceNumber}.pdf` attached and the link inside.
4. Send to WhatsApp and open the link in a private browser window, with no session.
5. Revoke the link and confirm `/i/:token` then shows the unavailable card.

## 10. Out of Scope (v1)

- **Sub-project B** — payment details below the invoice and the UPI QR (the "coming soon" placeholder stays).
- **Sub-project C** — warranty fields, periods and claims.
- **Sub-project D** — e-way bill capture, storage, display and validity.
- Sharing without a link — the token link is required for WhatsApp.
- WhatsApp Cloud API, template messages, and the PDF as a WhatsApp attachment.
- Storing generated PDFs on the server, in Mongo, or on disk.
- Server-side headless-browser rendering.
- Invoice cancel / delete from the invoice detail page.
- Rate limiting on the public route.
- Email open/click tracking, bounce handling and delivery webhooks.
- Localisation and multi-currency in the email template (English, `formatINR`).
- Retry or queue for failed sends — sends are synchronous with a surfaced error.

## 11. Dependencies Added

| Package | Where | Purpose |
|---|---|---|
| `html2canvas` | client | Rasterise the printable DOM |
| `jspdf` | client | Slice the canvas into A4 pages, emit a Blob |
| `nodemailer` | server | SMTP transport |
| `multer` | server | Multipart PDF upload into memory |

## 12. Environment Variables

```
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
SHARE_LINK_BASE_URL=http://localhost:5173
SHARE_LINK_TTL_DAYS=30
```

Added to [`server/.env.example`](server/.env.example). `SHARE_LINK_BASE_URL` is what the API uses to build `shareUrl`; it is separate from the existing `CLIENT_URL` so the public base can point at a real domain later without disturbing CORS.
