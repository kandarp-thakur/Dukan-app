# Invoices Section with GST & Non-GST Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Invoices section (list, detail, print, share) that renders both GST and non-GST invoices on the sale-driven model, with per-item GST rates, HSN codes, buyer GSTIN/address snapshots, and CGST/SGST/IGST computed server-side.

**Architecture:** GST fields live on the `Sale` document (`isGst`, `buyerGstin/Name/Address`, `placeOfSupply`, `cgst/sgst/igst`, per-item `gstRate`/`hsn`). The GST split is computed by the sale controller via a shared `utils/gst.js` (the model's `pre('validate')` hook keeps computing line arithmetic and `total = subtotal − discount + tax`). New `/invoices` endpoints are a read model over Sales; the existing `Invoice` collection stays untouched as the history record.

**Tech Stack:** Node.js + Express + Mongoose (server, CommonJS, Jest + Supertest + mongodb-memory-server); React 18 + Vite + Vitest + React Testing Library (client, ESM, glassmorphism UI, lucide-react icons, react-to-print).

**Spec:** `docs/superpowers/specs/2026-09-13-invoices-gst-design.md`

## Global Constraints

- All money values are **integer paise** (₹123.45 = `12345`). Never store floats.
- Every API response uses the envelope `{ success, message, data }`.
- All new server routes use `authenticate` + `tenantScope` and scope every query by `businessId`.
- Response `toJSON` on models renames `_id` → `id` and drops `__v` (already the pattern).
- Conventional commits (`feat:`, `test:`, `docs:`), one commit per task, on branch `feature/foundation`.
- No emoji in UI or copy; use existing lucide-react icons, `.glass*`, `.badge*`, `.btn-*`, `.skeleton`, `.empty-state` CSS classes.
- The printed invoice card must stay `bg-white` with `print:hidden` chrome so print-to-PDF is clean.
- Canonical place-of-supply representation is the **ISO alpha-2 state code** (e.g. `MH`), matching the spec's `placeOfSupply` example. `stateCodeFromGstin()` maps a GSTIN's numeric prefix (`27`) to that alpha code via an internal table.
- Shell is Windows cmd; commands run from repo root `e:/client_projects/acc-app-shubham` unless noted. Chain with `&&`.
- Test commands: server `cd server && npx jest tests/<file>.test.js --runInBand`; client `cd client && npx vitest run <file>`; full suites `npm run test:server` and `npm run test:client`.
- Manual E2E is the only browser verification (user's global rule forbids browser automation). Do not open a browser.

---

### Task 1: Server GST utility

**Files:**
- Create: `server/src/utils/gst.js`
- Test: `server/tests/gst.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (CommonJS exports):
  - `INDIAN_STATES: Record<string,string>` — 37 entries, alpha-2 code → state name.
  - `GST_RATES: number[]` — `[0, 5, 12, 18, 28]`.
  - `stateCodeFromGstin(gstin: string): string` — alpha-2 code or `''`.
  - `isIntraState(businessGstin: string, placeOfSupply: string): boolean`.
  - `lineBreakup(items: {amount:number, gstRate:number}[], discount: number): {taxableValue:number, gstRate:number, tax:number}[]`.
  - `computeGst(items, discount, isGst: boolean, intraState: boolean): { cgst, sgst, igst, tax, taxableValue, lines }` (all money in paise).

- [ ] **Step 1: Write the failing test**

Create `server/tests/gst.test.js`:

```js
const {
    INDIAN_STATES,
    stateCodeFromGstin,
    isIntraState,
    computeGst,
} = require('../src/utils/gst');

describe('gst utils', () => {
    it('mapping a GSTIN to its state code', () => {
        expect(stateCodeFromGstin('27ABCDE1234F1Z5')).toBe('MH');
        expect(stateCodeFromGstin('29ABCDE1234F1Z5')).toBe('KA');
        expect(stateCodeFromGstin('')).toBe('');
        expect(stateCodeFromGstin('ZZ')).toBe('');
    });

    it('detects intra-state supply', () => {
        expect(isIntraState('27ABCDE1234F1Z5', 'MH')).toBe(true);
        expect(isIntraState('27ABCDE1234F1Z5', 'KA')).toBe(false);
        expect(isIntraState('', 'MH')).toBe(false);
    });

    it('lists all Indian state codes', () => {
        expect(Object.keys(INDIAN_STATES)).toHaveLength(37);
        expect(INDIAN_STATES.MH).toBe('Maharashtra');
    });

    it('returns zero GST for a non-GST sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, false, true);
        expect(r).toMatchObject({ cgst: 0, sgst: 0, igst: 0, tax: 0, taxableValue: 11000 });
    });

    it('splits CGST/SGST for an intra-state GST sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, true, true);
        expect(r.cgst).toBe(990);
        expect(r.sgst).toBe(990);
        expect(r.igst).toBe(0);
        expect(r.tax).toBe(1980);
        expect(r.taxableValue).toBe(11000);
    });

    it('charges IGST for an inter-state GST sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, true, false);
        expect(r.igst).toBe(1980);
        expect(r.cgst).toBe(0);
        expect(r.sgst).toBe(0);
        expect(r.tax).toBe(1980);
    });

    it('allocates a sale-level discount across lines before taxing', () => {
        const r = computeGst(
            [
                { amount: 10000, gstRate: 18 },
                { amount: 10000, gstRate: 18 },
            ],
            2000,
            true,
            true
        );
        expect(r.taxableValue).toBe(18000);
        expect(r.tax).toBe(3240);
        expect(r.cgst).toBe(1620);
        expect(r.sgst).toBe(1620);
    });

    it('gives the odd paise remainder to CGST', () => {
        const r = computeGst([{ amount: 10020, gstRate: 5 }], 0, true, true);
        expect(r.tax).toBe(501);
        expect(r.cgst).toBe(251);
        expect(r.sgst).toBe(250);
    });

    it('sums mixed rates across lines', () => {
        const r = computeGst(
            [
                { amount: 10000, gstRate: 18 },
                { amount: 10000, gstRate: 5 },
            ],
            0,
            true,
            true
        );
        expect(r.tax).toBe(2300);
    });

    it('exposes per-line taxable values that sum to the discounted subtotal', () => {
        const r = computeGst(
            [
                { amount: 3333, gstRate: 18 },
                { amount: 3333, gstRate: 18 },
                { amount: 3334, gstRate: 18 },
            ],
            100,
            true,
            true
        );
        const sum = r.lines.reduce((s, l) => s + l.taxableValue, 0);
        expect(sum).toBe(9900);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/gst.test.js --runInBand`
Expected: FAIL — `Cannot find module '../src/utils/gst'`.

- [ ] **Step 3: Write minimal implementation**

Create `server/src/utils/gst.js`:

```js
// GST helpers. All money values are integer paise.
// The canonical place-of-supply value is the ISO alpha-2 state code (e.g. 'MH').

// ISO 3166-2:IN alpha-2 code -> state name. Used for the place-of-supply dropdown.
const INDIAN_STATES = {
    AN: 'Andaman and Nicobar Islands',
    AP: 'Andhra Pradesh',
    AR: 'Arunachal Pradesh',
    AS: 'Assam',
    BR: 'Bihar',
    CH: 'Chandigarh',
    CT: 'Chhattisgarh',
    DN: 'Dadra and Nagar Haveli and Daman and Diu',
    DL: 'Delhi',
    GA: 'Goa',
    GJ: 'Gujarat',
    HR: 'Haryana',
    HP: 'Himachal Pradesh',
    JK: 'Jammu and Kashmir',
    JH: 'Jharkhand',
    KA: 'Karnataka',
    KL: 'Kerala',
    LA: 'Ladakh',
    LD: 'Lakshadweep',
    MP: 'Madhya Pradesh',
    MH: 'Maharashtra',
    MN: 'Manipur',
    ML: 'Meghalaya',
    MZ: 'Mizoram',
    NL: 'Nagaland',
    OR: 'Odisha',
    PY: 'Puducherry',
    PB: 'Punjab',
    RJ: 'Rajasthan',
    SK: 'Sikkim',
    TN: 'Tamil Nadu',
    TG: 'Telangana',
    TR: 'Tripura',
    UP: 'Uttar Pradesh',
    UT: 'Uttarakhand',
    WB: 'West Bengal',
    OT: 'Other Territory',
};

const GST_RATES = [0, 5, 12, 18, 28];

// GSTIN numeric state prefix -> alpha-2 code.
const GST_NUMERIC_TO_ALPHA = {
    '01': 'JK', '02': 'HP', '03': 'PB', '04': 'CH', '05': 'UT', '06': 'HR',
    '07': 'DL', '08': 'RJ', '09': 'UP', '10': 'BR', '11': 'SK', '12': 'AR',
    '13': 'NL', '14': 'MN', '15': 'MZ', '16': 'TR', '17': 'ML', '18': 'AS',
    '19': 'WB', '20': 'JH', '21': 'OR', '22': 'CT', '23': 'MP', '24': 'GJ',
    '26': 'DN', '27': 'MH', '29': 'KA', '30': 'GA', '31': 'LD', '32': 'KL',
    '33': 'TN', '34': 'PY', '35': 'AN', '36': 'TG', '37': 'AP', '38': 'LA',
    '97': 'OT',
};

const stateCodeFromGstin = (gstin) => {
    if (!gstin || gstin.length < 2) return '';
    return GST_NUMERIC_TO_ALPHA[gstin.slice(0, 2)] || '';
};

const isIntraState = (businessGstin, placeOfSupply) => {
    const code = stateCodeFromGstin(businessGstin);
    return Boolean(code) && code === placeOfSupply;
};

// Distributes a sale-level discount across lines proportionally; the last line
// absorbs the rounding remainder so the allocated discounts sum exactly to `discount`.
const allocateDiscounts = (amounts, discount) => {
    const subtotal = amounts.reduce((s, a) => s + a, 0);
    if (!subtotal || !discount) return amounts.map(() => 0);
    const allocations = [];
    let allocated = 0;
    amounts.forEach((amount, i) => {
        if (i === amounts.length - 1) {
            allocations.push(discount - allocated);
        } else {
            const share = Math.round((discount * amount) / subtotal);
            allocations.push(share);
            allocated += share;
        }
    });
    return allocations;
};

// Per-line taxable value and total GST for that line.
const lineBreakup = (items, discount) => {
    const amounts = items.map((it) => it.amount || 0);
    const allocations = allocateDiscounts(amounts, discount || 0);
    return items.map((it, i) => {
        const taxableValue = amounts[i] - allocations[i];
        const gstRate = Number(it.gstRate) || 0;
        const tax = Math.round((taxableValue * gstRate) / 100);
        return { taxableValue, gstRate, tax };
    });
};

const computeGst = (items, discount, isGst, intraState) => {
    const lines = lineBreakup(items, discount);
    const taxableValue = lines.reduce((s, l) => s + l.taxableValue, 0);
    if (!isGst) {
        return { cgst: 0, sgst: 0, igst: 0, tax: 0, taxableValue, lines };
    }
    const gstTotal = lines.reduce((s, l) => s + l.tax, 0);
    if (intraState) {
        const cgst = Math.ceil(gstTotal / 2);
        const sgst = gstTotal - cgst;
        return { cgst, sgst, igst: 0, tax: gstTotal, taxableValue, lines };
    }
    return { cgst: 0, sgst: 0, igst: gstTotal, tax: gstTotal, taxableValue, lines };
};

module.exports = {
    INDIAN_STATES,
    GST_RATES,
    stateCodeFromGstin,
    isIntraState,
    lineBreakup,
    computeGst,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/gst.test.js --runInBand`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/gst.js server/tests/gst.test.js
git commit -m "feat: add GST computation util (state codes, discount allocation, CGST/SGST/IGST split)"
```

---

### Task 2: Sale schema GST fields

**Files:**
- Modify: `server/src/models/Sale.js`
- Test: `server/tests/featureModels.test.js` (add to the `Sale model` describe block)

**Interfaces:**
- Consumes: nothing.
- Produces: `Sale` documents gain `isGst` (Boolean, default `false`), `buyerGstin`/`buyerName`/`buyerAddress`/`placeOfSupply` (String, default `''`), `cgst`/`sgst`/`igst` (Number, default `0`, min 0); each item gains `gstRate` (Number, default `0`, enum `[0,5,12,18,28]`) and `hsn` (String, default `''`). The `pre('validate')` hook still sets `amount`, `subtotal`, and `total = subtotal − discount + tax`.

- [ ] **Step 1: Write the failing test**

Append these two `it(...)` blocks inside the existing `describe('Sale model', ...)` block in `server/tests/featureModels.test.js` (after the existing `it('requires customerId for credit sales...')`):

```js
    it('defaults GST fields for a non-GST sale', async () => {
        const sale = await Sale.create({
            businessId: business._id,
            items: [{ name: 'Pen', qty: 2, rate: 1000 }],
            paymentMethod: 'cash',
        });
        expect(sale.isGst).toBe(false);
        expect(sale.cgst).toBe(0);
        expect(sale.sgst).toBe(0);
        expect(sale.igst).toBe(0);
        expect(sale.buyerName).toBe('');
        expect(sale.buyerGstin).toBe('');
        expect(sale.buyerAddress).toBe('');
        expect(sale.placeOfSupply).toBe('');
        expect(sale.items[0].gstRate).toBe(0);
        expect(sale.items[0].hsn).toBe('');
        expect(sale.total).toBe(2000);
    });

    it('persists GST fields when provided', async () => {
        const sale = await Sale.create({
            businessId: business._id,
            items: [{ name: 'Rice', qty: 2, rate: 5500, gstRate: 18, hsn: '1006' }],
            discount: 0,
            tax: 1980,
            cgst: 990,
            sgst: 990,
            igst: 0,
            isGst: true,
            buyerName: 'Ramesh',
            buyerGstin: '27XYZAB5678C1Z9',
            buyerAddress: 'MG Road, Pune',
            placeOfSupply: 'MH',
            paymentMethod: 'cash',
        });
        expect(sale.isGst).toBe(true);
        expect(sale.cgst).toBe(990);
        expect(sale.sgst).toBe(990);
        expect(sale.total).toBe(11000 + 1980);
        expect(sale.items[0].gstRate).toBe(18);
        expect(sale.items[0].hsn).toBe('1006');
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/featureModels.test.js --runInBand`
Expected: FAIL — `sale.isGst` is `undefined` (field not in schema).

- [ ] **Step 3: Write minimal implementation**

In `server/src/models/Sale.js`, add the two item fields inside `saleItemSchema` (after the `amount` field):

```js
        gstRate: { type: Number, enum: [0, 5, 12, 18, 28], default: 0 },
        hsn: { type: String, default: '' },
```

Add the sale-level fields inside `saleSchema` (after the `tax` field):

```js
        isGst: { type: Boolean, default: false },
        cgst: { type: Number, default: 0, min: 0 },
        sgst: { type: Number, default: 0, min: 0 },
        igst: { type: Number, default: 0, min: 0 },
        buyerGstin: { type: String, default: '' },
        buyerName: { type: String, default: '' },
        buyerAddress: { type: String, default: '' },
        placeOfSupply: { type: String, default: '' },
```

Leave the `pre('validate')` hook unchanged — it still computes `total = subtotal − discount + tax`, and the controller (Task 4) supplies the computed `tax`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/featureModels.test.js --runInBand`
Expected: PASS (all existing model tests plus the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add server/src/models/Sale.js server/tests/featureModels.test.js
git commit -m "feat: add GST fields to Sale schema (per-item rate/HSN, buyer snapshot, CGST/SGST/IGST)"
```

---

### Task 3: Customer gstin & address

**Files:**
- Modify: `server/src/models/Customer.js`
- Modify: `server/src/routes/customerRoutes.js`
- Modify: `server/src/controllers/customerController.js`
- Test: `server/tests/customers.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `Customer` documents gain `gstin` (String, default `''`) and `address` (String, default `''`). `POST /customers` and `PATCH /customers/:id` accept `gstin` (15 chars when present) and `address`. Customer JSON includes `gstin` and `address`.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('Customers API', ...)` block in `server/tests/customers.test.js` (requires `registerBusiness` which the file already defines):

```js
    it('creates and updates a customer with GSTIN and address', async () => {
        const data = await registerBusiness('GST');
        const created = await request(app)
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                name: 'Ramesh Traders',
                phone: '9812345678',
                gstin: '27XYZAB5678C1Z9',
                address: 'MG Road, Pune',
            });
        expect(created.status).toBe(201);
        expect(created.body.data.customer.gstin).toBe('27XYZAB5678C1Z9');
        expect(created.body.data.customer.address).toBe('MG Road, Pune');

        const updated = await request(app)
            .patch(`/api/v1/customers/${created.body.data.customer.id}`)
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ address: 'FC Road, Pune' });
        expect(updated.status).toBe(200);
        expect(updated.body.data.customer.address).toBe('FC Road, Pune');
    });

    it('rejects a short GSTIN', async () => {
        const data = await registerBusiness('GST2');
        const res = await request(app)
            .post('/api/v1/customers')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({ name: 'Ramesh', gstin: '123' });
        expect(res.status).toBe(400);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/customers.test.js --runInBand`
Expected: FAIL — `customer.gstin` is `undefined` and the short-GSTIN request returns 201.

- [ ] **Step 3: Write minimal implementation**

In `server/src/models/Customer.js`, add the two fields (after `phone`):

```js
        gstin: { type: String, default: '' },
        address: { type: String, default: '' },
```

In `server/src/routes/customerRoutes.js`, add GSTIN/address validators to **both** the `POST /` and `PATCH /:id` chains (place them right after the existing `phone` validator in each):

```js
    body('gstin')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 15, max: 15 })
        .withMessage('GSTIN must be 15 characters'),
    body('address').optional({ values: 'falsy' }).trim(),
```

In `server/src/controllers/customerController.js`, update `createCustomer`:

```js
exports.createCustomer = async (req, res) => {
    const { name, phone, gstin, address } = req.body;
    const customer = await Customer.create({
        businessId: req.businessId,
        name,
        phone: phone || '',
        gstin: gstin || '',
        address: address || '',
    });
    return res.status(201).json({ success: true, message: 'Customer created', data: { customer } });
};
```

And update the `allowed` array in `updateCustomer`:

```js
    const allowed = ['name', 'phone', 'gstin', 'address'];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/customers.test.js --runInBand`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/models/Customer.js server/src/routes/customerRoutes.js server/src/controllers/customerController.js server/tests/customers.test.js
git commit -m "feat: add GSTIN and address to customers with 15-char validation"
```

---

### Task 4: GST sale creation on POST /sales

**Files:**
- Modify: `server/src/routes/saleRoutes.js`
- Modify: `server/src/controllers/saleController.js`
- Test: `server/tests/sales.test.js`

**Interfaces:**
- Consumes: `computeGst`, `isIntraState`, `stateCodeFromGstin` from `../utils/gst` (Task 1); Sale GST fields (Task 2); Customer `gstin`/`address` (Task 3).
- Produces: `POST /sales` accepts `isGst`, `items[].gstRate`, `items[].hsn`, `buyerGstin`/`buyerName`/`buyerAddress`, `placeOfSupply`. The controller sets `tax`, `cgst`, `sgst`, `igst`, `isGst`, buyer snapshot fields and `placeOfSupply` on the created sale. `buyerName` is snapshotted from the customer on **every** sale with a `customerId`.

- [ ] **Step 1: Write the failing test**

In `server/tests/sales.test.js`, replace the `createCustomer` helper with a version that accepts GSTIN/address:

```js
const createCustomer = async (token, name = 'Ramesh', gstin = '', address = '') => {
    const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, phone: '9812345678', gstin, address });
    return res.body.data.customer;
};
```

Add this helper next to `createProduct`:

```js
const setBusinessGstin = async (token, gstin) => {
    await request(app)
        .patch('/api/v1/business')
        .set('Authorization', `Bearer ${token}`)
        .send({ gstin });
};
```

Add a new `describe` block at the end of the file:

```js
describe('GST sales', () => {
    it('creates an intra-state GST sale with buyer snapshot and CGST/SGST', async () => {
        const data = await registerBusiness('G1');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const customer = await createCustomer(
            data.accessToken,
            'Ramesh',
            '27XYZAB5678C1Z9',
            'MG Road, Pune'
        );
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 2, rate: 5500, gstRate: 18, hsn: '1006' }],
                isGst: true,
                customerId: customer.id,
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(201);
        const sale = res.body.data.sale;
        expect(sale.isGst).toBe(true);
        expect(sale.tax).toBe(1980);
        expect(sale.cgst).toBe(990);
        expect(sale.sgst).toBe(990);
        expect(sale.igst).toBe(0);
        expect(sale.total).toBe(12980);
        expect(sale.buyerName).toBe('Ramesh');
        expect(sale.buyerGstin).toBe('27XYZAB5678C1Z9');
        expect(sale.buyerAddress).toBe('MG Road, Pune');
        expect(sale.placeOfSupply).toBe('MH');
    });

    it('charges IGST for an inter-state GST sale', async () => {
        const data = await registerBusiness('G2');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 2, rate: 5500, gstRate: 18, hsn: '1006' }],
                isGst: true,
                placeOfSupply: 'KA',
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(201);
        expect(res.body.data.sale.igst).toBe(1980);
        expect(res.body.data.sale.cgst).toBe(0);
        expect(res.body.data.sale.sgst).toBe(0);
    });

    it('rejects a GST sale when the business has no GSTIN', async () => {
        const data = await registerBusiness('G3');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 1, rate: 5500, gstRate: 18, hsn: '1006' }],
                isGst: true,
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/business GSTIN/i);
    });

    it('rejects a taxed item without an HSN code', async () => {
        const data = await registerBusiness('G4');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 1, rate: 5500, gstRate: 18 }],
                isGst: true,
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/HSN/i);
    });

    it('rejects an unsupported GST rate', async () => {
        const data = await registerBusiness('G5');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Rice 1kg', qty: 1, rate: 5500, gstRate: 7, hsn: '1006' }],
                isGst: true,
                paymentMethod: 'cash',
            });
        expect(res.status).toBe(400);
    });

    it('snapshots buyerName on a non-GST sale but keeps zero tax', async () => {
        const data = await registerBusiness('G6');
        const customer = await createCustomer(data.accessToken, 'Suresh');
        const res = await request(app)
            .post('/api/v1/sales')
            .set('Authorization', `Bearer ${data.accessToken}`)
            .send({
                items: [{ name: 'Pen', qty: 2, rate: 1000 }],
                paymentMethod: 'cash',
                customerId: customer.id,
            });
        expect(res.status).toBe(201);
        const sale = res.body.data.sale;
        expect(sale.isGst).toBe(false);
        expect(sale.cgst).toBe(0);
        expect(sale.sgst).toBe(0);
        expect(sale.igst).toBe(0);
        expect(sale.total).toBe(2000);
        expect(sale.buyerName).toBe('Suresh');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/sales.test.js --runInBand`
Expected: FAIL — GST fields are not set; `sale.tax` is `0` instead of `1980`; the no-GSTIN sale returns 201 instead of 400.

- [ ] **Step 3: Write minimal implementation**

In `server/src/routes/saleRoutes.js`, add `INDIAN_STATES` to the requires and add validators inside the `POST /` chain (after the existing `body('tax')` line, before `body('paymentMethod')`):

```js
const { INDIAN_STATES } = require('../utils/gst');
```

```js
    body('items.*.gstRate')
        .optional({ values: 'falsy' })
        .isInt()
        .isIn([0, 5, 12, 18, 28])
        .withMessage('GST rate must be one of 0, 5, 12, 18, 28'),
    body('items.*.hsn').optional({ values: 'falsy' }).trim(),
    body('isGst').optional().isBoolean().withMessage('isGst must be a boolean'),
    body('buyerGstin')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 15, max: 15 })
        .withMessage('GSTIN must be 15 characters'),
    body('buyerName').optional({ values: 'falsy' }).trim(),
    body('buyerAddress').optional({ values: 'falsy' }).trim(),
    body('placeOfSupply')
        .optional({ values: 'falsy' })
        .trim()
        .isIn(Object.keys(INDIAN_STATES))
        .withMessage('Invalid place of supply'),
```

In `server/src/controllers/saleController.js`, add the require at the top:

```js
const { computeGst, isIntraState, stateCodeFromGstin } = require('../utils/gst');
```

Replace the body of `exports.createSale` with this version (keeps stock checks, numbering, khata, Invoice record):

```js
exports.createSale = async (req, res) => {
    const { items, discount, tax, paymentMethod, customerId, date } = req.body;
    const isGst = req.body.isGst === true;

    if (paymentMethod === 'credit' && !customerId) {
        return res
            .status(400)
            .json({ success: false, message: 'Credit sales require a customer (khata)' });
    }

    let customer = null;
    if (customerId) {
        customer = await Customer.findOne({ _id: customerId, businessId: req.businessId });
        if (!customer) {
            return res.status(400).json({ success: false, message: 'Customer not found' });
        }
    }

    // Validate stock for all catalog items before writing anything.
    const productItems = items.filter((item) => item.productId);
    for (const item of productItems) {
        const product = await Product.findOne({
            _id: item.productId,
            businessId: req.businessId,
        });
        if (!product) {
            return res.status(400).json({ success: false, message: `Product not found: ${item.name}` });
        }
        if (product.stockQty < item.qty) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock for ${product.name}: ${product.stockQty} available, ${item.qty} requested`,
            });
        }
    }

    // Atomic per-business invoice numbering (also loads the business for GST rules).
    const business = await Business.findByIdAndUpdate(
        req.businessId,
        { $inc: { invoiceCounter: 1 } },
        { new: true }
    );
    const invoiceNumber = `${business.invoicePrefix}-${business.invoiceCounter}`;

    if (isGst && !business.gstin) {
        return res.status(400).json({ success: false, message: 'GST invoice requires business GSTIN' });
    }
    if (isGst && items.some((it) => Number(it.gstRate) > 0 && !it.hsn)) {
        return res.status(400).json({ success: false, message: 'HSN code is required for taxed items' });
    }

    // Buyer snapshot: name defaults on every sale; GSTIN/address additionally for GST sales.
    let buyerName = req.body.buyerName || '';
    let buyerGstin = req.body.buyerGstin || '';
    let buyerAddress = req.body.buyerAddress || '';
    if (customer) {
        if (!buyerName) buyerName = customer.name || '';
        if (isGst) {
            if (!buyerGstin) buyerGstin = customer.gstin || '';
            if (!buyerAddress) buyerAddress = customer.address || '';
        }
    }

    let placeOfSupply = req.body.placeOfSupply || '';
    if (isGst && !placeOfSupply) {
        placeOfSupply = buyerGstin
            ? stateCodeFromGstin(buyerGstin)
            : stateCodeFromGstin(business.gstin);
    }

    const gst = computeGst(
        items.map((it) => ({ amount: it.qty * it.rate, gstRate: Number(it.gstRate) || 0 })),
        discount || 0,
        isGst,
        isIntraState(business.gstin, placeOfSupply)
    );

    const sale = await Sale.create({
        businessId: req.businessId,
        items,
        discount: discount || 0,
        tax: isGst ? gst.tax : tax || 0,
        cgst: gst.cgst,
        sgst: gst.sgst,
        igst: gst.igst,
        isGst,
        buyerName,
        buyerGstin,
        buyerAddress,
        placeOfSupply,
        paymentMethod,
        customerId: customerId || null,
        invoiceNumber,
        date: date || undefined,
    });

    // Decrement stock for catalog items.
    for (const item of productItems) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stockQty: -item.qty } });
    }

    // Credit sale: record the receivable in khata.
    if (paymentMethod === 'credit' && customerId) {
        await KhataEntry.create({
            businessId: req.businessId,
            customerId,
            type: 'credit',
            amount: sale.total,
            saleId: sale._id,
            note: `Sale ${invoiceNumber}`,
        });
        await recomputeBalance(req.businessId, customerId);
    }

    await Invoice.create({
        businessId: req.businessId,
        saleId: sale._id,
        invoiceNumber,
    });

    return res.status(201).json({
        success: true,
        message: 'Sale created',
        data: { sale },
    });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/sales.test.js --runInBand`
Expected: PASS (existing sales + expenses tests plus 6 new GST tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/saleRoutes.js server/src/controllers/saleController.js server/tests/sales.test.js
git commit -m "feat: compute GST and snapshot buyer on sale creation"
```

---

### Task 5: Invoice read endpoints

**Files:**
- Create: `server/src/controllers/invoiceController.js`
- Create: `server/src/routes/invoiceRoutes.js`
- Modify: `server/src/routes/index.js`
- Test: `server/tests/invoices.test.js`

**Interfaces:**
- Consumes: `Sale` (Task 2), `Business` model.
- Produces:
  - `GET /invoices?q=&type=&from=&to=` → `{ invoices }`, each `{ id, invoiceNumber, date, buyerName, total, isGst, status }`, sorted `date` desc. `q` matches `invoiceNumber` or `buyerName` (case-insensitive regex); `type` is `gst` | `non-gst`; `from`/`to` are ISO dates. `to < from` → 400 `"'to' must be after 'from'"`.
  - `GET /invoices/:id` → `{ invoice, business }` where `invoice` is the full sale and `business` is `{ name, address, gstin }`.

- [ ] **Step 1: Write the failing test**

Create `server/tests/invoices.test.js`:

```js
const request = require('supertest');
const app = require('../src/app');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
    const res = await request(app).post('/api/v1/auth/register').send({
        businessName: `Invoice Shop ${suffix}`,
        name: `Owner ${suffix}`,
        email: `iowner${suffix}@test.com`,
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

describe('Invoices API', () => {
    it('lists invoices with search, type filter and date range', async () => {
        const data = await registerBusiness('A');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        await createSale(data.accessToken, {
            items: [{ name: 'Rice', qty: 1, rate: 10000, gstRate: 18, hsn: '1006' }],
            isGst: true,
            buyerName: 'Ramesh',
            paymentMethod: 'cash',
            date: '2026-09-01T10:00:00.000Z',
        });
        await createSale(data.accessToken, {
            items: [{ name: 'Pen', qty: 2, rate: 500 }],
            buyerName: 'Suresh',
            paymentMethod: 'cash',
            date: '2026-09-10T10:00:00.000Z',
        });

        const all = await request(app).get('/api/v1/invoices').set(auth(data.accessToken));
        expect(all.status).toBe(200);
        expect(all.body.data.invoices).toHaveLength(2);
        expect(all.body.data.invoices[0].invoiceNumber).toBe('INV-2');
        expect(all.body.data.invoices[0].isGst).toBe(false);

        const gstOnly = await request(app)
            .get('/api/v1/invoices?type=gst')
            .set(auth(data.accessToken));
        expect(gstOnly.body.data.invoices).toHaveLength(1);
        expect(gstOnly.body.data.invoices[0].isGst).toBe(true);

        const byBuyer = await request(app)
            .get('/api/v1/invoices?q=suresh')
            .set(auth(data.accessToken));
        expect(byBuyer.body.data.invoices).toHaveLength(1);
        expect(byBuyer.body.data.invoices[0].buyerName).toBe('Suresh');

        const byNumber = await request(app)
            .get('/api/v1/invoices?q=INV-1')
            .set(auth(data.accessToken));
        expect(byNumber.body.data.invoices).toHaveLength(1);

        const ranged = await request(app)
            .get('/api/v1/invoices?from=2026-09-05T00:00:00.000Z&to=2026-09-30T00:00:00.000Z')
            .set(auth(data.accessToken));
        expect(ranged.body.data.invoices).toHaveLength(1);
        expect(ranged.body.data.invoices[0].invoiceNumber).toBe('INV-2');
    });

    it('rejects a range where to is before from', async () => {
        const data = await registerBusiness('B');
        const res = await request(app)
            .get('/api/v1/invoices?from=2026-09-10T00:00:00.000Z&to=2026-09-01T00:00:00.000Z')
            .set(auth(data.accessToken));
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("'to' must be after 'from'");
    });

    it('returns a single invoice with a business snapshot', async () => {
        const data = await registerBusiness('C');
        await setBusinessGstin(data.accessToken, '27ABCDE1234F1Z5');
        const sale = await createSale(data.accessToken, {
            items: [{ name: 'Rice', qty: 1, rate: 10000, gstRate: 18, hsn: '1006' }],
            isGst: true,
            paymentMethod: 'cash',
        });
        const res = await request(app)
            .get(`/api/v1/invoices/${sale.id}`)
            .set(auth(data.accessToken));
        expect(res.status).toBe(200);
        expect(res.body.data.invoice.invoiceNumber).toBe('INV-1');
        expect(res.body.data.invoice.cgst).toBe(900);
        expect(res.body.data.business.gstin).toBe('27ABCDE1234F1Z5');
    });

    it('keeps invoices tenant-scoped', async () => {
        const dataA = await registerBusiness('D');
        const dataB = await registerBusiness('E');
        const sale = await createSale(dataA.accessToken, {
            items: [{ name: 'Pen', qty: 1, rate: 1000 }],
            paymentMethod: 'cash',
        });
        const list = await request(app).get('/api/v1/invoices').set(auth(dataB.accessToken));
        expect(list.body.data.invoices).toHaveLength(0);
        const get = await request(app)
            .get(`/api/v1/invoices/${sale.id}`)
            .set(auth(dataB.accessToken));
        expect(get.status).toBe(404);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/invoices.test.js --runInBand`
Expected: FAIL — `Cannot find module '../src/controllers/invoiceController'` (route not mounted; requests 404).

- [ ] **Step 3: Write minimal implementation**

Create `server/src/controllers/invoiceController.js`:

```js
const Sale = require('../models/Sale');
const Business = require('../models/Business');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.listInvoices = async (req, res) => {
    const { q, type, from, to } = req.query;

    if (from && to && new Date(to) < new Date(from)) {
        return res.status(400).json({ success: false, message: "'to' must be after 'from'" });
    }

    const filter = { businessId: req.businessId, invoiceNumber: { $ne: '' } };
    if (q) {
        const rx = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ invoiceNumber: rx }, { buyerName: rx }];
    }
    if (type === 'gst') filter.isGst = true;
    else if (type === 'non-gst') filter.isGst = false;
    if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to) filter.date.$lte = new Date(to);
    }

    const sales = await Sale.find(filter).sort({ date: -1, createdAt: -1 });
    const invoices = sales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        date: s.date,
        buyerName: s.buyerName,
        total: s.total,
        isGst: s.isGst,
        status: s.status,
    }));
    return res.json({ success: true, message: 'OK', data: { invoices } });
};

exports.getInvoice = async (req, res) => {
    const sale = await Sale.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!sale) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const business = await Business.findById(req.businessId);
    const snapshot = business
        ? { name: business.name, address: business.address, gstin: business.gstin }
        : null;
    return res.json({
        success: true,
        message: 'OK',
        data: { invoice: sale.toJSON(), business: snapshot },
    });
};
```

Create `server/src/routes/invoiceRoutes.js`:

```js
const express = require('express');
const { query } = require('express-validator');
const invoiceController = require('../controllers/invoiceController');
const { authenticate, tenantScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

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

router.get('/:id', authenticate, tenantScope, invoiceController.getInvoice);

module.exports = router;
```

In `server/src/routes/index.js`, add the mount after the `/sales` line:

```js
router.use('/invoices', require('./invoiceRoutes'));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/invoices.test.js --runInBand`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/invoiceController.js server/src/routes/invoiceRoutes.js server/src/routes/index.js server/tests/invoices.test.js
git commit -m "feat: add invoice list and detail read endpoints"
```

---

### Task 6: Client GST utility mirror

**Files:**
- Create: `client/src/utils/gst.js`
- Test: `client/src/utils/gst.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (ESM exports) identical in behaviour to the server util (Task 1): `INDIAN_STATES`, `GST_RATES`, `stateCodeFromGstin`, `isIntraState`, `lineBreakup`, `computeGst`.

- [ ] **Step 1: Write the failing test**

Create `client/src/utils/gst.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { INDIAN_STATES, stateCodeFromGstin, isIntraState, computeGst } from './gst';

describe('gst utils (client)', () => {
    it('maps a GSTIN to its alpha-2 state code', () => {
        expect(stateCodeFromGstin('27ABCDE1234F1Z5')).toBe('MH');
        expect(stateCodeFromGstin('')).toBe('');
    });

    it('detects intra-state supply', () => {
        expect(isIntraState('27ABCDE1234F1Z5', 'MH')).toBe(true);
        expect(isIntraState('27ABCDE1234F1Z5', 'KA')).toBe(false);
    });

    it('lists 37 state codes', () => {
        expect(Object.keys(INDIAN_STATES)).toHaveLength(37);
    });

    it('splits CGST/SGST for an intra-state sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, true, true);
        expect(r.cgst).toBe(990);
        expect(r.sgst).toBe(990);
        expect(r.tax).toBe(1980);
    });

    it('charges IGST for an inter-state sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, true, false);
        expect(r.igst).toBe(1980);
        expect(r.cgst).toBe(0);
    });

    it('returns zero GST when the sale is not a GST sale', () => {
        const r = computeGst([{ amount: 2000, gstRate: 0 }], 0, false, true);
        expect(r.tax).toBe(0);
        expect(r.taxableValue).toBe(2000);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/utils/gst.test.js`
Expected: FAIL — cannot resolve `./gst`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/utils/gst.js` (same logic as the server, ESM syntax):

```js
// GST helpers. All money values are integer paise.
// The canonical place-of-supply value is the ISO alpha-2 state code (e.g. 'MH').

export const INDIAN_STATES = {
    AN: 'Andaman and Nicobar Islands',
    AP: 'Andhra Pradesh',
    AR: 'Arunachal Pradesh',
    AS: 'Assam',
    BR: 'Bihar',
    CH: 'Chandigarh',
    CT: 'Chhattisgarh',
    DN: 'Dadra and Nagar Haveli and Daman and Diu',
    DL: 'Delhi',
    GA: 'Goa',
    GJ: 'Gujarat',
    HR: 'Haryana',
    HP: 'Himachal Pradesh',
    JK: 'Jammu and Kashmir',
    JH: 'Jharkhand',
    KA: 'Karnataka',
    KL: 'Kerala',
    LA: 'Ladakh',
    LD: 'Lakshadweep',
    MP: 'Madhya Pradesh',
    MH: 'Maharashtra',
    MN: 'Manipur',
    ML: 'Meghalaya',
    MZ: 'Mizoram',
    NL: 'Nagaland',
    OR: 'Odisha',
    PY: 'Puducherry',
    PB: 'Punjab',
    RJ: 'Rajasthan',
    SK: 'Sikkim',
    TN: 'Tamil Nadu',
    TG: 'Telangana',
    TR: 'Tripura',
    UP: 'Uttar Pradesh',
    UT: 'Uttarakhand',
    WB: 'West Bengal',
    OT: 'Other Territory',
};

export const GST_RATES = [0, 5, 12, 18, 28];

const GST_NUMERIC_TO_ALPHA = {
  '01': 'JK', '02': 'HP', '03': 'PB', '04': 'CH', '05': 'UT', '06': 'HR',
  '07': 'DL', '08': 'RJ', '09': 'UP', '10': 'BR', '11': 'SK', '12': 'AR',
  '13': 'NL', '14': 'MN', '15': 'MZ', '16': 'TR', '17': 'ML', '18': 'AS',
  '19': 'WB', '20': 'JH', '21': 'OR', '22': 'CT', '23': 'MP', '24': 'GJ',
  '26': 'DN', '27': 'MH', '29': 'KA', '30': 'GA', '31': 'LD', '32': 'KL',
  '33': 'TN', '34': 'PY', '35': 'AN', '36': 'TG', '37': 'AP', '38': 'LA',
  '97': 'OT',
};

export const stateCodeFromGstin = (gstin) => {
  if (!gstin || gstin.length < 2) return '';
  return GST_NUMERIC_TO_ALPHA[gstin.slice(0, 2)] || '';
};

export const isIntraState = (businessGstin, placeOfSupply) => {
  const code = stateCodeFromGstin(businessGstin);
  return Boolean(code) && code === placeOfSupply;
};

const allocateDiscounts = (amounts, discount) => {
  const subtotal = amounts.reduce((s, a) => s + a, 0);
  if (!subtotal || !discount) return amounts.map(() => 0);
  const allocations = [];
  let allocated = 0;
  amounts.forEach((amount, i) => {
    if (i === amounts.length - 1) {
      allocations.push(discount - allocated);
    } else {
      const share = Math.round((discount * amount) / subtotal);
      allocations.push(share);
      allocated += share;
    }
  });
  return allocations;
};

// Per-line taxable value and total GST for that line.
export const lineBreakup = (items, discount) => {
  const amounts = items.map((it) => it.amount || 0);
  const allocations = allocateDiscounts(amounts, discount || 0);
  return items.map((it, i) => {
    const taxableValue = amounts[i] - allocations[i];
    const gstRate = Number(it.gstRate) || 0;
    const tax = Math.round((taxableValue * gstRate) / 100);
    return { taxableValue, gstRate, tax };
  });
};

export const computeGst = (items, discount, isGst, intraState) => {
  const lines = lineBreakup(items, discount);
  const taxableValue = lines.reduce((s, l) => s + l.taxableValue, 0);
  if (!isGst) {
    return { cgst: 0, sgst: 0, igst: 0, tax: 0, taxableValue, lines };
  }
  const gstTotal = lines.reduce((s, l) => s + l.tax, 0);
  if (intraState) {
    const cgst = Math.ceil(gstTotal / 2);
    const sgst = gstTotal - cgst;
    return { cgst, sgst, igst: 0, tax: gstTotal, taxableValue, lines };
  }
  return { cgst: 0, sgst: 0, igst: gstTotal, tax: gstTotal, taxableValue, lines };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/utils/gst.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/gst.js client/src/utils/gst.test.js
git commit -m "feat: add client GST util mirroring the server"
```

---

### Task 7: Client invoices API

**Files:**
- Modify: `client/src/api/endpoints.js`
- Test: `client/src/api/endpoints.test.js`

**Interfaces:**
- Consumes: `unwrap` and `api` (already in the file).
- Produces: `invoicesApi = { list(params), get(id) }` where `list` calls `api.get('/invoices', { params })` and `get` calls `api.get('/invoices/:id')`.

- [ ] **Step 1: Write the failing test**

In `client/src/api/endpoints.test.js`, add `invoicesApi` to the import list from `./endpoints`, then add these two tests inside `describe('api endpoints', ...)`:

```js
    it('invoicesApi.list passes filter params', async () => {
        api.get.mockResolvedValue(envelope({ invoices: [] }));
        await invoicesApi.list({ type: 'gst', q: 'INV-1' });
        expect(api.get).toHaveBeenCalledWith('/invoices', { params: { type: 'gst', q: 'INV-1' } });
    });

    it('invoicesApi.get builds the nested URL', async () => {
        api.get.mockResolvedValue(envelope({ invoice: {}, business: {} }));
        await invoicesApi.get('abc123');
        expect(api.get).toHaveBeenCalledWith('/invoices/abc123');
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/api/endpoints.test.js`
Expected: FAIL — `invoicesApi` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `client/src/api/endpoints.js`, add after the `salesApi` block:

```js
// ---------- Invoices ----------
export const invoicesApi = {
    list: (params) => unwrap(api.get('/invoices', { params })),
    get: (id) => unwrap(api.get(`/invoices/${id}`)),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/api/endpoints.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/api/endpoints.js client/src/api/endpoints.test.js
git commit -m "feat: add invoices API client methods"
```

---

### Task 8: Invoices nav item and routes

**Files:**
- Modify: `client/src/components/AppShell.jsx`
- Modify: `client/src/App.jsx`
- Test: `client/src/components/AppShell.test.jsx`

**Interfaces:**
- Consumes: `Invoices` and `InvoiceDetail` pages (Tasks 9 and 10 — created in those tasks; this task adds the route wiring, so its client test only covers the nav item).
- Produces: nav item `{ to: '/invoices', label: 'Invoices', icon: FileText }` after Sales, visible to all roles. Routes `/invoices` and `/invoices/:id`.

- [ ] **Step 1: Write the failing test**

In `client/src/components/AppShell.test.jsx`, add one assertion to the `it('shows all nav items for owner', ...)` test (right after the `Sales` assertion):

```js
    expect(screen.getByText('Invoices')).toBeInTheDocument();
```

And in `it('hides owner-only nav items for staff', ...)`, add after the `Sales` assertion:

```js
    expect(within(nav).getByText('Invoices')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/components/AppShell.test.jsx`
Expected: FAIL — `Unable to find an element with the text: Invoices`.

- [ ] **Step 3: Write minimal implementation**

In `client/src/components/AppShell.jsx`, add `FileText` to the lucide import list, and add the nav entry after the Sales line:

```js
import {
  Store,
  LayoutDashboard,
  Receipt,
  FileText,
  Wallet,
  Users,
  Truck,
  Package,
  BarChart3,
  UserCog,
  Settings,
  Crown,
  LogOut,
} from 'lucide-react';
```

```js
  { to: '/invoices', label: 'Invoices', icon: FileText },
```

In `client/src/App.jsx`, add the imports and routes:

```js
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
```

```jsx
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
```

(Place both routes right after the `/sales/:id` route.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/components/AppShell.test.jsx`
Expected: PASS. (The `Invoices`/`InvoiceDetail` pages do not exist yet; this task's test file does not import `App.jsx`, so it still passes. Create the pages in Tasks 9–10 before running the full client suite.)

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AppShell.jsx client/src/App.jsx client/src/components/AppShell.test.jsx
git commit -m "feat: add Invoices nav item and routes"
```

---

### Task 9: Invoices list page

**Files:**
- Create: `client/src/pages/Invoices.jsx`
- Test: `client/src/pages/Invoices.test.jsx`

**Interfaces:**
- Consumes: `invoicesApi.list(params)` (Task 7); `formatINR` from `../utils/money`; `formatDate` from `../utils/format`.
- Produces: default-exported `Invoices` page component with a filter bar (`InvoiceSearch` label "Search", `Invoice type` select, `From` / `To` date inputs), a `.glass-table` of rows (Invoice #, Date, Buyer, Type badge, Total, Status), skeleton/empty/error states, and row links to `/invoices/:id`.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/Invoices.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Invoices from './Invoices';
import { invoicesApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    invoicesApi: {
        list: vi.fn(),
        get: vi.fn(),
    },
}));

const gst = {
    id: 'i1',
    invoiceNumber: 'INV-1',
    date: '2026-09-01T10:00:00.000Z',
    buyerName: 'Ramesh',
    total: 12980,
    isGst: true,
    status: 'completed',
};
const nonGst = {
    id: 'i2',
    invoiceNumber: 'INV-2',
    date: '2026-09-10T10:00:00.000Z',
    buyerName: 'Suresh',
    total: 1000,
    isGst: false,
    status: 'completed',
};

const renderPage = () =>
    render(
        <MemoryRouter>
            <Invoices />
        </MemoryRouter>
    );

describe('Invoices page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invoicesApi.list.mockResolvedValue({ invoices: [gst, nonGst] });
    });

    it('renders invoice rows with type badges', async () => {
        renderPage();
        expect(await screen.findByText('INV-1')).toBeInTheDocument();
        expect(screen.getByText('Ramesh')).toBeInTheDocument();
        expect(screen.getByText('₹129.80')).toBeInTheDocument();
        expect(screen.getByText('GST')).toBeInTheDocument();
        expect(screen.getByText('Non-GST')).toBeInTheDocument();
    });

    it('links each row to the invoice detail page', async () => {
        renderPage();
        const link = await screen.findByRole('link', { name: 'INV-1' });
        expect(link).toHaveAttribute('href', '/invoices/i1');
    });

    it('re-queries with the type filter', async () => {
        renderPage();
        await screen.findByText('INV-1');
        fireEvent.change(screen.getByLabelText('Invoice type'), { target: { value: 'gst' } });
        await waitFor(() =>
            expect(invoicesApi.list).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'gst' })
            )
        );
    });

    it('shows the empty state', async () => {
        invoicesApi.list.mockResolvedValue({ invoices: [] });
        renderPage();
        expect(await screen.findByText(/no invoices yet/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/Invoices.test.jsx`
Expected: FAIL — cannot resolve `./Invoices`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/pages/Invoices.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoicesApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import { formatDate } from '../utils/format';
import { FileText } from 'lucide-react';

export default function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [q, setQ] = useState('');
    const [type, setType] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');

    // Debounce the free-text search so we don't query on every keystroke.
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedQ(q.trim()), 300);
        return () => clearTimeout(handle);
    }, [q]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const params = {};
            if (debouncedQ) params.q = debouncedQ;
            if (type) params.type = type;
            if (from) params.from = new Date(from).toISOString();
            if (to) params.to = new Date(to).toISOString();
            try {
                const data = await invoicesApi.list(params);
                if (!cancelled) {
                    setInvoices(data.invoices);
                    setError('');
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load invoices');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [debouncedQ, type, from, to]);

    return (
        <div className="space-y-6">
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <FileText size={24} className="text-primary" />
                </span>
                Invoices
            </h1>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="glass flex flex-wrap items-end gap-4 p-6">
                <label className="block min-w-48 flex-1 text-sm font-medium">
                    Search
                    <input
                        className="glass-input mt-1"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Invoice number or buyer"
                    />
                </label>
                <label className="block w-40 text-sm font-medium">
                    Invoice type
                    <select
                        className="glass-input mt-1"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                    >
                        <option value="">All</option>
                        <option value="gst">GST</option>
                        <option value="non-gst">Non-GST</option>
                    </select>
                </label>
                <label className="block w-40 text-sm font-medium">
                    From
                    <input
                        type="date"
                        className="glass-input mt-1"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                </label>
                <label className="block w-40 text-sm font-medium">
                    To
                    <input
                        type="date"
                        className="glass-input mt-1"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                    />
                </label>
            </div>
            <div className="glass overflow-x-auto p-6">
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <FileText size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No invoices yet</p>
                        <p className="text-sm text-gray-500">Invoices appear here as you record sales.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th>Buyer</th>
                                <th>Type</th>
                                <th className="text-right">Total</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((inv) => (
                                <tr key={inv.id}>
                                    <td className="font-medium">
                                        <Link
                                            to={`/invoices/${inv.id}`}
                                            className="text-primary hover:underline"
                                        >
                                            {inv.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="text-gray-500">{formatDate(inv.date)}</td>
                                    <td className="text-gray-500">{inv.buyerName || '—'}</td>
                                    <td>
                                        <span
                                            className={`badge ${inv.isGst ? 'badge-success' : 'badge-neutral'}`}
                                        >
                                            {inv.isGst ? 'GST' : 'Non-GST'}
                                        </span>
                                    </td>
                                    <td className="text-right font-semibold">
                                        {formatINR(inv.total)}
                                    </td>
                                    <td>
                                        <span
                                            className={`badge ${inv.status === 'cancelled' ? 'badge-danger' : 'badge-success'}`}
                                        >
                                            {inv.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/Invoices.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Invoices.jsx client/src/pages/Invoices.test.jsx
git commit -m "feat: add invoices list page with search, type filter and date range"
```

---

### Task 10: Invoice detail page

**Files:**
- Create: `client/src/pages/InvoiceDetail.jsx`
- Test: `client/src/pages/InvoiceDetail.test.jsx`

**Interfaces:**
- Consumes: `invoicesApi.get(id)` → `{ invoice, business }` (Task 7); `lineBreakup` from `../utils/gst` (Task 6); `formatINR`, `amountToWords` from `../utils/money`; `formatDate` from `../utils/format`; `useReactToPrint`.
- Produces: default-exported `InvoiceDetail` page rendering a print-optimized white invoice card. GST invoices show a buyer block (name, address, GSTIN), a "Place of Supply" line, HSN + GST-rate columns in the items table, an HSN-wise tax breakup table, and CGST/SGST/IGST lines in the totals. Non-GST invoices render the existing layout. Actions: "Print invoice" and "Share" (Web Share API with clipboard fallback).

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/InvoiceDetail.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvoiceDetail from './InvoiceDetail';
import { invoicesApi } from '../api/endpoints';

vi.mock('../api/endpoints', () => ({
    invoicesApi: {
        list: vi.fn(),
        get: vi.fn(),
    },
}));

vi.mock('react-to-print', () => ({
    useReactToPrint: () => vi.fn(),
}));

const business = { name: 'Local Test Shop', address: 'Main Road, Pune', gstin: '27ABCDE1234F1Z5' };

const gstInvoice = {
    id: 'i1',
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
    paymentMethod: 'cash',
    status: 'completed',
};

const nonGstInvoice = {
    id: 'i2',
    invoiceNumber: 'INV-2',
    date: '2026-09-06T10:30:00.000Z',
    items: [{ name: 'Pen', qty: 2, rate: 500, amount: 1000 }],
    subtotal: 1000,
    discount: 0,
    tax: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 1000,
    isGst: false,
    buyerName: 'Suresh',
    buyerGstin: '',
    buyerAddress: '',
    placeOfSupply: '',
    paymentMethod: 'cash',
    status: 'completed',
};

const renderDetail = () =>
    render(
        <MemoryRouter initialEntries={['/invoices/i1']}>
            <Routes>
                <Route path="/invoices/:id" element={<InvoiceDetail />} />
            </Routes>
        </MemoryRouter>
    );

describe('InvoiceDetail page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a GST invoice with buyer block, HSN breakup and tax lines', async () => {
        invoicesApi.get.mockResolvedValue({ invoice: gstInvoice, business });
        renderDetail();
        expect(await screen.findByText('INV-9')).toBeInTheDocument();
        expect(screen.getByText(/27XYZAB5678C1Z9/)).toBeInTheDocument();
        expect(screen.getByText(/place of supply/i)).toBeInTheDocument();
        expect(screen.getByText('1006')).toBeInTheDocument();
        expect(screen.getByText('CGST')).toBeInTheDocument();
        expect(screen.getByText('SGST')).toBeInTheDocument();
        expect(screen.getByText(/one hundred twenty nine rupees only/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /print invoice/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    });

    it('renders a non-GST invoice without GST lines', async () => {
        invoicesApi.get.mockResolvedValue({ invoice: nonGstInvoice, business });
        renderDetail();
        expect(await screen.findByText('INV-2')).toBeInTheDocument();
        expect(screen.queryByText('CGST')).toBeNull();
        expect(screen.getByText(/ten rupees only/i)).toBeInTheDocument();
    });

    it('falls back to clipboard copy when Web Share is unavailable', async () => {
        invoicesApi.get.mockResolvedValue({ invoice: nonGstInvoice, business });
        navigator.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
        delete navigator.share;
        renderDetail();
        await screen.findByText('INV-2');
        fireEvent.click(screen.getByRole('button', { name: /share/i }));
        await waitFor(() =>
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                expect.stringContaining('INV-2')
            )
        );
        expect(await screen.findByText(/link copied/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/InvoiceDetail.test.jsx`
Expected: FAIL — cannot resolve `./InvoiceDetail`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/pages/InvoiceDetail.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { invoicesApi } from '../api/endpoints';
import { formatINR, amountToWords } from '../utils/money';
import { formatDate } from '../utils/format';
import { lineBreakup } from '../utils/gst';
import { FileText } from 'lucide-react';

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

export default function InvoiceDetail() {
    const { id } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [business, setBusiness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const printRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await invoicesApi.get(id);
                if (!cancelled) {
                    setInvoice(data.invoice);
                    setBusiness(data.business);
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load invoice');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: invoice ? `${invoice.invoiceNumber} - ${business?.name || 'Invoice'}` : 'Invoice',
    });

    const handleShare = async () => {
        if (!invoice) return;
        const summary = `${invoice.invoiceNumber} · ${formatINR(invoice.total)}`;
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: invoice.invoiceNumber, text: summary, url });
                return;
            }
            await navigator.clipboard.writeText(`${summary} ${url}`);
            setNotice('Link copied');
        } catch {
            setNotice('Could not share');
        }
    };

    const breakup = invoice && invoice.isGst ? buildBreakup(invoice) : [];
    const interState = invoice && invoice.isGst ? invoice.igst > 0 : false;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between print:hidden">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <FileText size={24} className="text-primary" />
                    </span>
                    Invoice
                </h1>
                <div className="flex items-center gap-4">
                    <Link to="/invoices" className="text-sm font-semibold text-primary hover:underline">
                        ← Back to invoices
                    </Link>
                    {invoice && (
                        <>
                            <button onClick={handleShare} className="btn-ghost">
                                Share
                            </button>
                            <button onClick={handlePrint} className="btn-primary">
                                Print invoice
                            </button>
                        </>
                    )}
                </div>
            </div>
            {notice && (
                <div className="glass px-4 py-3 text-sm font-medium text-primary print:hidden">
                    {notice}
                </div>
            )}
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            {loading ? (
                <div className="glass mx-auto max-w-3xl p-10">
                    <div className="skeleton h-8 w-48" />
                    <div className="skeleton mt-6 h-40" />
                </div>
            ) : (
                invoice && (
                    <div ref={printRef} className="glass mx-auto max-w-3xl bg-white p-10 print:p-0">
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
                )
            )}
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/InvoiceDetail.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/InvoiceDetail.jsx client/src/pages/InvoiceDetail.test.jsx
git commit -m "feat: add GST and non-GST invoice detail page with print and share"
```

---

### Task 11: Sale form GST fields

**Files:**
- Modify: `client/src/pages/Sales.jsx`
- Test: `client/src/pages/Sales.test.jsx`

**Interfaces:**
- Consumes: `computeGst`, `isIntraState`, `stateCodeFromGstin`, `INDIAN_STATES`, `GST_RATES` from `../utils/gst` (Task 6); `useAuth` from `../context/AuthContext`; `customersApi` (already imported).
- Produces: the sale form gains a GST/Non-GST segmented toggle, an item `GST rate` select and `HSN code` input (shown only in GST mode), editable buyer name/GSTIN/address auto-filled from the selected customer, a `placeOfSupply` select auto-derived from the buyer/business GSTIN, and a live tax preview. The flat "Tax (₹)" input is removed. `POST /sales` payload now sends `isGst` and per-item `gstRate` (and `hsn`/buyer fields/`placeOfSupply` in GST mode).

- [ ] **Step 1: Write the failing test**

In `client/src/pages/Sales.test.jsx`, replace the two existing `expect(salesApi.create).toHaveBeenCalledWith({...})` blocks (in `creates a cash sale...` and `creates a credit sale...`) with the new payload shape:

```js
        await waitFor(() =>
            expect(salesApi.create).toHaveBeenCalledWith({
                items: [{ name: 'Parle-G Biscuit', qty: 2, rate: 700, gstRate: 0 }],
                discount: 0,
                isGst: false,
                paymentMethod: 'cash',
            })
        );
```

```js
        await waitFor(() =>
            expect(salesApi.create).toHaveBeenCalledWith({
                items: [{ name: 'Parle-G Biscuit', qty: 1, rate: 700, gstRate: 0 }],
                discount: 0,
                isGst: false,
                paymentMethod: 'credit',
                customerId: 'c1',
            })
        );
```

Add this test after `creates a credit sale with the selected customer`:

```js
    it('creates a GST sale with rate, HSN and derived place of supply', async () => {
        salesApi.create.mockResolvedValue({ sale });
        render(
            <MemoryRouter>
                <Sales />
            </MemoryRouter>
        );
        await screen.findByText('INV-1');
        fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Rice' } });
        fireEvent.change(screen.getByLabelText('Qty'), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText('Rate (₹)'), { target: { value: '100' } });
        fireEvent.click(screen.getByRole('button', { name: 'GST invoice' }));
        fireEvent.change(screen.getByLabelText('GST rate'), { target: { value: '18' } });
        fireEvent.change(screen.getByLabelText('HSN code'), { target: { value: '1006' } });
        fireEvent.click(screen.getByRole('button', { name: /record sale/i }));
        await waitFor(() =>
            expect(salesApi.create).toHaveBeenCalledWith({
                items: [{ name: 'Rice', qty: 1, rate: 10000, gstRate: 18, hsn: '1006' }],
                discount: 0,
                isGst: true,
                paymentMethod: 'cash',
                placeOfSupply: 'MH',
            })
        );
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/Sales.test.jsx`
Expected: FAIL — payload still includes `tax` and lacks `gstRate`/`isGst`.

- [ ] **Step 3: Write minimal implementation**

Replace `client/src/pages/Sales.jsx` with the full file below:

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesApi, customersApi } from '../api/endpoints';
import { formatINR, rupeesToPaise } from '../utils/money';
import { formatDate } from '../utils/format';
import { computeGst, isIntraState, stateCodeFromGstin, INDIAN_STATES, GST_RATES } from '../utils/gst';
import { useAuth } from '../context/AuthContext';
import { Receipt } from 'lucide-react';

const EMPTY_ITEM = { name: '', qty: '', rate: '', gstRate: 0, hsn: '' };

export default function Sales() {
    const { business } = useAuth();
    const [sales, setSales] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState(EMPTY_ITEM);
    const [discount, setDiscount] = useState('');
    const [isGst, setIsGst] = useState(false);
    const [buyerName, setBuyerName] = useState('');
    const [buyerGstin, setBuyerGstin] = useState('');
    const [buyerAddress, setBuyerAddress] = useState('');
    const [placeOfSupply, setPlaceOfSupply] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [customerId, setCustomerId] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [salesData, customersData] = await Promise.all([
                    salesApi.list(),
                    customersApi.list(),
                ]);
                if (!cancelled) {
                    setSales(salesData.sales);
                    setCustomers(customersData.customers);
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load sales');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    // Auto-fill buyer fields from the selected customer (editable after).
    useEffect(() => {
        if (!customerId) return;
        const c = customers.find((x) => x.id === customerId);
        if (!c) return;
        setBuyerName(c.name || '');
        setBuyerGstin(c.gstin || '');
        setBuyerAddress(c.address || '');
    }, [customerId, customers]);

    // Derive place of supply from buyer GSTIN, else the business GSTIN.
    useEffect(() => {
        const code = buyerGstin
            ? stateCodeFromGstin(buyerGstin)
            : stateCodeFromGstin(business?.gstin || '');
        setPlaceOfSupply(code);
    }, [buyerGstin, business]);

    const setItemField = (e) => setItem({ ...item, [e.target.name]: e.target.value });

    const preview = computeGst(
        [
            {
                amount: (Number(item.qty) || 0) * rupeesToPaise(item.rate),
                gstRate: isGst ? Number(item.gstRate) || 0 : 0,
            },
        ],
        rupeesToPaise(discount),
        isGst,
        isIntraState(business?.gstin || '', placeOfSupply)
    );

    const resetForm = () => {
        setItem(EMPTY_ITEM);
        setDiscount('');
        setIsGst(false);
        setBuyerName('');
        setBuyerGstin('');
        setBuyerAddress('');
        setPlaceOfSupply('');
        setPaymentMethod('cash');
        setCustomerId('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (paymentMethod === 'credit' && !customerId) {
            setError('Credit sales require a customer (khata)');
            return;
        }
        setSubmitting(true);
        try {
            const line = {
                name: item.name,
                qty: Number(item.qty),
                rate: rupeesToPaise(item.rate),
                gstRate: isGst ? Number(item.gstRate) || 0 : 0,
            };
            if (isGst && item.hsn) line.hsn = item.hsn;
            const payload = {
                items: [line],
                discount: rupeesToPaise(discount),
                isGst,
                paymentMethod,
            };
            if (isGst) {
                if (buyerName) payload.buyerName = buyerName;
                if (buyerGstin) payload.buyerGstin = buyerGstin;
                if (buyerAddress) payload.buyerAddress = buyerAddress;
                if (placeOfSupply) payload.placeOfSupply = placeOfSupply;
            }
            if (customerId) payload.customerId = customerId;
            await salesApi.create(payload);
            resetForm();
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('Cancel this sale? Stock and khata will be restored.')) return;
        try {
            await salesApi.cancel(id);
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel sale');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                    <Receipt size={24} className="text-primary" />
                </span>
                Sales
            </h1>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            <div className="glass p-6">
                <h2 className="mb-4 text-lg font-semibold">New sale</h2>
                <div className="mb-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setIsGst(false)}
                        aria-pressed={!isGst}
                        className={isGst ? 'btn-ghost' : 'btn-primary'}
                    >
                        Non-GST
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsGst(true)}
                        aria-pressed={isGst}
                        className={isGst ? 'btn-primary' : 'btn-ghost'}
                    >
                        GST invoice
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                        <label className="block min-w-48 flex-1 text-sm font-medium">
                            Item name
                            <input
                                name="name"
                                className="glass-input mt-1"
                                value={item.name}
                                onChange={setItemField}
                                required
                            />
                        </label>
                        <label className="block w-24 text-sm font-medium">
                            Qty
                            <input
                                name="qty"
                                type="number"
                                min="1"
                                step="1"
                                className="glass-input mt-1"
                                value={item.qty}
                                onChange={setItemField}
                                required
                            />
                        </label>
                        <label className="block w-32 text-sm font-medium">
                            Rate (₹)
                            <input
                                name="rate"
                                type="number"
                                step="0.01"
                                min="0"
                                className="glass-input mt-1"
                                value={item.rate}
                                onChange={setItemField}
                                required
                            />
                        </label>
                        {isGst && (
                            <>
                                <label className="block w-32 text-sm font-medium">
                                    GST rate
                                    <select
                                        name="gstRate"
                                        className="glass-input mt-1"
                                        value={item.gstRate}
                                        onChange={setItemField}
                                    >
                                        {GST_RATES.map((r) => (
                                            <option key={r} value={r}>
                                                {r}%
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block w-32 text-sm font-medium">
                                    HSN code
                                    <input
                                        name="hsn"
                                        className="glass-input mt-1"
                                        value={item.hsn}
                                        onChange={setItemField}
                                    />
                                </label>
                            </>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <label className="block w-32 text-sm font-medium">
                            Discount (₹)
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="glass-input mt-1"
                                value={discount}
                                onChange={(e) => setDiscount(e.target.value)}
                            />
                        </label>
                        <label className="block w-40 text-sm font-medium">
                            Payment method
                            <select
                                className="glass-input mt-1"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                                <option value="cash">Cash</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card</option>
                                <option value="credit">Credit (khata)</option>
                            </select>
                        </label>
                        <label className="block min-w-48 flex-1 text-sm font-medium">
                            Customer
                            <select
                                className="glass-input mt-1"
                                value={customerId}
                                onChange={(e) => setCustomerId(e.target.value)}
                            >
                                <option value="">— none —</option>
                                {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {isGst && (
                        <div className="flex flex-wrap gap-4">
                            <label className="block min-w-48 flex-1 text-sm font-medium">
                                Buyer name
                                <input
                                    className="glass-input mt-1"
                                    value={buyerName}
                                    onChange={(e) => setBuyerName(e.target.value)}
                                />
                            </label>
                            <label className="block w-56 text-sm font-medium">
                                Buyer GSTIN
                                <input
                                    className="glass-input mt-1"
                                    value={buyerGstin}
                                    onChange={(e) => setBuyerGstin(e.target.value)}
                                />
                            </label>
                            <label className="block min-w-48 flex-1 text-sm font-medium">
                                Buyer address
                                <input
                                    className="glass-input mt-1"
                                    value={buyerAddress}
                                    onChange={(e) => setBuyerAddress(e.target.value)}
                                />
                            </label>
                            <label className="block w-56 text-sm font-medium">
                                Place of supply
                                <select
                                    className="glass-input mt-1"
                                    value={placeOfSupply}
                                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                                >
                                    <option value="">— select —</option>
                                    {Object.entries(INDIAN_STATES).map(([code, name]) => (
                                        <option key={code} value={code}>
                                            {code} — {name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    )}
                    <div className="rounded-xl bg-white/50 px-4 py-3 text-sm text-gray-600">
                        <span className="mr-4">
                            Subtotal <span className="font-semibold">{formatINR(preview.taxableValue + rupeesToPaise(discount))}</span>
                        </span>
                        <span className="mr-4">
                            Discount <span className="font-semibold">{formatINR(rupeesToPaise(discount))}</span>
                        </span>
                        {isGst && preview.igst > 0 && (
                            <span className="mr-4">
                                IGST <span className="font-semibold">{formatINR(preview.igst)}</span>
                            </span>
                        )}
                        {isGst && preview.igst === 0 && (
                            <span className="mr-4">
                                CGST <span className="font-semibold">{formatINR(preview.cgst)}</span> · SGST{' '}
                                <span className="font-semibold">{formatINR(preview.sgst)}</span>
                            </span>
                        )}
                        <span>
                            Total{' '}
                            <span className="font-semibold text-primary">
                                {formatINR(preview.taxableValue + preview.tax)}
                            </span>
                        </span>
                    </div>
                    <button type="submit" disabled={submitting} className="btn-primary">
                        Record sale
                    </button>
                </form>
            </div>
            <div className="glass overflow-x-auto p-6">
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton h-10" />
                        ))}
                    </div>
                ) : sales.length === 0 ? (
                    <div className="empty-state">
                        <span className="rounded-full bg-white/60 p-3">
                            <Receipt size={28} className="text-primary" />
                        </span>
                        <p className="font-semibold">No sales yet</p>
                        <p className="text-sm text-gray-500">Record your first sale above.</p>
                    </div>
                ) : (
                    <table className="glass-table">
                        <thead>
                            <tr>
                                <th>Invoice</th>
                                <th>Date</th>
                                <th>Items</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map((s) => (
                                <tr key={s.id}>
                                    <td className="font-medium">
                                        <Link
                                            to={`/sales/${s.id}`}
                                            className="text-primary hover:underline"
                                        >
                                            {s.invoiceNumber}
                                        </Link>
                                    </td>
                                    <td className="text-gray-500">{formatDate(s.date)}</td>
                                    <td className="text-gray-500">
                                        {s.items.map((it) => `${it.name} × ${it.qty}`).join(', ')}
                                    </td>
                                    <td>
                                        <span className="badge badge-neutral">{s.paymentMethod}</span>
                                    </td>
                                    <td>
                                        <span
                                            className={`badge ${s.status === 'cancelled' ? 'badge-danger' : 'badge-success'}`}
                                        >
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="text-right font-semibold">
                                        {formatINR(s.total)}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                to={`/invoices/${s.id}`}
                                                className="btn-ghost px-3 py-1.5 text-xs"
                                            >
                                                Invoice
                                            </Link>
                                            {s.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleCancel(s.id)}
                                                    className="btn-danger px-3 py-1.5 text-xs"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/Sales.test.jsx`
Expected: PASS. (The `SaleDetail invoice` block in this file still references the old embedded invoice and will be updated in Task 13 — if it fails here, complete Task 13 next; do not commit this task until both `Sales.jsx` tests pass. If needed, run only the `Sales page` block meanwhile with `-t "Sales page"`.)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Sales.jsx client/src/pages/Sales.test.jsx
git commit -m "feat: add GST toggle, rate/HSN fields, buyer fields and live preview to sale form"
```

---

### Task 12: Customer GSTIN & address form

**Files:**
- Modify: `client/src/pages/Customers.jsx`
- Test: `client/src/pages/Customers.test.jsx`

**Interfaces:**
- Consumes: `customersApi.create` (already imported).
- Produces: the customer form gains `GSTIN` and `Address` inputs, sends them on create, and shows the inline error `"GSTIN must be 15 characters"` when a non-empty GSTIN is not exactly 15 characters.

- [ ] **Step 1: Write the failing test**

In `client/src/pages/Customers.test.jsx`, replace the `creates a customer` test with:

```js
    it('creates a customer with GSTIN and address', async () => {
        customersApi.create.mockResolvedValue({ customer: {} });
        render(
            <MemoryRouter>
                <Customers />
            </MemoryRouter>
        );
        await screen.findByText('Ramesh');
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Suresh' } });
        fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '9999999999' } });
        fireEvent.change(screen.getByLabelText('GSTIN'), { target: { value: '27XYZAB5678C1Z9' } });
        fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'MG Road' } });
        fireEvent.click(screen.getByRole('button', { name: /add customer/i }));
        await waitFor(() =>
            expect(customersApi.create).toHaveBeenCalledWith({
                name: 'Suresh',
                phone: '9999999999',
                gstin: '27XYZAB5678C1Z9',
                address: 'MG Road',
            })
        );
    });

    it('rejects an invalid GSTIN length', async () => {
        render(
            <MemoryRouter>
                <Customers />
            </MemoryRouter>
        );
        await screen.findByText('Ramesh');
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Suresh' } });
        fireEvent.change(screen.getByLabelText('GSTIN'), { target: { value: '123' } });
        fireEvent.click(screen.getByRole('button', { name: /add customer/i }));
        expect(await screen.findByText(/gstin must be 15 characters/i)).toBeInTheDocument();
        expect(customersApi.create).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/Customers.test.jsx`
Expected: FAIL — no `GSTIN`/`Address` fields; create payload lacks them.

- [ ] **Step 3: Write minimal implementation**

In `client/src/pages/Customers.jsx`, change the form state and submit handler, and add the two inputs.

Update the state initialiser:

```js
    const [form, setForm] = useState({ name: '', phone: '', gstin: '', address: '' });
```

Update `handleSubmit`:

```js
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.gstin && form.gstin.length !== 15) {
            setError('GSTIN must be 15 characters');
            return;
        }
        setSubmitting(true);
        try {
            await customersApi.create({
                name: form.name,
                phone: form.phone,
                gstin: form.gstin,
                address: form.address,
            });
            setForm({ name: '', phone: '', gstin: '', address: '' });
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };
```

Add the two inputs inside the form (after the `Phone` label):

```jsx
                    <label className="block text-sm font-medium">
                        GSTIN
                        <input
                            name="gstin"
                            className="glass-input mt-1"
                            value={form.gstin}
                            onChange={setField}
                        />
                    </label>
                    <label className="block text-sm font-medium">
                        Address
                        <input
                            name="address"
                            className="glass-input mt-1"
                            value={form.address}
                            onChange={setField}
                        />
                    </label>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/Customers.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Customers.jsx client/src/pages/Customers.test.jsx
git commit -m "feat: add GSTIN and address fields to the customer form"
```

---

### Task 13: Move invoice rendering out of SaleDetail

**Files:**
- Modify: `client/src/pages/SaleDetail.jsx`
- Test: `client/src/pages/Sales.test.jsx` (the `SaleDetail invoice` describe block)

**Interfaces:**
- Consumes: `salesApi.get(id)` (already used).
- Produces: `SaleDetail` becomes a sale summary with a link to `/invoices/:id`; the embedded print card and `react-to-print` usage are removed. (Cancel/delete remain on the Sales list — they do not exist on this page today.)

- [ ] **Step 1: Write the failing test**

In `client/src/pages/Sales.test.jsx`, replace the `describe('SaleDetail invoice', ...)` block with:

```js
describe('SaleDetail summary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        salesApi.get.mockResolvedValue({ sale });
    });

    it('links to the dedicated invoice view', async () => {
        renderDetail();
        expect(await screen.findByText('INV-1')).toBeInTheDocument();
        const link = screen.getByRole('link', { name: /view invoice/i });
        expect(link).toHaveAttribute('href', '/invoices/s1');
    });
});
```

Also remove the now-unused `react-to-print` mock from the top of `Sales.test.jsx` only if the `Sales` page test no longer needs it — the `Sales` page never imported it, so delete this block:

```js
vi.mock('react-to-print', () => ({
    useReactToPrint: () => vi.fn(),
}));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/Sales.test.jsx`
Expected: FAIL — no "View invoice" link; the layout still renders the embedded invoice.

- [ ] **Step 3: Write minimal implementation**

Replace `client/src/pages/SaleDetail.jsx` with the full file below:

```jsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { salesApi } from '../api/endpoints';
import { formatINR } from '../utils/money';
import { formatDate } from '../utils/format';
import { Receipt } from 'lucide-react';

export default function SaleDetail() {
    const { id } = useParams();
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await salesApi.get(id);
                if (!cancelled) setSale(data.sale);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load sale');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="flex items-center gap-3 text-2xl font-bold text-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60">
                        <Receipt size={24} className="text-primary" />
                    </span>
                    Sale {sale ? sale.invoiceNumber : ''}
                </h1>
                <div className="flex items-center gap-4">
                    <Link to="/sales" className="text-sm font-semibold text-primary hover:underline">
                        ← Back to sales
                    </Link>
                    {sale && (
                        <Link to={`/invoices/${sale.id}`} className="btn-primary">
                            View invoice
                        </Link>
                    )}
                </div>
            </div>
            {error && (
                <div className="glass px-4 py-3 text-sm font-medium text-red-600">{error}</div>
            )}
            {loading ? (
                <div className="glass mx-auto max-w-3xl p-10">
                    <div className="skeleton h-8 w-48" />
                    <div className="skeleton mt-6 h-40" />
                </div>
            ) : (
                sale && (
                    <div className="glass mx-auto max-w-3xl p-8">
                        <div className="flex items-start justify-between border-b border-white/50 pb-4">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-400">
                                    Invoice
                                </p>
                                <p className="text-xl font-bold text-gray-900">
                                    {sale.invoiceNumber}
                                </p>
                                <p className="text-sm text-gray-500">{formatDate(sale.date)}</p>
                            </div>
                            <div className="text-right">
                                <span
                                    className={`badge ${sale.isGst ? 'badge-success' : 'badge-neutral'}`}
                                >
                                    {sale.isGst ? 'GST' : 'Non-GST'}
                                </span>
                                <span
                                    className={`ml-2 badge ${sale.status === 'cancelled' ? 'badge-danger' : 'badge-success'}`}
                                >
                                    {sale.status}
                                </span>
                            </div>
                        </div>
                        <table className="mt-4 w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/50 text-left text-xs uppercase tracking-wide text-gray-500">
                                    <th className="pb-2">Item</th>
                                    <th className="pb-2 text-right">Qty</th>
                                    <th className="pb-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.items.map((it, i) => (
                                    <tr key={i} className="border-b border-white/30">
                                        <td className="py-2 font-medium text-gray-800">{it.name}</td>
                                        <td className="py-2 text-right">{it.qty}</td>
                                        <td className="py-2 text-right">{formatINR(it.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-4 flex justify-end">
                            <div className="w-64 space-y-1 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal</span>
                                    <span>{formatINR(sale.subtotal)}</span>
                                </div>
                                {sale.discount > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Discount</span>
                                        <span>-{formatINR(sale.discount)}</span>
                                    </div>
                                )}
                                {sale.tax > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>Tax</span>
                                        <span>+{formatINR(sale.tax)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-t border-white/50 pt-2 text-base font-bold text-gray-900">
                                    <span>Total</span>
                                    <span>{formatINR(sale.total)}</span>
                                </div>
                            </div>
                        </div>
                        <p className="mt-6 text-sm text-gray-500">
                            Open the invoice view to print or share this document.
                        </p>
                    </div>
                )
            )}
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/Sales.test.jsx`
Expected: PASS.

- [ ] **Step 5: Run the full suites and commit**

Run: `npm run test:server && npm run test:client`
Expected: PASS (all server and client tests green).

```bash
git add client/src/pages/SaleDetail.jsx client/src/pages/Sales.test.jsx
git commit -m "refactor: move invoice rendering from SaleDetail into the invoices section"
```

---

## Self-Review

**Spec coverage:**
- §2.1 Sale schema (`gstRate`, `hsn`, `isGst`, buyer fields, `placeOfSupply`, `cgst/sgst/igst`) → Tasks 1, 2.
- §2.2 GST computation (line arithmetic in hook, split in controller, discount allocation, rounding, odd remainder to CGST, `tax` = total tax) → Tasks 1, 4.
- §2.3 shared `utils/gst.js` (server + client mirror) → Tasks 1, 6.
- §2.4 no migration (defaults) → Task 2.
- §2.5 Customer `gstin`/`address` + 15-char validation → Task 3.
- §3.1 `GET /invoices`, `GET /invoices/:id` + query validation → Task 5.
- §3.2 `POST /sales` validation + controller rules (business GSTIN, HSN, buyer snapshot on every sale, `tax` ignored when GST) → Task 4.
- §3.3 `invoicesApi` → Task 7.
- §4.1 nav + routes → Task 8.
- §4.2 Invoices list page → Task 9.
- §4.3 InvoiceDetail (GST/non-GST, HSN breakup, print, share, SaleDetail trimmed) → Tasks 10, 13.
- §4.4 Sale form GST toggle/fields/preview → Task 11.
- §4.5 Customers page → Task 12.
- §5 error handling (400s, share fallback) → Tasks 4, 5, 10.
- §6.1/§6.2 tests → every task; §6.3 manual E2E remains user-run.

**Placeholder scan:** No "TBD"/"TODO"/"handle edge cases" placeholders. Every code step contains complete code. Test commands and expected results are explicit.

**Type consistency:** `computeGst(items, discount, isGst, intraState)` returns `{ cgst, sgst, igst, tax, taxableValue, lines }` in both server (Task 1) and client (Task 6); `lineBreakup(items, discount)` returns `{ taxableValue, gstRate, tax }[]` in both. `invoicesApi.list(params)`/`get(id)` match between Tasks 7, 9, 10. `stateCodeFromGstin` returns alpha-2 in both mirrors, used identically in Tasks 4 and 11. Sale field names (`isGst`, `buyerGstin`, `buyerName`, `buyerAddress`, `placeOfSupply`, `cgst`, `sgst`, `igst`) are identical across Tasks 2, 4, 5, 10, 11, 13. The GET `/invoices/:id` response `{ invoice, business }` matches Tasks 5 and 10.

**Known deliberate resolutions:**
- The spec's `placeOfSupply` example is alpha-2 (`MH`) while `stateCodeFromGstin` reads a GSTIN's numeric prefix; the util bridges numeric → alpha internally so both stay consistent (documented in Task 1 / Global Constraints).
- The spec says SaleDetail "keeps cancel/delete"; those actions actually live on the Sales list today, so Task 13 links to the invoice view without inventing new actions.
- `GET /invoices/:id` does not return a 404 for a sale whose `invoiceNumber` is empty, because every sale is created with one; tenant isolation is enforced by `businessId`.
