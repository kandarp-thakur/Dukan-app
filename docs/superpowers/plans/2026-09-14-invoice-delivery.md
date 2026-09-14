# Invoice Delivery (PDF, Email, WhatsApp, Public Link) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user download an invoice as a PDF, email it with the PDF attached, send a WhatsApp message containing a public invoice link, and let the customer open that link on a read-only public page with no login.

**Architecture:** The printable markup is first extracted from [`InvoiceDetail.jsx`](client/src/pages/InvoiceDetail.jsx) into a shared `InvoiceDocument` component so the authenticated page, the PDF capture and the public page render one template. The PDF is produced entirely in the browser (`html2canvas` → `jsPDF` → `Blob`) behind a single `buildInvoicePdf` seam, so no server-side Chromium and no stored files. The server owns only the two things the browser cannot: SMTP credentials (a single `emailService` seam over nodemailer) and an opaque, expiring, revocable `shareToken` on the `Sale` document that authorizes one public read-only endpoint.

**Tech Stack:** Node.js + Express + Mongoose (server, CommonJS, Jest + Supertest + mongodb-memory-server) with `nodemailer` + `multer`; React 18 + Vite + Vitest + React Testing Library (client, ESM, glassmorphism UI, lucide-react, react-to-print) with `html2canvas` + `jspdf`.

**Spec:** `docs/superpowers/specs/2026-09-14-invoice-delivery-design.md`

## Global Constraints

- All money values are **integer paise** (₹123.45 = `12345`). Never store or transport floats.
- Every API response uses the envelope `{ success, message, data }`.
- All authenticated routes use `authenticate` + `tenantScope` and scope every query by `businessId`. A missing or foreign record is **404, never 403**.
- Response `toJSON` on models renames `_id` → `id` and drops `__v` (already the pattern).
- API paths in the spec are relative to the existing `/api/v1` mount in [`app.js`](server/src/app.js:26).
- Conventional commits (`feat:`, `test:`, `docs:`), one commit per task.
- Work on branch `feature/invoice-delivery` created from `master`.
- No emoji in UI or copy. Use existing lucide-react icons and `.glass*`, `.badge*`, `.btn-*`, `.skeleton`, `.empty-state` CSS classes.
- The printable invoice stays `bg-white`. `variant="print"` must not use `glass`, `backdrop-filter`, `box-shadow` or rounded corners — html2canvas does not reproduce them.
- Shell is Windows cmd; commands run from repo root `e:/client_projects/acc-app-shubham` unless a `cd` is shown. Chain with `&&`.
- Test commands: server `cd server && npx jest tests/<file>.test.js --runInBand`; client `cd client && npx vitest run <file>`. Full suites: `npm run test:server` and `npm run test:client`.
- Manual E2E is the only browser verification (the project forbids browser automation). **Do not open a browser.** Real SMTP and WhatsApp sends are user-run only.
- SMTP credentials live in `server/.env` only. Never send SMTP config to the client.

---

## File Structure

**Server — created:**

| File | Responsibility |
|---|---|
| `server/src/utils/shareToken.js` | Generate/expire/format the public share token |
| `server/src/services/emailService.js` | The single SMTP seam: `isEmailConfigured()`, `sendInvoiceEmail()` |
| `server/src/services/emailTemplates.js` | `invoiceEmailHtml()` — the email body |
| `server/src/middleware/pdfUpload.js` | Multer memory upload for the PDF attachment (5 MB, `application/pdf`) |
| `server/src/routes/publicRoutes.js` | The unauthenticated public router |
| `server/src/routes/configRoutes.js` | `GET /config/features` |
| `server/src/controllers/configController.js` | Feature-flag handler |
| `server/tests/shareToken.test.js` | Share-token unit tests |
| `server/tests/emailService.test.js` | Email-seam unit tests |
| `server/tests/invoiceDelivery.test.js` | Endpoint tests for email / share / revoke / public |

**Server — modified:** [`Sale.js`](server/src/models/Sale.js), [`Customer.js`](server/src/models/Customer.js), [`customerController.js`](server/src/controllers/customerController.js), [`customerRoutes.js`](server/src/routes/customerRoutes.js), [`invoiceController.js`](server/src/controllers/invoiceController.js), [`invoiceRoutes.js`](server/src/routes/invoiceRoutes.js), [`routes/index.js`](server/src/routes/index.js), [`tests/customers.test.js`](server/tests/customers.test.js), [`server/.env.example`](server/.env.example).

**Client — created:**

| File | Responsibility |
|---|---|
| `client/src/components/InvoiceDocument.jsx` | The one printable invoice template (screen + print variants) |
| `client/src/utils/invoicePdf.js` | The single PDF seam: `buildInvoicePdf()`, `downloadBlob()` |
| `client/src/utils/whatsapp.js` | `toWhatsAppNumber()`, `whatsappUrl()` |
| `client/src/components/SendInvoiceDialog.jsx` | Download / Email / WhatsApp actions in one dialog |
| `client/src/pages/PublicInvoice.jsx` | The public read-only `/i/:token` page |
| `client/src/components/InvoiceDocument.test.jsx` | Template tests |
| `client/src/utils/invoicePdf.test.js` | PDF seam tests |
| `client/src/utils/whatsapp.test.js` | Phone/URL tests |
| `client/src/components/SendInvoiceDialog.test.jsx` | Dialog tests |
| `client/src/pages/PublicInvoice.test.jsx` | Public page tests |

**Client — modified:** [`InvoiceDetail.jsx`](client/src/pages/InvoiceDetail.jsx), [`InvoiceDetail.test.jsx`](client/src/pages/InvoiceDetail.test.jsx), [`endpoints.js`](client/src/api/endpoints.js), [`App.jsx`](client/src/App.jsx), [`package.json`](client/package.json).

---

### Task 1: Share token utility and schema fields

**Files:**
- Create: `server/src/utils/shareToken.js`
- Create: `server/tests/shareToken.test.js`
- Modify: `server/src/models/Sale.js`
- Modify: `server/src/models/Customer.js`
- Modify: `server/src/controllers/customerController.js:32-60`
- Modify: `server/src/routes/customerRoutes.js:13-43`
- Modify: `server/tests/customers.test.js`
- Modify: `server/.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces (CommonJS exports of `shareToken.js`):
  - `generateShareToken(): string` — 43-char base64url, 256 bits.
  - `shareTokenExpiry(days?: number): Date` — now + `days` (default `process.env.SHARE_LINK_TTL_DAYS` or 30).
  - `isTokenExpired(sale: { shareTokenExpiresAt?: Date|null }): boolean` — fails closed.
  - `shareUrlFor(token: string): string` — `${SHARE_LINK_BASE_URL}/i/${token}` with any trailing slash trimmed.
- Produces (schema): `Sale.shareToken: string`, `Sale.shareTokenExpiresAt: Date|null`, `Customer.email: string`. `Customer` create/update now accept `email`.

- [ ] **Step 1: Write the failing test**

Create `server/tests/shareToken.test.js`:

```js
const {
    generateShareToken,
    shareTokenExpiry,
    isTokenExpired,
    shareUrlFor,
} = require('../src/utils/shareToken');

describe('shareToken utils', () => {
    it('generates a 43-character base64url token', () => {
        const token = generateShareToken();
        expect(token).toHaveLength(43);
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates a distinct token every call', () => {
        const seen = new Set();
        for (let i = 0; i < 100; i += 1) seen.add(generateShareToken());
        expect(seen.size).toBe(100);
    });

    it('expires 30 days out by default', () => {
        const before = Date.now();
        const expiry = shareTokenExpiry();
        const delta = expiry.getTime() - before;
        expect(delta).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
        expect(delta).toBeLessThan(31 * 24 * 60 * 60 * 1000);
    });

    it('honours an explicit day count', () => {
        const expiry = shareTokenExpiry(1);
        const delta = expiry.getTime() - Date.now();
        expect(delta).toBeGreaterThan(23 * 60 * 60 * 1000);
        expect(delta).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('treats a missing or null expiry as expired', () => {
        expect(isTokenExpired({})).toBe(true);
        expect(isTokenExpired({ shareTokenExpiresAt: null })).toBe(true);
        expect(isTokenExpired(null)).toBe(true);
        expect(isTokenExpired({ shareTokenExpiresAt: 'not-a-date' })).toBe(true);
    });

    it('treats a past expiry as expired and a future one as live', () => {
        expect(isTokenExpired({ shareTokenExpiresAt: new Date(Date.now() - 1) })).toBe(true);
        expect(isTokenExpired({ shareTokenExpiresAt: new Date(Date.now() + 60000) })).toBe(false);
    });

    it('builds the public URL from the configured base', () => {
        process.env.SHARE_LINK_BASE_URL = 'https://bills.example.com/';
        expect(shareUrlFor('abc')).toBe('https://bills.example.com/i/abc');
        process.env.SHARE_LINK_BASE_URL = 'http://localhost:5173';
        expect(shareUrlFor('abc')).toBe('http://localhost:5173/i/abc');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/shareToken.test.js --runInBand`
Expected: FAIL — `Cannot find module '../src/utils/shareToken'`.

- [ ] **Step 3: Write `server/src/utils/shareToken.js`**

```js
const crypto = require('crypto');

const DEFAULT_TTL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 32 random bytes as base64url -> 43 characters, 256 bits of entropy.
const generateShareToken = () => crypto.randomBytes(32).toString('base64url');

const shareTokenExpiry = (days) => {
    const configured = Number(process.env.SHARE_LINK_TTL_DAYS);
    const ttl = Number(days) || (Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_DAYS);
    return new Date(Date.now() + ttl * MS_PER_DAY);
};

// Fails closed: a token with no usable expiry is expired, never permanent.
const isTokenExpired = (sale) => {
    const expiry = sale && sale.shareTokenExpiresAt;
    if (!expiry) return true;
    const when = expiry instanceof Date ? expiry : new Date(expiry);
    if (Number.isNaN(when.getTime())) return true;
    return when.getTime() <= Date.now();
};

const shareUrlFor = (token) => {
    const base = (process.env.SHARE_LINK_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
    return `${base}/i/${token}`;
};

module.exports = { generateShareToken, shareTokenExpiry, isTokenExpired, shareUrlFor };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/shareToken.test.js --runInBand`
Expected: PASS — 7 tests.

- [ ] **Step 5: Add the schema fields**

In [`Sale.js`](server/src/models/Sale.js), insert after the `date` field (line 45):

```js
        shareToken: { type: String, default: '', index: true },
        shareTokenExpiresAt: { type: Date, default: null },
```

In [`Customer.js`](server/src/models/Customer.js), insert after `address` (line 14):

```js
        email: { type: String, default: '', lowercase: true, trim: true },
```

- [ ] **Step 6: Write the failing customer-email test**

Append to `server/tests/customers.test.js`, inside the existing top-level `describe` block (before its closing `});`):

```js
    it('stores a customer email in lower case and returns it', async () => {
        const data = await registerBusiness('Email');
        const res = await request(app)
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Ramesh', email: '  Ramesh@Example.COM  ' });

        expect(res.status).toBe(201);
        expect(res.body.data.customer.email).toBe('ramesh@example.com');
    });

    it('updates a customer email', async () => {
        const data = await registerBusiness('EmailUpdate');
        const created = await createCustomer(data.accessToken, 'Suresh');
        const res = await request(app)
            .patch(`/api/v1/customers/${created.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ email: 'SURESH@Example.com' });

        expect(res.status).toBe(200);
        expect(res.body.data.customer.email).toBe('suresh@example.com');
    });
```

`registerBusiness` and `createCustomer` already exist in that file; `createCustomer(token, name)` returns `res.body.data.customer`.

- [ ] **Step 7: Run test to verify it fails**

Run: `cd server && npx jest tests/customers.test.js --runInBand`
Expected: FAIL — `customer.email` is `undefined`, because the controller drops the unknown field.

- [ ] **Step 8: Plumb `email` through the customer controller and routes**

In [`customerController.js`](server/src/controllers/customerController.js:32), replace the destructure and create payload:

```js
    const { name, phone, email, gstin, address } = req.body;
    const customer = await Customer.create({
        businessId: req.businessId,
        name,
        phone: phone || '',
        email: email || '',
        gstin: gstin || '',
        address: address || '',
    });
```

In the same file, replace the update allow-list (line 44):

```js
    const allowed = ['name', 'phone', 'email', 'gstin', 'address'];
```

In [`customerRoutes.js`](server/src/routes/customerRoutes.js), add to **both** the POST (after line 18) and PATCH (after line 34) validator chains:

```js
    body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('A valid email is required'),
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd server && npx jest tests/customers.test.js tests/shareToken.test.js --runInBand`
Expected: PASS.

- [ ] **Step 10: Add the share-link env vars to `server/.env.example`**

```
SHARE_LINK_BASE_URL=http://localhost:5173
SHARE_LINK_TTL_DAYS=30
```

- [ ] **Step 11: Commit**

```bash
git add server/src/utils/shareToken.js server/tests/shareToken.test.js server/src/models/Sale.js server/src/models/Customer.js server/src/controllers/customerController.js server/src/routes/customerRoutes.js server/tests/customers.test.js server/.env.example
git commit -m "feat: add share token util and customer email field"
```

---

### Task 2: Email service seam and template

**Files:**
- Create: `server/src/services/emailService.js`
- Create: `server/src/services/emailTemplates.js`
- Create: `server/tests/emailService.test.js`
- Modify: `server/package.json` (add `nodemailer`)
- Modify: `server/.env.example`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `isEmailConfigured(): boolean` — true when `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are all non-empty.
  - `sendInvoiceEmail({ to, subject, html, pdf, fileName }): Promise<object>` — resolves with the transport result; throws an `Error` with `.status === 503` when unconfigured and `.status === 502` when the transport fails.
  - `invoiceEmailHtml({ business, invoice, link }): string`.

- [ ] **Step 1: Install nodemailer**

Run: `cd server && npm install nodemailer`
Expected: `nodemailer` appears in `server/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `server/tests/emailService.test.js`:

```js
const nodemailer = require('nodemailer');
const { isEmailConfigured, sendInvoiceEmail } = require('../src/services/emailService');
const { invoiceEmailHtml } = require('../src/services/emailTemplates');

jest.mock('nodemailer');

const setSmtpEnv = (on) => {
    const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    keys.forEach((key) => {
        if (on) process.env[key] = `test-${key.toLowerCase()}`;
        else delete process.env[key];
    });
};

describe('emailService', () => {
    let sendMail;

    beforeEach(() => {
        jest.clearAllMocks();
        sendMail = jest.fn().mockResolvedValue({ accepted: ['a@b.com'] });
        nodemailer.createTransport.mockReturnValue({ sendMail });
        delete process.env.MAIL_FROM;
    });

    it('reports unconfigured when SMTP env is missing', () => {
        setSmtpEnv(false);
        expect(isEmailConfigured()).toBe(false);
    });

    it('reports configured when all SMTP env vars are set', () => {
        setSmtpEnv(true);
        expect(isEmailConfigured()).toBe(true);
    });

    it('rejects with 503 when unconfigured', async () => {
        setSmtpEnv(false);
        await expect(
            sendInvoiceEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>', pdf: Buffer.from('x'), fileName: 'INV-1.pdf' })
        ).rejects.toMatchObject({ status: 503, message: 'Email is not configured' });
        expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('sends the PDF as an attachment', async () => {
        setSmtpEnv(true);
        const pdf = Buffer.from('%PDF-1.4 test');
        const result = await sendInvoiceEmail({
            to: 'a@b.com',
            subject: 'Invoice INV-1',
            html: '<p>hello</p>',
            pdf,
            fileName: 'INV-1.pdf',
        });

        expect(result).toEqual({ accepted: ['a@b.com'] });
        expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
        expect(sendMail).toHaveBeenCalledTimes(1);
        const mail = sendMail.mock.calls[0][0];
        expect(mail.to).toBe('a@b.com');
        expect(mail.subject).toBe('Invoice INV-1');
        expect(mail.html).toBe('<p>hello</p>');
        expect(mail.from).toBe('test-smtp_user');
        expect(mail.attachments).toHaveLength(1);
        expect(mail.attachments[0]).toMatchObject({
            filename: 'INV-1.pdf',
            contentType: 'application/pdf',
            content: pdf,
        });
    });

    it('prefers MAIL_FROM over the SMTP user as the sender', async () => {
        setSmtpEnv(true);
        process.env.MAIL_FROM = 'billing@shop.com';
        await sendInvoiceEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>', pdf: Buffer.from('x'), fileName: 'i.pdf' });
        expect(sendMail.mock.calls[0][0].from).toBe('billing@shop.com');
    });

    it('wraps a transport failure as a 502 without leaking the transport error', async () => {
        setSmtpEnv(true);
        sendMail.mockRejectedValue(new Error('535 auth failed for user x'));
        await expect(
            sendInvoiceEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>', pdf: Buffer.from('x'), fileName: 'i.pdf' })
        ).rejects.toMatchObject({ status: 502, message: 'Could not send email' });
    });
});

describe('invoiceEmailHtml', () => {
    const business = { name: 'Local Test Shop', address: 'Main Road, Pune', gstin: '27ABCDE1234F1Z5' };
    const invoice = { invoiceNumber: 'INV-9', total: 12980, date: '2026-09-05T10:30:00.000Z' };

    it('includes the business, invoice number, total and link', () => {
        const html = invoiceEmailHtml({ business, invoice, link: 'https://x.test/i/abc' });
        expect(html).toContain('Local Test Shop');
        expect(html).toContain('INV-9');
        expect(html).toContain('₹129.80');
        expect(html).toContain('https://x.test/i/abc');
    });

    it('omits the link button when there is no link', () => {
        const html = invoiceEmailHtml({ business, invoice, link: '' });
        expect(html).not.toContain('/i/');
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx jest tests/emailService.test.js --runInBand`
Expected: FAIL — `Cannot find module '../src/services/emailService'`.

- [ ] **Step 4: Write `server/src/services/emailService.js`**

```js
const nodemailer = require('nodemailer');

// The only module that knows about SMTP. Swapping providers means rewriting this file.
const REQUIRED_ENV = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];

const isEmailConfigured = () =>
    REQUIRED_ENV.every((key) => Boolean(process.env[key] && String(process.env[key]).trim()));

const buildTransport = () =>
    nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: String(process.env.SMTP_SECURE) === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

const sendInvoiceEmail = async ({ to, subject, html, pdf, fileName }) => {
    if (!isEmailConfigured()) {
        const err = new Error('Email is not configured');
        err.status = 503;
        throw err;
    }

    const transport = buildTransport();
    try {
        return await transport.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to,
            subject,
            html,
            attachments: [{ filename: fileName, content: pdf, contentType: 'application/pdf' }],
        });
    } catch (cause) {
        // Keep the raw SMTP error on the server; never surface it to the client.
        console.error('sendInvoiceEmail failed:', cause);
        const err = new Error('Could not send email');
        err.status = 502;
        throw err;
    }
};

module.exports = { isEmailConfigured, sendInvoiceEmail };
```

- [ ] **Step 5: Write `server/src/services/emailTemplates.js`**

```js
const { formatINR, amountToWords } = require('../utils/money');

// Table-based markup only: no flexbox, no external CSS, no webfonts.
const invoiceEmailHtml = ({ business, invoice, link }) => {
    const name = (business && business.name) || 'Our store';
    const address = (business && business.address) || '';
    const gstin = (business && business.gstin) || '';
    const button = link
        ? `<p style="margin:24px 0"><a href="${link}" style="background:#4f46e5;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">View invoice online</a></p>`
        : '';

    return `<!doctype html>
<html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<h1 style="margin:0;font-size:20px">${name}</h1>
${address ? `<p style="margin:4px 0;color:#6b7280;font-size:13px">${address}</p>` : ''}
${gstin ? `<p style="margin:4px 0;color:#6b7280;font-size:13px">GSTIN: ${gstin}</p>` : ''}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
<p style="margin:0 0 8px">Invoice <strong>${invoice.invoiceNumber}</strong></p>
<p style="margin:0 0 8px;color:#6b7280;font-size:13px">${new Date(invoice.date).toDateString()}</p>
<p style="margin:16px 0 0;font-size:24px;font-weight:700">${formatINR(invoice.total)}</p>
<p style="margin:4px 0 0;color:#6b7280;font-size:13px">${amountToWords(invoice.total)}</p>
${button}
<p style="margin:24px 0 0;color:#6b7280;font-size:13px">The invoice PDF is attached to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
};

module.exports = { invoiceEmailHtml };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx jest tests/emailService.test.js --runInBand`
Expected: PASS — 8 tests.

If `require('../utils/money')` fails, the client util has a server twin only if one exists; check `server/src/utils/` first. If there is no server-side money util, add `server/src/utils/money.js` containing the same `formatINR` and `amountToWords` implementations as [`client/src/utils/money.js`](client/src/utils/money.js) with `module.exports = { formatINR, amountToWords }` at the end, and cover it in the same test file.

- [ ] **Step 7: Add the SMTP env vars to `server/.env.example`**

```
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
```

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/package-lock.json server/src/services server/tests/emailService.test.js server/.env.example
git commit -m "feat: add SMTP email service seam and invoice email template"
```

---

### Task 3: PDF upload middleware

**Files:**
- Create: `server/src/middleware/pdfUpload.js`
- Modify: `server/package.json` (add `multer`)

**Interfaces:**
- Consumes: nothing.
- Produces: `pdfUpload` — an Express middleware that parses a single `pdf` file part into `req.file.buffer`. Responds `413 "Attachment exceeds 5 MB"` on `LIMIT_FILE_SIZE`, `400 "A PDF attachment is required"` for a missing/wrong-type file or an unexpected field, and `400` with the multer message otherwise. Exposes `MAX_PDF_BYTES = 5 * 1024 * 1024`.

- [ ] **Step 1: Install multer**

Run: `cd server && npm install multer`
Expected: `multer` appears in `server/package.json` dependencies.

- [ ] **Step 2: Write `server/src/middleware/pdfUpload.js`**

Multer errors cannot be exercised without an HTTP request, so this middleware is verified by the Supertest cases in Task 4 rather than by a standalone test.

```js
const multer = require('multer');

const MAX_PDF_BYTES = 5 * 1024 * 1024;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_BYTES },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            const err = new Error('A PDF attachment is required');
            err.status = 400;
            return cb(err);
        }
        return cb(null, true);
    },
}).single('pdf');

// Wraps multer so its errors come back in the standard { success, message } envelope.
const pdfUpload = (req, res, next) =>
    upload(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ success: false, message: 'Attachment exceeds 5 MB' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ success: false, message: 'A PDF attachment is required' });
        }
        return res
            .status(err.status || 400)
            .json({ success: false, message: err.message || 'Upload failed' });
    });

module.exports = { pdfUpload, MAX_PDF_BYTES };
```

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/package-lock.json server/src/middleware/pdfUpload.js
git commit -m "feat: add multer PDF upload middleware with 5 MB cap"
```

---

### Task 4: Invoice delivery endpoints

**Files:**
- Modify: `server/src/controllers/invoiceController.js`
- Modify: `server/src/routes/invoiceRoutes.js`
- Create: `server/src/routes/publicRoutes.js`
- Create: `server/src/routes/configRoutes.js`
- Create: `server/src/controllers/configController.js`
- Modify: `server/src/routes/index.js`
- Create: `server/tests/invoiceDelivery.test.js`

**Interfaces:**
- Consumes: `generateShareToken`, `shareTokenExpiry`, `isTokenExpired`, `shareUrlFor` (Task 1); `sendInvoiceEmail`, `isEmailConfigured` (Task 2); `invoiceEmailHtml` (Task 2); `pdfUpload` (Task 3).
- Produces (HTTP):
  - `POST /api/v1/invoices/:id/email` → `{ success, message, data: null }`
  - `POST /api/v1/invoices/:id/share` → `{ shareToken, shareUrl, expiresAt }`
  - `DELETE /api/v1/invoices/:id/share` → `{ success, message, data: null }`
  - `GET /api/v1/public/invoices/:token` → `{ invoice, business }` (no auth)
  - `GET /api/v1/config/features` (auth) → `{ email: boolean }`

- [ ] **Step 1: Write the failing test**

Create `server/tests/invoiceDelivery.test.js`:

```js
const request = require('supertest');
const app = require('../src/app');
const { setupTestDB } = require('./setupTestDB');
const { isTokenExpired } = require('../src/utils/shareToken');

jest.mock('../src/services/emailService', () => ({
    isEmailConfigured: jest.fn(() => true),
    sendInvoiceEmail: jest.fn(),
}));

const emailService = require('../src/services/emailService');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Delivery Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `downer${suffix}@test.com`,
        password: 'secret123',
    });
    return res.body.data;
};

const setBusinessGstin = async (token, gstin) => {
    await request(app)
        .patch('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({ gstin });
};

const createSale = async (token, payload) => {
    const res = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
    return res.body.data.sale;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const onePen = { items: [{ name: 'Pen', qty: 1, rate: 1000 }], paymentMethod: 'cash' };

const pdfBuffer = (size = 64) => {
    const buf = Buffer.alloc(size, 0x20);
    Buffer.from('%PDF-1.4').copy(buf, 0);
    return buf;
};

describe('Invoice delivery API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        emailService.isEmailConfigured.mockReturnValue(true);
        emailService.sendInvoiceEmail.mockResolvedValue({ accepted: ['x@y.com'] });
    });

    it('emails an invoice with the PDF attachment', async () => {
        const data = await registerBusiness('A');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(), { filename: 'INV-1.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(emailService.sendInvoiceEmail).toHaveBeenCalledTimes(1);
        const args = emailService.sendInvoiceEmail.mock.calls[0][0];
        expect(args.to).toBe('buyer@example.com');
        expect(args.subject).toContain('INV-1');
        expect(args.subject).toContain('Delivery Shop A');
        expect(args.fileName).toBe('INV-1.pdf');
        expect(Buffer.isBuffer(args.pdf)).toBe(true);
        expect(args.html).toContain('INV-1');
    });

    it('returns 503 when email is not configured', async () => {
        emailService.isEmailConfigured.mockReturnValue(false);
        const err = new Error('Email is not configured');
        err.status = 503;
        emailService.sendInvoiceEmail.mockRejectedValue(err);
        const data = await registerBusiness('B');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(), { filename: 'i.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(503);
        expect(res.body.message).toBe('Email is not configured');
    });

    it('returns 502 when the transport fails', async () => {
        const err = new Error('Could not send email');
        err.status = 502;
        emailService.sendInvoiceEmail.mockRejectedValue(err);
        const data = await registerBusiness('B2');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(), { filename: 'i.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(502);
        expect(res.body.message).toBe('Could not send email');
    });

    it('rejects a non-PDF attachment with 400', async () => {
        const data = await registerBusiness('C');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('A PDF attachment is required');
        expect(emailService.sendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('rejects an attachment over 5 MB with 413', async () => {
        const data = await registerBusiness('D');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(5 * 1024 * 1024 + 1024), {
                filename: 'big.pdf',
                contentType: 'application/pdf',
            });

        expect(res.status).toBe(413);
        expect(res.body.message).toBe('Attachment exceeds 5 MB');
    });

    it('rejects a missing attachment with 400', async () => {
        const data = await registerBusiness('E');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'buyer@example.com');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('A PDF attachment is required');
    });

    it('rejects an invalid recipient with 400', async () => {
        const data = await registerBusiness('F');
        const sale = await createSale(data.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(data.accessToken))
            .field('to', 'not-an-email')
            .attach('pdf', pdfBuffer(), { filename: 'i.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(400);
        expect(emailService.sendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('does not let one business email another business invoice', async () => {
        const dataA = await registerBusiness('G');
        const dataB = await registerBusiness('H');
        const sale = await createSale(dataA.accessToken, onePen);

        const res = await request(app)
            .post(`/api/v1/invoices/${sale.id}/email`)
            .set(auth(dataB.accessToken))
            .field('to', 'buyer@example.com')
            .attach('pdf', pdfBuffer(), { filename: 'i.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(404);
        expect(emailService.sendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('creates a share link and rotates it on the next call', async () => {
        const data = await registerBusiness('I');
        const sale = await createSale(data.accessToken, onePen);

        const first = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        expect(first.status).toBe(200);
        expect(first.body.data.shareToken).toHaveLength(43);
        expect(first.body.data.shareUrl).toContain(`/i/${first.body.data.shareToken}`);
        expect(new Date(first.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());

        const second = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        expect(second.body.data.shareToken).not.toBe(first.body.data.shareToken);
    });

    it('revokes a share link', async () => {
        const data = await registerBusiness('J');
        const sale = await createSale(data.accessToken, onePen);

        const created = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        const token = created.body.data.shareToken;

        const revoked = await request(app)
            .delete(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        expect(revoked.status).toBe(200);

        const publicRes = await request(app).get(`/api/v1/public/invoices/${token}`);
        expect(publicRes.status).toBe(404);
    });

    it('keeps share endpoints tenant-scoped', async () => {
        const dataA = await registerBusiness('K');
        const dataB = await registerBusiness('L');
        const sale = await createSale(dataA.accessToken, onePen);

        const share = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(dataB.accessToken));
        expect(share.status).toBe(404);

        const revoke = await request(app)
            .delete(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(dataB.accessToken));
        expect(revoke.status).toBe(404);
    });

    it('serves a public invoice without authentication and leaks nothing extra', async () => {
        const data = await registerBusiness('M');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const sale = await createSale(data.accessToken, {
            items: [{ name: 'Rice', qty: 1, rate: 10000, gstRate: 18, hsn: '1006' }],
            isGst: true,
            buyerName: 'Ramesh',
            buyerGstin: '27XYZAB5678C1Z9',
            paymentMethod: 'credit',
        });
        const created = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        const token = created.body.data.shareToken;

        const res = await request(app).get(`/api/v1/public/invoices/${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.invoice.invoiceNumber).toBe('INV-1');
        expect(res.body.data.invoice.total).toBe(11800);
        expect(res.body.data.invoice.cgst).toBe(900);
        expect(res.body.data.business.gstin).toBe('27ABCDE1234F1Z5');
        expect(res.body.data.invoice.status).toBe('completed');

        const serialized = JSON.stringify(res.body.data);
        expect(serialized).not.toContain('businessId');
        expect(serialized).not.toContain('customerId');
        expect(serialized).not.toContain('paymentMethod');
        expect(serialized).not.toContain('shareToken');
        expect(serialized).not.toContain('plan');
        expect(res.body.data.invoice.id).toBeUndefined();
        expect(res.body.data.invoice._id).toBeUndefined();
    });

    it('returns 404 for unknown, revoked and expired tokens', async () => {
        const data = await registerBusiness('N');
        const sale = await createSale(data.accessToken, onePen);

        const unknown = await request(app).get('/api/v1/public/invoices/definitely-not-real');
        expect(unknown.status).toBe(404);

        const created = await request(app)
            .post(`/api/v1/invoices/${sale.id}/share`)
            .set(auth(data.accessToken));
        const token = created.body.data.shareToken;

        const Sale = require('../src/models/Sale');
        await Sale.updateOne({ _id: sale.id }, { shareTokenExpiresAt: new Date(Date.now() - 1000) });
        const expired = await request(app).get(`/api/v1/public/invoices/${token}`);
        expect(expired.status).toBe(404);
    });

    it('reports the email feature flag', async () => {
        const data = await registerBusiness('O');
        emailService.isEmailConfigured.mockReturnValue(false);
        const off = await request(app).get('/api/v1/config/features').set(auth(data.accessToken));
        expect(off.status).toBe(200);
        expect(off.body.data.email).toBe(false);

        emailService.isEmailConfigured.mockReturnValue(true);
        const on = await request(app).get('/api/v1/config/features').set(auth(data.accessToken));
        expect(on.body.data.email).toBe(true);
    });

    it('requires auth for the feature flag', async () => {
        const res = await request(app).get('/api/v1/config/features');
        expect(res.status).toBe(401);
    });

    it('keeps isTokenExpired failing closed for a sale with no expiry', () => {
        expect(isTokenExpired({ shareTokenExpiresAt: null })).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/invoiceDelivery.test.js --runInBand`
Expected: FAIL — `POST /api/v1/invoices/x/email` returns 404 (`Route not found`).

- [ ] **Step 3: Add the controller handlers**

Require the new modules at the top of [`invoiceController.js`](server/src/controllers/invoiceController.js:1):

```js
const {
    generateShareToken,
    shareTokenExpiry,
    isTokenExpired,
    shareUrlFor,
} = require('../utils/shareToken');
const { sendInvoiceEmail } = require('../services/emailService');
const { invoiceEmailHtml } = require('../services/emailTemplates');
```

Append to the same file:

```js
const PUBLIC_INVOICE_FIELDS =
    'invoiceNumber date items subtotal discount tax isGst cgst sgst igst ' +
    'buyerName buyerAddress buyerGstin placeOfSupply total status';

exports.sendInvoiceEmail = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'A PDF attachment is required' });
    }

    const business = await Business.findById(req.businessId);
    const businessName = (business && business.name) || 'our store';
    const link = sale.shareToken ? shareUrlFor(sale.shareToken) : '';

    try {
        await sendInvoiceEmail({
            to: req.body.to,
            subject: req.body.subject || `Invoice ${sale.invoiceNumber} from ${businessName}`,
            html: invoiceEmailHtml({ business: business && business.toJSON(), invoice: sale, link }),
            pdf: req.file.buffer,
            fileName: `${sale.invoiceNumber || 'invoice'}.pdf`,
        });
    } catch (err) {
        return res
            .status(err.status || 502)
            .json({ success: false, message: err.message || 'Could not send email' });
    }

    return res.json({ success: true, message: 'Invoice emailed', data: null });
};

exports.createShareLink = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Every call rotates: a previously leaked link stops working.
    sale.shareToken = generateShareToken();
    sale.shareTokenExpiresAt = shareTokenExpiry();
    await sale.save();

    return res.json({
        success: true,
        message: 'Share link created',
        data: {
            shareToken: sale.shareToken,
            shareUrl: shareUrlFor(sale.shareToken),
            expiresAt: sale.shareTokenExpiresAt,
        },
    });
};

exports.revokeShareLink = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    sale.shareToken = '';
    sale.shareTokenExpiresAt = null;
    await sale.save();

    return res.json({ success: true, message: 'Share link revoked', data: null });
};

// The token is the authorization. No authenticate, no tenantScope.
exports.getPublicInvoice = async (req, res) => {
    const token = req.params.token;
    const notFound = { success: false, message: 'This invoice link is no longer available' };
    if (!token) return res.status(404).json(notFound);

    const sale = await Sale.findOne({ shareToken: token }).select(
        `${PUBLIC_INVOICE_FIELDS} businessId shareTokenExpiresAt`
    );
    if (!sale || !sale.shareToken || isTokenExpired(sale)) {
        return res.status(404).json(notFound);
    }

    const business = await Business.findById(sale.businessId);
    const invoice = {
        invoiceNumber: sale.invoiceNumber,
        date: sale.date,
        items: sale.items.map((it) => ({
            name: it.name,
            qty: it.qty,
            rate: it.rate,
            amount: it.amount,
            gstRate: it.gstRate,
            hsn: it.hsn,
        })),
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        isGst: sale.isGst,
        cgst: sale.cgst,
        sgst: sale.sgst,
        igst: sale.igst,
        buyerName: sale.buyerName,
        buyerAddress: sale.buyerAddress,
        buyerGstin: sale.buyerGstin,
        placeOfSupply: sale.placeOfSupply,
        total: sale.total,
        status: sale.status,
    };

    return res.json({
        success: true,
        message: 'OK',
        data: {
            invoice,
            business: business
                ? { name: business.name, address: business.address, gstin: business.gstin }
                : null,
        },
    });
};
```

Note the explicit field-by-field `invoice` object: it is what keeps `businessId`, `customerId`, `paymentMethod`, `shareToken` and every plan field out of the public payload.

- [ ] **Step 4: Add the authenticated routes**

Replace [`invoiceRoutes.js`](server/src/routes/invoiceRoutes.js:1) with:

```js
const express = require('express');
const { query, body } = require('express-validator');
const invoiceController = require('../controllers/invoiceController');
const { authenticate, tenantScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { pdfUpload } = require('../middleware/pdfUpload');

const router = express.Router();

router.get(
    '/',
    authenticate,
    tenantScope,
    query('type').optional({ values: 'falsy' }).isIn(['gst', 'non-gst']).withMessage('Invalid invoice type'),
    query('from').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid from date'),
    query('to').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid to date'),
    validate,
    invoiceController.listInvoices
);

// pdfUpload must run before the body validators so req.body is populated.
router.post(
    '/:id/email',
    authenticate,
    tenantScope,
    pdfUpload,
    body('to').trim().isEmail().withMessage('A valid recipient email is required'),
    body('subject').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
    validate,
    invoiceController.sendInvoiceEmail
);

router.post('/:id/share', authenticate, tenantScope, invoiceController.createShareLink);
router.delete('/:id/share', authenticate, tenantScope, invoiceController.revokeShareLink);

router.get('/:id', authenticate, tenantScope, invoiceController.getInvoice);

module.exports = router;
```

- [ ] **Step 5: Add the public and config routers**

Create `server/src/routes/publicRoutes.js`:

```js
const express = require('express');
const invoiceController = require('../controllers/invoiceController');

const router = express.Router();

// Unauthenticated by design: the share token is the authorization.
router.get('/invoices/:token', invoiceController.getPublicInvoice);

module.exports = router;
```

Create `server/src/controllers/configController.js`:

```js
const { isEmailConfigured } = require('../services/emailService');

exports.getFeatures = async (req, res) => {
    return res.json({
        success: true,
        message: 'OK',
        data: { email: isEmailConfigured() },
    });
};
```

Create `server/src/routes/configRoutes.js`:

```js
const express = require('express');
const configController = require('../controllers/configController');
const { authenticate, tenantScope } = require('../middleware/auth');

const router = express.Router();

router.get('/features', authenticate, tenantScope, configController.getFeatures);

module.exports = router;
```

In [`routes/index.js`](server/src/routes/index.js), add after the `plans` line:

```js
router.use('/public', require('./publicRoutes'));
router.use('/config', require('./configRoutes'));
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx jest tests/invoiceDelivery.test.js --runInBand`
Expected: PASS — 15 tests.

If `routes/index.js` ordering causes the public route to be shadowed, confirm `/public` is registered before `notFound` in [`app.js`](server/src/app.js:28) — it is, because all `router.use` lines sit inside the single `/api/v1` mount.

- [ ] **Step 7: Run the whole server suite**

Run: `npm run test:server`
Expected: all suites PASS, including the pre-existing [`invoices.test.js`](server/tests/invoices.test.js) and [`sales.test.js`](server/tests/sales.test.js).

- [ ] **Step 8: Commit**

```bash
git add server/src/controllers/invoiceController.js server/src/controllers/configController.js server/src/routes/invoiceRoutes.js server/src/routes/publicRoutes.js server/src/routes/configRoutes.js server/src/routes/index.js server/tests/invoiceDelivery.test.js
git commit -m "feat: add invoice email, share link and public invoice endpoints"
```

---

### Task 5: Extract InvoiceDocument (regression guard)

This task changes **no behaviour**. Its whole point is that [`InvoiceDetail.test.jsx`](client/src/pages/InvoiceDetail.test.jsx) keeps passing **untouched**.

**Files:**
- Create: `client/src/components/InvoiceDocument.jsx`
- Modify: `client/src/pages/InvoiceDetail.jsx`

**Interfaces:**
- Consumes: `lineBreakup` from [`../utils/gst`](client/src/utils/gst.js), `formatINR`/`amountToWords` from [`../utils/money`](client/src/utils/money.js), `formatDate` from [`../utils/format`](client/src/utils/format.js).
- Produces: default export `InvoiceDocument({ invoice, business, variant })`. `variant` is `'screen'` (default) or `'print'`.

- [ ] **Step 1: Confirm the guard is green before the move**

Run: `cd client && npx vitest run src/pages/InvoiceDetail.test.jsx`
Expected: PASS — 3 tests. This is the baseline.

- [ ] **Step 2: Create `client/src/components/InvoiceDocument.jsx`**

Move the template verbatim out of [`InvoiceDetail.jsx`](client/src/pages/InvoiceDetail.jsx:11-27) and [`InvoiceDetail.jsx`](client/src/pages/InvoiceDetail.jsx:78-80) and [`InvoiceDetail.jsx`](client/src/pages/InvoiceDetail.jsx:121-311). The **only** change is the root `className` and the removal of the module-level `breakup`/`interState` variables in favour of local ones.

```jsx
import { formatINR, amountToWords } from '../utils/money';
import { formatDate } from '../utils/format';
import { lineBreakup } from '../utils/gst';

// Groups invoice lines by HSN + rate for the GST breakup table.
const buildBreakup = (invoice) => {
    const lines = lineBreakup(invoice.items, invoice.discount);
    const groups = new Map();
    invoice.items.forEach((it, i) => {
        const key = `${it.hsn || ''}|${it.gstRate || 0}`;
        const group = groups.get(key) || {
            hsn: it.hsn || '',
            gstRate: it.gstRate || 0,
            taxableValue: 0,
            tax: 0,
        };
        group.taxableValue += lines[i].taxableValue;
        group.tax += lines[i].tax;
        groups.set(key, group);
    });
    return [...groups.values()];
};

// variant="screen" keeps the glass panel; variant="print" is plain white so
// html2canvas captures it faithfully (it cannot reproduce glass or shadows).
export default function InvoiceDocument({ invoice, business, variant = 'screen' }) {
    const rootClass =
        variant === 'print'
            ? 'mx-auto max-w-3xl bg-white p-10'
            : 'glass mx-auto max-w-3xl bg-white p-10 print:p-0';

    const breakup = invoice.isGst ? buildBreakup(invoice) : [];
    const interState = invoice.isGst ? invoice.igst > 0 : false;

    return (
        <div className={rootClass}>
            <div className="flex items-start justify-between border-b border-gray-200 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {business?.name || 'My Business'}
                    </h2>
                    {business?.address && (
                        <p className="mt-1 text-sm text-gray-500">{business.address}</p>
                    )}
                    {business?.gstin && (
                        <p className="mt-1 text-sm text-gray-500">GSTIN: {business.gstin}</p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Invoice</p>
                    <p className="text-xl font-bold text-gray-900">
                        {invoice.invoiceNumber}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{formatDate(invoice.date)}</p>
                </div>
            </div>

            {invoice.isGst && (
                <div className="mt-6 flex items-start justify-between gap-6">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">Billed to</p>
                        <p className="font-semibold text-gray-800">
                            {invoice.buyerName || 'Walk-in customer'}
                        </p>
                        {invoice.buyerAddress && (
                            <p className="text-sm text-gray-500">{invoice.buyerAddress}</p>
                        )}
                        {invoice.buyerGstin && (
                            <p className="text-sm text-gray-500">
                                GSTIN: {invoice.buyerGstin}
                            </p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                            Place of Supply
                        </p>
                        <p className="font-semibold text-gray-800">
                            {invoice.placeOfSupply || '—'}
                        </p>
                    </div>
                </div>
            )}

            {invoice.status === 'cancelled' && (
                <div className="mt-6 rounded-xl border-2 border-red-300 px-4 py-2 text-center text-sm font-bold uppercase tracking-widest text-red-600">
                    Cancelled
                </div>
            )}

            <table className="mt-6 w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="pb-2">#</th>
                        <th className="pb-2">Item</th>
                        {invoice.isGst && <th className="pb-2">HSN</th>}
                        <th className="pb-2 text-right">Qty</th>
                        <th className="pb-2 text-right">Rate</th>
                        {invoice.isGst && <th className="pb-2 text-right">GST</th>}
                        <th className="pb-2 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items.map((it, i) => (
                        <tr key={i} className="border-b border-gray-100">
                            <td className="py-2 text-gray-400">{i + 1}</td>
                            <td className="py-2 font-medium text-gray-800">{it.name}</td>
                            {invoice.isGst && (
                                <td className="py-2 text-gray-500">{it.hsn || '—'}</td>
                            )}
                            <td className="py-2 text-right">{it.qty}</td>
                            <td className="py-2 text-right">{formatINR(it.rate)}</td>
                            {invoice.isGst && (
                                <td className="py-2 text-right">{it.gstRate || 0}%</td>
                            )}
                            <td className="py-2 text-right">{formatINR(it.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {invoice.isGst && breakup.length > 0 && (
                <div className="mt-6">
                    <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
                        Tax breakup
                    </p>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="pb-2">HSN</th>
                                <th className="pb-2 text-right">Taxable value</th>
                                <th className="pb-2 text-right">Rate</th>
                                <th className="pb-2 text-right">
                                    {interState ? 'IGST' : 'CGST'}
                                </th>
                                {!interState && <th className="pb-2 text-right">SGST</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {breakup.map((g, i) => {
                                const half = Math.ceil(g.tax / 2);
                                return (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-2">{g.hsn || '—'}</td>
                                        <td className="py-2 text-right">
                                            {formatINR(g.taxableValue)}
                                        </td>
                                        <td className="py-2 text-right">{g.gstRate}%</td>
                                        {interState ? (
                                            <td className="py-2 text-right">
                                                {formatINR(g.tax)}
                                            </td>
                                        ) : (
                                            <>
                                                <td className="py-2 text-right">
                                                    {formatINR(half)}
                                                </td>
                                                <td className="py-2 text-right">
                                                    {formatINR(g.tax - half)}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>{formatINR(invoice.subtotal)}</span>
                    </div>
                    {invoice.discount > 0 && (
                        <div className="flex justify-between text-gray-600">
                            <span>Discount</span>
                            <span>-{formatINR(invoice.discount)}</span>
                        </div>
                    )}
                    {invoice.isGst && interState && invoice.igst > 0 && (
                        <div className="flex justify-between text-gray-600">
                            <span>IGST</span>
                            <span>+{formatINR(invoice.igst)}</span>
                        </div>
                    )}
                    {invoice.isGst && !interState && invoice.cgst > 0 && (
                        <>
                            <div className="flex justify-between text-gray-600">
                                <span>CGST</span>
                                <span>+{formatINR(invoice.cgst)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>SGST</span>
                                <span>+{formatINR(invoice.sgst)}</span>
                            </div>
                        </>
                    )}
                    {!invoice.isGst && invoice.tax > 0 && (
                        <div className="flex justify-between text-gray-600">
                            <span>Tax</span>
                            <span>+{formatINR(invoice.tax)}</span>
                        </div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                        <span>Total</span>
                        <span>{formatINR(invoice.total)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                        <span>Payment</span>
                        <span className="uppercase">{invoice.paymentMethod}</span>
                    </div>
                </div>
            </div>
            <p className="mt-6 text-xs italic text-gray-500">
                Amount in words: {amountToWords(invoice.total)}
            </p>
            <div className="mt-8 flex items-end justify-between border-t border-dashed border-gray-200 pt-4 text-xs text-gray-400">
                <span>Thank you for your business!</span>
                <span>Scan UPI QR to pay (coming soon)</span>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Rewire `client/src/pages/InvoiceDetail.jsx`**

Replace lines 1-28 (imports and `buildBreakup`) with:

```jsx
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { invoicesApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import { FileText } from 'lucide-react';
import InvoiceDocument from '../components/InvoiceDocument';
```

Delete the local `breakup` and `interState` declarations (old lines 80-81) and replace the whole `<div ref={printRef} ...>` block (old lines 123-311) with:

```jsx
                    <div ref={printRef}>
                        <InvoiceDocument invoice={invoice} business={business} variant="screen" />
                    </div>
```

The `printRef` div stays as the `useReactToPrint` target; the class list moves onto `InvoiceDocument`.

- [ ] **Step 4: Run the guard test**

Run: `cd client && npx vitest run src/pages/InvoiceDetail.test.jsx`
Expected: PASS — the same 3 tests, **with the test file unmodified**.

- [ ] **Step 5: Verify no duplicate text in the DOM**

`screen.getByText('INV-9')` throws if two nodes match, so Step 4 already proves the template renders exactly once.

- [ ] **Step 6: Run the client suite**

Run: `npm run test:client`
Expected: all suites PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/InvoiceDocument.jsx client/src/pages/InvoiceDetail.jsx
git commit -m "refactor: extract InvoiceDocument from InvoiceDetail"
```

---

### Task 6: Client PDF seam

**Files:**
- Create: `client/src/utils/invoicePdf.js`
- Create: `client/src/utils/invoicePdf.test.js`
- Modify: `client/package.json` (add `html2canvas`, `jspdf`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildInvoicePdf(element: HTMLElement): Promise<Blob>` — rejects with `'Nothing to capture'` when `element` is falsy.
  - `downloadBlob(blob: Blob, fileName: string): void`
  - `A4_WIDTH_MM = 210`, `A4_HEIGHT_MM = 297`
  - `MAX_PDF_BYTES = 5 * 1024 * 1024` — the client-side mirror of the server cap.

- [ ] **Step 1: Install the PDF libraries**

Run: `cd client && npm install html2canvas jspdf`
Expected: both appear in `client/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `client/src/utils/invoicePdf.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { buildInvoicePdf, downloadBlob, A4_WIDTH_MM, A4_HEIGHT_MM, MAX_PDF_BYTES } from './invoicePdf';

vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', () => ({ jsPDF: vi.fn() }));

const makePdfStub = () => {
    const pdf = {
        addImage: vi.fn(),
        addPage: vi.fn(),
        output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
    };
    jsPDF.mockImplementation(() => pdf);
    return pdf;
};

describe('buildInvoicePdf', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects when there is no element to capture', async () => {
        await expect(buildInvoicePdf(null)).rejects.toThrow('Nothing to capture');
        expect(html2canvas).not.toHaveBeenCalled();
    });

    it('captures at 2x on a white background and emits a Blob', async () => {
        const canvas = { width: 1000, height: 1000, toDataURL: vi.fn(() => 'data:image/jpeg;base64,AAA') };
        html2canvas.mockResolvedValue(canvas);
        const pdf = makePdfStub();
        const element = document.createElement('div');

        const blob = await buildInvoicePdf(element);

        expect(html2canvas).toHaveBeenCalledWith(element, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
        });
        expect(pdf.addImage).toHaveBeenCalledTimes(1);
        expect(pdf.addPage).not.toHaveBeenCalled();
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('application/pdf');
    });

    it('slices a tall invoice across multiple A4 pages', async () => {
        // 1000 x 2000 px at 210 mm wide -> 420 mm tall -> two A4 pages.
        const canvas = { width: 1000, height: 2000, toDataURL: vi.fn(() => 'data:image/jpeg;base64,AAA') };
        html2canvas.mockResolvedValue(canvas);
        const pdf = makePdfStub();

        await buildInvoicePdf(document.createElement('div'));

        expect(pdf.addImage).toHaveBeenCalledTimes(2);
        expect(pdf.addPage).toHaveBeenCalledTimes(1);
        expect(pdf.addImage.mock.calls[0][4]).toBe(A4_WIDTH_MM);
        expect(pdf.addImage.mock.calls[1][3]).toBe(-A4_HEIGHT_MM);
    });

    it('surfaces an html2canvas failure to the caller', async () => {
        html2canvas.mockRejectedValue(new Error('canvas exploded'));
        await expect(buildInvoicePdf(document.createElement('div'))).rejects.toThrow('canvas exploded');
    });
});

describe('downloadBlob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:fake'),
            revokeObjectURL: vi.fn(),
        });
    });

    it('clicks a temporary anchor and cleans up', () => {
        const click = vi.fn();
        const anchor = { href: '', download: '', click, remove: vi.fn() };
        const createElement = vi.spyOn(document, 'createElement').mockReturnValue(anchor);

        downloadBlob(new Blob(['x']), 'INV-1.pdf');

        expect(anchor.download).toBe('INV-1.pdf');
        expect(anchor.href).toBe('blob:fake');
        expect(click).toHaveBeenCalledTimes(1);
        expect(anchor.remove).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
        createElement.mockRestore();
    });
});

describe('caps', () => {
    it('mirrors the server 5 MB attachment cap', () => {
        expect(MAX_PDF_BYTES).toBe(5 * 1024 * 1024);
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/invoicePdf.test.js`
Expected: FAIL — cannot resolve `./invoicePdf`.

- [ ] **Step 4: Write `client/src/utils/invoicePdf.js`**

```js
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
// Mirrors the server-side multer cap so the client can reject before uploading.
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

// The single PDF seam. The element must be laid out (not display:none) for
// html2canvas to measure it.
export const buildInvoicePdf = async (element) => {
    if (!element) throw new Error('Nothing to capture');

    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const imageHeight = (canvas.height * A4_WIDTH_MM) / canvas.width;

    // One tall image per page, offset upward each time. jsPDF clips the rest.
    let offset = 0;
    pdf.addImage(dataUrl, 'JPEG', 0, offset, A4_WIDTH_MM, imageHeight);
    let remaining = imageHeight - A4_HEIGHT_MM;
    while (remaining > 0) {
        offset -= A4_HEIGHT_MM;
        pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, offset, A4_WIDTH_MM, imageHeight);
        remaining -= A4_HEIGHT_MM;
    }

    return pdf.output('blob');
};

export const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run src/utils/invoicePdf.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/package-lock.json client/src/utils/invoicePdf.js client/src/utils/invoicePdf.test.js
git commit -m "feat: add client-side invoice PDF seam"
```

---

### Task 7: WhatsApp helper and API endpoints

**Files:**
- Create: `client/src/utils/whatsapp.js`
- Create: `client/src/utils/whatsapp.test.js`
- Modify: `client/src/api/endpoints.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `toWhatsAppNumber(phone: string): string` — digits only; a leading `0` is dropped; `91` is prefixed when exactly 10 digits remain; `''` for empty input.
  - `whatsappUrl(phone: string, text: string): string` — `https://wa.me/<number>?text=<encoded>`.
  - `invoicesApi.sendEmail(id, formData)`, `invoicesApi.share(id)`, `invoicesApi.revokeShare(id)`, `publicApi.getInvoice(token)`, `configApi.features()`.

- [ ] **Step 1: Write the failing test**

Create `client/src/utils/whatsapp.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { toWhatsAppNumber, whatsappUrl } from './whatsapp';

describe('toWhatsAppNumber', () => {
    it('prefixes 91 to a bare 10-digit number', () => {
        expect(toWhatsAppNumber('9876543210')).toBe('919876543210');
    });

    it('drops non-digits', () => {
        expect(toWhatsAppNumber('+91 98765 43210')).toBe('919876543210');
        expect(toWhatsAppNumber('(987) 654-3210')).toBe('919876543210');
    });

    it('drops a single leading zero', () => {
        expect(toWhatsAppNumber('09876543210')).toBe('919876543210');
    });

    it('keeps an already-prefixed 12-digit number', () => {
        expect(toWhatsAppNumber('919876543210')).toBe('919876543210');
    });

    it('returns an empty string for empty input', () => {
        expect(toWhatsAppNumber('')).toBe('');
        expect(toWhatsAppNumber(undefined)).toBe('');
        expect(toWhatsAppNumber('---')).toBe('');
    });
});

describe('whatsappUrl', () => {
    it('builds a wa.me deep link with an encoded message', () => {
        const url = whatsappUrl('9876543210', 'Invoice INV-1 · ₹129.80\nhttps://x.test/i/abc');
        expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
        expect(url).toContain(encodeURIComponent('Invoice INV-1'));
        expect(url).toContain(encodeURIComponent('https://x.test/i/abc'));
        expect(url).not.toContain('\n');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/whatsapp.test.js`
Expected: FAIL — cannot resolve `./whatsapp`.

- [ ] **Step 3: Write `client/src/utils/whatsapp.js`**

```js
// WhatsApp needs a country-coded, digits-only number.
export const toWhatsAppNumber = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    const trimmed = digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
    return trimmed.length === 10 ? `91${trimmed}` : trimmed;
};

export const whatsappUrl = (phone, text) =>
    `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(text)}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/utils/whatsapp.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Extend `client/src/api/endpoints.js`**

Replace the `invoicesApi` block (lines 46-50) with:

```js
// ---------- Invoices ----------
export const invoicesApi = {
    list: (params) => unwrap(api.get('/invoices', { params })),
    get: (id) => unwrap(api.get(`/invoices/${id}`)),
    sendEmail: (id, formData) => unwrap(api.post(`/invoices/${id}/email`, formData)),
    share: (id) => unwrap(api.post(`/invoices/${id}/share`)),
    revokeShare: (id) => unwrap(api.delete(`/invoices/${id}/share`)),
};

// Public invoice lookup. Goes through the shared axios instance on purpose: the
// public endpoint answers 404 (never 401) so the auth-refresh interceptor never
// fires, and no bearer token is needed even when a session exists.
export const publicApi = {
    getInvoice: (token) => unwrap(api.get(`/public/invoices/${token}`)),
};
```

Append after the `plansApi` block at the end of the file:

```js
// ---------- Feature flags ----------
export const configApi = {
    features: () => unwrap(api.get('/config/features')),
};
```

- [ ] **Step 6: Run the endpoints test and the client suite**

Run: `cd client && npx vitest run src/api/endpoints.test.js` and then `npm run test:client`
Expected: PASS — [`endpoints.test.js`](client/src/api/endpoints.test.js) is unaffected because it builds its own `api` stub.

- [ ] **Step 7: Commit**

```bash
git add client/src/utils/whatsapp.js client/src/utils/whatsapp.test.js client/src/api/endpoints.js
git commit -m "feat: add whatsapp helper and invoice delivery API client"
```

---

### Task 8: Send invoice dialog

**Files:**
- Create: `client/src/components/SendInvoiceDialog.jsx`
- Create: `client/src/components/SendInvoiceDialog.test.jsx`
- Modify: `client/src/pages/InvoiceDetail.jsx`
- Modify: `client/src/pages/InvoiceDetail.test.jsx` (mock factory only — assertions untouched)

**Interfaces:**
- Consumes: `buildInvoicePdf`, `downloadBlob`, `MAX_PDF_BYTES` (Task 6); `whatsappUrl`, `toWhatsAppNumber` (Task 7); `invoicesApi` (Task 7); `InvoiceDocument` (Task 5).
- Produces: default export `SendInvoiceDialog({ invoice, business, defaultEmail, defaultPhone, emailEnabled, getElement, onClose })`. Renders three buttons named exactly `Download PDF`, `Email invoice` and `WhatsApp`. `getElement: () => HTMLElement|null` returns the offscreen **print-variant** node to capture.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/SendInvoiceDialog.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SendInvoiceDialog from './SendInvoiceDialog';
import { invoicesApi } from '../api/endpoints';
import { buildInvoicePdf, downloadBlob } from '../utils/invoicePdf';

vi.mock('../api/endpoints', () => ({
    invoicesApi: {
        sendEmail: vi.fn(),
        share: vi.fn(),
        revokeShare: vi.fn(),
    },
}));

vi.mock('../utils/invoicePdf', async () => {
    const actual = await vi.importActual('../utils/invoicePdf');
    return {
        ...actual,
        buildInvoicePdf: vi.fn(),
        downloadBlob: vi.fn(),
    };
});

const invoice = {
    id: 'i1',
    invoiceNumber: 'INV-9',
    total: 12980,
    paymentMethod: 'cash',
    status: 'completed',
};
const business = { name: 'Local Test Shop' };

const renderDialog = (props = {}) => {
    const onClose = vi.fn();
    const element = document.createElement('div');
    render(
        <SendInvoiceDialog
            invoice={invoice}
            business={business}
            defaultEmail="buyer@example.com"
            defaultPhone="9876543210"
            emailEnabled
            getElement={() => element}
            onClose={onClose}
            {...props}
        />
    );
    return { onClose, element };
};

describe('SendInvoiceDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildInvoicePdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
        invoicesApi.share.mockResolvedValue({
            shareToken: 'tok',
            shareUrl: 'https://x.test/i/tok',
            expiresAt: '2026-10-14T00:00:00.000Z',
        });
        invoicesApi.sendEmail.mockResolvedValue(null);
        vi.stubGlobal('open', vi.fn());
    });

    it('downloads the PDF under the invoice number', async () => {
        const { element } = renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

        await waitFor(() => expect(buildInvoicePdf).toHaveBeenCalledWith(element));
        await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
        expect(downloadBlob.mock.calls[0][1]).toBe('INV-9.pdf');
    });

    it('shows an error and does not download when PDF generation fails', async () => {
        buildInvoicePdf.mockRejectedValue(new Error('boom'));
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

        expect(await screen.findByText(/could not generate pdf/i)).toBeInTheDocument();
        expect(downloadBlob).not.toHaveBeenCalled();
    });

    it('posts the PDF and recipient when emailing', async () => {
        renderDialog();
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'other@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: /email invoice/i }));

        await waitFor(() => expect(invoicesApi.sendEmail).toHaveBeenCalledTimes(1));
        const [id, formData] = invoicesApi.sendEmail.mock.calls[0];
        expect(id).toBe('i1');
        expect(formData.get('to')).toBe('other@example.com');
        expect(formData.get('pdf')).toBeInstanceOf(Blob);
        expect(await screen.findByText(/invoice emailed/i)).toBeInTheDocument();
    });

    it('refuses to email a file over 5 MB', async () => {
        buildInvoicePdf.mockResolvedValue({ size: 5 * 1024 * 1024 + 1, type: 'application/pdf' });
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /email invoice/i }));

        expect(await screen.findByText(/exceeds 5 mb/i)).toBeInTheDocument();
        expect(invoicesApi.sendEmail).not.toHaveBeenCalled();
    });

    it('surfaces a server send failure', async () => {
        invoicesApi.sendEmail.mockRejectedValue({
            response: { data: { message: 'Email is not configured' } },
        });
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /email invoice/i }));

        expect(await screen.findByText(/email is not configured/i)).toBeInTheDocument();
    });

    it('disables the email button when the feature is off', () => {
        renderDialog({ emailEnabled: false });
        expect(screen.getByRole('button', { name: /email invoice/i })).toBeDisabled();
        expect(screen.getByText(/email is not configured/i)).toBeInTheDocument();
    });

    it('creates a share link then opens WhatsApp with the link', async () => {
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

        await waitFor(() => expect(invoicesApi.share).toHaveBeenCalledWith('i1'));
        await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
        const [url, target] = window.open.mock.calls[0];
        expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
        expect(decodeURIComponent(url)).toContain('https://x.test/i/tok');
        expect(target).toBe('noopener');
    });

    it('does not open WhatsApp when the share call fails', async () => {
        invoicesApi.share.mockRejectedValue({ response: { data: { message: 'nope' } } });
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

        expect(await screen.findByText(/could not create the invoice link/i)).toBeInTheDocument();
        expect(window.open).not.toHaveBeenCalled();
    });

    it('blocks WhatsApp when there is no phone number', async () => {
        renderDialog({ defaultPhone: '' });
        fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

        expect(await screen.findByText(/phone number is required/i)).toBeInTheDocument();
        expect(invoicesApi.share).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/SendInvoiceDialog.test.jsx`
Expected: FAIL — cannot resolve `./SendInvoiceDialog`.

- [ ] **Step 3: Write `client/src/components/SendInvoiceDialog.jsx`**

```jsx
import { useState } from 'react';
import { Download, Mail, MessageCircle, X } from 'lucide-react';
import { invoicesApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import { buildInvoicePdf, downloadBlob, MAX_PDF_BYTES } from '../utils/invoicePdf';
import { whatsappUrl } from '../utils/whatsapp';

export default function SendInvoiceDialog({
    invoice,
    business,
    defaultEmail = '',
    defaultPhone = '',
    emailEnabled = true,
    getElement,
    onClose,
}) {
    const [email, setEmail] = useState(defaultEmail);
    const [phone, setPhone] = useState(defaultPhone);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const fileName = `${invoice.invoiceNumber || 'invoice'}.pdf`;

    const withPdf = async (run) => {
        try {
            const blob = await buildInvoicePdf(getElement());
            return await run(blob);
        } catch (err) {
            if (err && err.status) throw err;
            setError('Could not generate PDF');
            return null;
        }
    };

    const handleDownload = async () => {
        setError('');
        setNotice('');
        setBusy('download');
        try {
            await withPdf(async (blob) => {
                downloadBlob(blob, fileName);
                setNotice('PDF downloaded');
            });
        } finally {
            setBusy('');
        }
    };

    const handleEmail = async () => {
        setError('');
        setNotice('');
        if (!email.trim()) {
            setError('A valid recipient email is required');
            return;
        }
        setBusy('email');
        try {
            await withPdf(async (blob) => {
                if (blob.size > MAX_PDF_BYTES) {
                    setError('Attachment exceeds 5 MB');
                    return;
                }
                const formData = new FormData();
                formData.append('pdf', blob, fileName);
                formData.append('to', email.trim());
                try {
                    await invoicesApi.sendEmail(invoice.id, formData);
                    setNotice('Invoice emailed');
                } catch (err) {
                    setError(err.response?.data?.message || 'Could not send email');
                }
            });
        } finally {
            setBusy('');
        }
    };

    const handleWhatsApp = async () => {
        setError('');
        setNotice('');
        if (!phone.replace(/\D/g, '')) {
            setError('A phone number is required');
            return;
        }
        setBusy('whatsapp');
        try {
            let data;
            try {
                data = await invoicesApi.share(invoice.id);
            } catch {
                setError('Could not create the invoice link');
                return;
            }
            const text = [
                `${business?.name || 'Invoice'} · ${invoice.invoiceNumber}`,
                formatINR(invoice.total),
                data.shareUrl,
            ].join('\n');
            // Only ever called with a link in hand, never link-less.
            window.open(whatsappUrl(phone, text), 'noopener');
            setNotice('WhatsApp opened');
        } finally {
            setBusy('');
        }
    };

    return (
        <div className="glass p-6">
            <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold">Send invoice</h2>
                <button onClick={onClose} className="btn-ghost px-2 py-1" aria-label="Close">
                    <X size={16} />
                </button>
            </div>

            {error && (
                <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    {error}
                </div>
            )}
            {notice && (
                <div className="mt-4 rounded-xl bg-white/60 px-4 py-3 text-sm font-medium text-primary">
                    {notice}
                </div>
            )}

            <div className="mt-4 grid gap-4">
                <label className="block text-sm font-medium">
                    Email
                    <input
                        type="email"
                        className="glass-input mt-1"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </label>
                <label className="block text-sm font-medium">
                    WhatsApp number
                    <input
                        type="tel"
                        className="glass-input mt-1"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </label>
            </div>

            {!emailEnabled && (
                <p className="mt-4 text-sm text-gray-500">
                    Email is not configured on this server. Add SMTP settings to enable it.
                </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
                <button
                    onClick={handleDownload}
                    disabled={busy !== ''}
                    className="btn-ghost flex items-center gap-2"
                >
                    <Download size={16} /> Download PDF
                </button>
                <button
                    onClick={handleEmail}
                    disabled={busy !== '' || !emailEnabled}
                    className="btn-primary flex items-center gap-2"
                >
                    <Mail size={16} /> Email invoice
                </button>
                <button
                    onClick={handleWhatsApp}
                    disabled={busy !== ''}
                    className="btn-primary flex items-center gap-2"
                >
                    <MessageCircle size={16} /> WhatsApp
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/SendInvoiceDialog.test.jsx`
Expected: PASS — 9 tests.

- [ ] **Step 5: Wire the dialog into `InvoiceDetail.jsx`**

Add these imports:

```jsx
import { configApi, invoicesApi } from '../api/endpoints';
import SendInvoiceDialog from '../components/SendInvoiceDialog';
```

Add state and the offscreen print node:

```jsx
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const pdfRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const features = await configApi.features();
                if (!cancelled) setEmailEnabled(Boolean(features.email));
            } catch {
                if (!cancelled) setEmailEnabled(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);
```

Add a `Send invoice` button in the header action group, next to Share:

```jsx
                            <button onClick={() => setDialogOpen(true)} className="btn-ghost">
                                Send invoice
                            </button>
```

Render the dialog plus the **offscreen print-variant** capture node. The capture node only exists while the dialog is open, so the template renders exactly once in the default state and the existing DOM queries stay unambiguous:

```jsx
            {dialogOpen && invoice && (
                <>
                    <SendInvoiceDialog
                        invoice={invoice}
                        business={business}
                        defaultEmail=""
                        defaultPhone=""
                        emailEnabled={emailEnabled}
                        getElement={() => pdfRef.current}
                        onClose={() => setDialogOpen(false)}
                    />
                    {/* position:fixed offscreen, NOT display:none — html2canvas needs layout */}
                    <div
                        ref={pdfRef}
                        aria-hidden="true"
                        style={{
                            position: 'fixed',
                            left: '-10000px',
                            top: 0,
                            width: '794px',
                            background: '#ffffff',
                        }}
                    >
                        <InvoiceDocument invoice={invoice} business={business} variant="print" />
                    </div>
                </>
            )}
```

`794px` is A4 at 96 dpi; `variant="print"` gives html2canvas plain white markup with no glass or shadow.

- [ ] **Step 6: Update the mock factory in `client/src/pages/InvoiceDetail.test.jsx`**

The page now also reads the feature flag, so its `vi.mock` factory must declare `configApi`. **Do not change any assertion in that file** — it remains the regression guard for Task 5.

Replace the factory (lines 7-12) with:

```js
vi.mock('../api/endpoints', () => ({
    invoicesApi: {
        list: vi.fn(),
        get: vi.fn(),
    },
    // Declared because the page reads the email feature flag on mount.
    configApi: {
        features: vi.fn().mockResolvedValue({ email: true }),
    },
}));
```

- [ ] **Step 7: Run the page tests and the client suite**

Run: `cd client && npx vitest run src/pages/InvoiceDetail.test.jsx` and then `npm run test:client`
Expected: PASS — the 3 original assertions plus everything else.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/SendInvoiceDialog.jsx client/src/components/SendInvoiceDialog.test.jsx client/src/pages/InvoiceDetail.jsx client/src/pages/InvoiceDetail.test.jsx
git commit -m "feat: add send invoice dialog with download, email and whatsapp"
```

---

### Task 9: Public invoice page

**Files:**
- Create: `client/src/pages/PublicInvoice.jsx`
- Create: `client/src/pages/PublicInvoice.test.jsx`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Consumes: `publicApi.getInvoice(token)` (Task 7); `InvoiceDocument` (Task 5); `buildInvoicePdf`, `downloadBlob` (Task 6).
- Produces: default export `PublicInvoice()`. Public route `/i/:token`.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/PublicInvoice.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublicInvoice from './PublicInvoice';
import { publicApi } from '../api/endpoints';
import { buildInvoicePdf, downloadBlob } from '../utils/invoicePdf';

vi.mock('../api/endpoints', () => ({
    publicApi: { getInvoice: vi.fn() },
}));

vi.mock('../utils/invoicePdf', async () => {
    const actual = await vi.importActual('../utils/invoicePdf');
    return { ...actual, buildInvoicePdf: vi.fn(), downloadBlob: vi.fn() };
});

const invoice = {
    invoiceNumber: 'INV-9',
    date: '2026-09-05T10:30:00.000Z',
    items: [{ name: 'Rice 1kg', qty: 2, rate: 5500, amount: 11000, gstRate: 18, hsn: '1006' }],
    subtotal: 11000,
    discount: 0,
    tax: 1980,
    cgst: 990,
    sgst: 990,
    igst: 0,
    total: 12980,
    isGst: true,
    buyerName: 'Ramesh',
    buyerGstin: '27XYZAB5678C1Z9',
    buyerAddress: 'MG Road, Pune',
    placeOfSupply: 'MH',
    status: 'completed',
};
const business = { name: 'Local Test Shop', address: 'Main Road, Pune', gstin: '27ABCDE1234F1Z5' };

const renderPage = (token = 'tok') =>
    render(
        <MemoryRouter initialEntries={[`/i/${token}`]}>
            <Routes>
                <Route path="/i/:token" element={<PublicInvoice />} />
            </Routes>
        </MemoryRouter>
    );

describe('PublicInvoice page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildInvoicePdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    });

    it('renders the invoice without any authentication', async () => {
        publicApi.getInvoice.mockResolvedValue({ invoice, business });
        renderPage();

        expect(await screen.findByText('INV-9')).toBeInTheDocument();
        expect(screen.getByText('Local Test Shop')).toBeInTheDocument();
        expect(screen.getByText(/27XYZAB5678C1Z9/)).toBeInTheDocument();
        expect(publicApi.getInvoice).toHaveBeenCalledWith('tok');
    });

    it('offers a download button that saves the PDF', async () => {
        publicApi.getInvoice.mockResolvedValue({ invoice, business });
        renderPage();
        await screen.findByText('INV-9');

        fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

        await waitFor(() => expect(buildInvoicePdf).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
        expect(downloadBlob.mock.calls[0][1]).toBe('INV-9.pdf');
    });

    it('shows one identical unavailable state for a 404', async () => {
        publicApi.getInvoice.mockRejectedValue({ response: { status: 404 } });
        renderPage('gone');

        expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /download pdf/i })).toBeNull();
    });

    it('shows the same unavailable state for a network failure', async () => {
        publicApi.getInvoice.mockRejectedValue(new Error('offline'));
        renderPage('gone');

        expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
    });

    it('renders a cancelled invoice with the cancelled banner', async () => {
        publicApi.getInvoice.mockResolvedValue({
            invoice: { ...invoice, status: 'cancelled' },
            business,
        });
        renderPage();
        await screen.findByText('INV-9');

        expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/PublicInvoice.test.jsx`
Expected: FAIL — cannot resolve `./PublicInvoice`.

- [ ] **Step 3: Write `client/src/pages/PublicInvoice.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { publicApi } from '../api/endpoints';
import InvoiceDocument from '../components/InvoiceDocument';
import { buildInvoicePdf, downloadBlob } from '../utils/invoicePdf';

export default function PublicInvoice() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const d = await publicApi.getInvoice(token);
                if (!cancelled) setData(d);
            } catch {
                // Invalid, expired, revoked and unknown tokens are indistinguishable on purpose.
                if (!cancelled) setFailed(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const handleDownload = async () => {
        setError('');
        setBusy(true);
        try {
            const blob = await buildInvoicePdf(ref.current);
            downloadBlob(blob, `${data.invoice.invoiceNumber || 'invoice'}.pdf`);
        } catch {
            setError('Could not generate PDF');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-100 p-6">
            {loading && (
                <div className="glass mx-auto max-w-3xl p-10">
                    <div className="skeleton h-8 w-48" />
                    <div className="skeleton mt-6 h-40" />
                </div>
            )}

            {!loading && failed && (
                <div className="glass mx-auto max-w-md p-10 text-center">
                    <p className="text-lg font-semibold">This invoice link is no longer available</p>
                    <p className="mt-2 text-sm text-gray-500">
                        Ask the seller to send a fresh link.
                    </p>
                </div>
            )}

            {!loading && !failed && data && (
                <div className="mx-auto max-w-3xl space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={handleDownload}
                            disabled={busy}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Download size={16} /> Download PDF
                        </button>
                    </div>
                    {error && (
                        <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
                    )}
                    <div ref={ref}>
                        <InvoiceDocument
                            invoice={data.invoice}
                            business={data.business}
                            variant="screen"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/PublicInvoice.test.jsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Add the public route to `client/src/App.jsx`**

Add the import:

```jsx
import PublicInvoice from './pages/PublicInvoice';
```

Add the route as a sibling of `/login` and `/register`, **before** the `/*` catch-all:

```jsx
          <Route path="/i/:token" element={<PublicInvoice />} />
```

The outer `<Routes>` order must end up as `/login`, `/register`, `/i/:token`, `/*` so the public page is reachable without a session.

- [ ] **Step 6: Run the client suite**

Run: `npm run test:client`
Expected: all suites PASS, including [`App.test.jsx`](client/src/App.test.jsx).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/PublicInvoice.jsx client/src/pages/PublicInvoice.test.jsx client/src/App.jsx
git commit -m "feat: add public read-only invoice page"
```

---

### Task 10: Documentation and end-to-end verification

**Files:**
- Modify: `docs/API.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: every endpoint and route added in Tasks 1-9.
- Produces: no code.

- [ ] **Step 1: Document the endpoints in `docs/API.md`**

Add a section covering:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/invoices/:id/email` | 🔒 | multipart: `pdf` (file, ≤ 5 MB, `application/pdf`), `to`, optional `subject`. 503 if SMTP unset, 502 on transport failure, 400 bad file or recipient, 413 oversize, 404 foreign invoice |
| POST | `/invoices/:id/share` | 🔒 | Returns `{ shareToken, shareUrl, expiresAt }`. Rotates on every call |
| DELETE | `/invoices/:id/share` | 🔒 | Clears the token and its expiry |
| GET | `/public/invoices/:token` | 🌐 | Unauthenticated reduced projection. 404 for unknown, expired or revoked tokens |
| GET | `/config/features` | 🔒 | `{ email: boolean }` |

Also document the new env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `SHARE_LINK_BASE_URL`, `SHARE_LINK_TTL_DAYS`.

- [ ] **Step 2: Note the feature in `README.md`**

Add a short "Invoice delivery" bullet list: download PDF from the browser, email with the PDF attached, WhatsApp a public link, public read-only page at `/i/:token`.

- [ ] **Step 3: Run both full suites**

Run: `npm run test:server` then `npm run test:client`
Expected: every suite PASS. Record the counts.

- [ ] **Step 4: Run the production build**

Run: `cd client && npx vite build`
Expected: build succeeds with no unresolved imports. Verify `html2canvas` and `jspdf` are bundled rather than externalized.

- [ ] **Step 5: Hand the manual acceptance checklist to the user**

The following cannot be executed by an agent: the project forbids browser automation, and real SMTP and WhatsApp traffic must not be generated automatically. The user runs these:

1. **Configure SMTP.** Fill the SMTP vars in `server/.env`, restart the API, then confirm `GET /api/v1/config/features` reports `email: true` and the Email button is enabled.
2. **Download a GST invoice PDF.** Open a GST invoice, click Send invoice, then Download PDF. Confirm the file opens and the totals block, amount in words and HSN breakup table are present and correctly split across pages.
3. **Download a non-GST invoice PDF.** Same flow; confirm no GST columns and a "Tax" line only when tax is non-zero.
4. **Email an invoice.** Send to a real address and confirm arrival with `INV-N.pdf` attached and the public link in the body.
5. **Test the unconfigured path.** Clear `SMTP_HOST`, restart, confirm the Email button is disabled.
6. **WhatsApp.** Send to a real number, open the received link in a private browser window with no session. Confirm the invoice renders and Download PDF works there too.
7. **Undeliverable attachment size.** Temporarily lower the multer cap to 1 KB and confirm the API answers 413 with `Attachment exceeds 5 MB`.
8. **Revoke.** Call `DELETE /invoices/:id/share`, then reload the link and confirm the "no longer available" card.
9. **Cross-tenant.** With two accounts, confirm business B gets 404 on business A's invoice id for email and share.

Report the results; any failure becomes a bug report, not a plan edit.

- [ ] **Step 6: Commit**

```bash
git add docs/API.md README.md
git commit -m "docs: document invoice delivery endpoints and setup"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Covering task |
|---|---|
| §1 goal, chosen approaches | Tasks 6, 7, 8, 9 |
| §2 architecture | Tasks 5, 6, 9 |
| §3 InvoiceDocument extraction + regression guard | Task 5 (guard re-run in Task 8 Step 7) |
| §4.1 `shareToken.js` | Task 1 |
| §4.2 `emailService.js` | Task 2 |
| §4.3 `emailTemplates.js` | Task 2 |
| §4.4 `pdfUpload.js` | Task 3 (verified by Task 4 tests) |
| §5.1 `Sale` fields | Task 1 Step 5 |
| §5.2 `Customer.email` | Task 1 Steps 6, 8 |
| §5.3 Business unchanged | No task, deliberate |
| §5.4 migration | No task, deliberate — defaults cover it |
| §6.1 five endpoints | Task 4 (+ `features` in Task 4 Step 5) |
| §6.2 public projection, key omission | Task 4 Step 3 + the leak assertions in Task 4 Step 1 |
| §6.3 client API layer | Task 7 Step 5 |
| §7.1 download flow | Tasks 6, 8 |
| §7.2 email flow incl. 5 MB pre-check | Tasks 3, 4, 8 |
| §7.3 WhatsApp flow + phone normalisation | Tasks 7, 8 |
| §7.4 public link, rotation, revocation, 30-day TTL, cancelled banner | Tasks 1, 4, 9 |
| §8 error handling table | Tasks 2, 3, 4, 8, 9 |
| §9.1 server tests | Tasks 1, 2, 4 |
| §9.2 client tests | Tasks 5, 6, 7, 8, 9 |
| §9.3 manual acceptance | Task 10 Step 5 |
| §10 out of scope | No task, deliberate |
| §11 dependencies | Tasks 2, 3, 6 |
| §12 env vars | Tasks 1 Step 10, 2 Step 7, 10 Step 1 |

**Placeholder scan:** no `TBD`, no `TODO`, no "similar to Task N", no code step without code. The one deliberately test-free artifact is `pdfUpload.js` (Task 3 Step 2), and it is explicitly justified there and covered by five Supertest cases in Task 4.

**Type consistency:** `buildInvoicePdf(element)` → `Promise<Blob>` is used identically in Tasks 6, 8 and 9. `invoicesApi.sendEmail(id, formData)` / `.share(id)` / `.revokeShare(id)` match between Task 7 and Task 8. `toWhatsAppNumber` / `whatsappUrl` match between Task 7 and Task 8. `InvoiceDocument({ invoice, business, variant })` matches between Tasks 5, 8 and 9. `shareTokenExpiry` / `isTokenExpired` / `shareUrlFor` match between Tasks 1 and 4. `MAX_PDF_BYTES` in Task 6 (client) intentionally mirrors the server's `MAX_PDF_BYTES` in Task 3, and Task 10 Step 5 verifies the server value.

**Known interface note:** Task 8 Step 6 edits `InvoiceDetail.test.jsx`'s `vi.mock` factory to declare `configApi`, because the page now reads the feature flag on mount. No assertion in that file changes, so it remains a valid regression guard for Task 5.
