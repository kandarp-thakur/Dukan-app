# Foundation Phase Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the multi-tenant foundation: Express API with JWT auth + tenant scoping, MongoDB models for users/businesses, and a React client with the light-green glassmorphism theme, login/register, and the protected app shell.

**Architecture:** Monorepo with `server/` (Express + Mongoose, CommonJS) and `client/` (Vite + React + Tailwind). Every business document carries `businessId`; `authenticate` → `tenantScope` → `requireRole` middleware chain enforces isolation and permissions. JWT access tokens (15min, in client memory) + refresh tokens (7d, httpOnly cookie scoped to `/api/v1/auth`). In dev, Vite proxies `/api` to the Express server so cookies are same-origin.

**Tech Stack:** Node 18+, Express 4, Mongoose 8, jsonwebtoken 9, bcryptjs, express-validator 7, cookie-parser, Jest + Supertest + mongodb-memory-server (server); React 18, Vite 5, Tailwind CSS 3.4, React Router 6, axios, Vitest + React Testing Library (client).

**Spec:** `docs/superpowers/specs/2026-09-10-business-accounting-saas-design.md`

## Global Constraints

- Node.js 18+ required. Server uses CommonJS (`require`), client uses ESM.
- Server deps: `express@4`, `mongoose@8`, `jsonwebtoken@9`, `bcryptjs@2`, `express-validator@7`, `cookie-parser@1`, `cors`, `helmet`, `dotenv`.
- Client deps: `react@18`, `react-dom@18`, `react-router-dom@6`, `axios`; dev: `vite@5`, `tailwindcss@3.4`, `postcss`, `autoprefixer`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.
- All API responses use the envelope `{ success: boolean, message: string, data?: any, errors?: string[] }`.
- All business-scoped data must be filtered by `businessId` — no unscoped queries.
- Money is stored as paise integers (not used this phase, but no float money fields ever).
- Theme tokens (exact values): primary `#2E7D32`, accent `#4CAF50`, mint `#E8F5E9`, sage `#F1F8F2`, background gradient `linear-gradient(135deg, #E8F5E9 0%, #F1F8F2 100%)`, glass surface `bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-2xl`.
- **No browser-based testing by the agent (user rule).** Verify APIs with `curl`; UI is verified by the user manually. Vitest/jsdom tests are allowed (not a browser).
- Commit after every green test cycle, conventional commits (`feat:`, `test:`, `chore:`, `docs:`).
- Working directory for all commands: repo root `e:/client_projects/acc-app-shubham` unless a task says otherwise. Shell is Windows cmd — use `&&` chaining, no Unix utilities.

---

### Task 1: Server scaffold + health endpoint

**Files:**
- Create: `server/package.json`, `server/jest.config.js`, `server/.env.example`, `server/.env`, `server/src/app.js`, `server/src/server.js`, `server/src/config/db.js`, `server/tests/env.js`, `server/tests/setupTestDB.js`, `server/tests/health.test.js`
- Create: `.gitignore` (repo root)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `server/src/app.js` exports the Express `app` (no DB connection — tests import this); `server/src/server.js` starts the listener after connecting Mongo; `setupTestDB()` from `server/tests/setupTestDB.js` registers jest hooks (in-memory Mongo, clean DB between tests); `GET /api/v1/health` returns `{ success: true, message: 'OK', data: null }`.

- [ ] **Step 1: Create server package.json and install deps**

Create `server/package.json`:

```json
{
  "name": "acc-app-server",
  "version": "1.0.0",
  "private": true,
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "test": "jest --runInBand"
  }
}
```

Run:

```bash
cd server && npm install express mongoose jsonwebtoken bcryptjs express-validator cookie-parser cors helmet dotenv && npm install -D nodemon jest supertest mongodb-memory-server
```

Note: `mongodb-memory-server` downloads a MongoDB binary on first test run — internet required.

- [ ] **Step 2: Create jest config, test env, and DB test helper**

Create `server/jest.config.js`:

```js
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/env.js'],
};
```

Create `server/tests/env.js`:

```js
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
```

Create `server/tests/setupTestDB.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = function setupTestDB() {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
};
```

- [ ] **Step 3: Write the failing health test**

Create `server/tests/health.test.js`:

```js
const request = require('supertest');
const app = require('../src/app');

describe('GET /api/v1/health', () => {
  it('returns success envelope', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'OK', data: null });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd server && npx jest tests/health.test.js`
Expected: FAIL — `Cannot find module '../src/app'`

- [ ] **Step 5: Write app.js, server.js, db.js, env files**

Create `server/src/app.js`:

```js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, message: 'OK', data: null });
});

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
```

Create `server/src/config/db.js`:

```js
const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env and configure it.');
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = { connectDB };
```

Create `server/src/server.js`:

```js
require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
```

Create `server/src/routes/index.js` (empty router for now — auth/business routes mount here in later tasks):

```js
const express = require('express');
const router = express.Router();

module.exports = router;
```

Create `server/src/middleware/errors.js` (needed by app.js now; full tests in Task 3):

```js
exports.notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

exports.errorHandler = (err, req, res, next) => {
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate value',
      errors: Object.keys(err.keyValue || {}),
    });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
};
```

Create `server/.env.example`:

```
MONGO_URI=mongodb://127.0.0.1:27017/acc-app
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
PORT=5000
CLIENT_URL=http://localhost:5173
```

Copy it to `server/.env` (same content is fine locally).

Create `.gitignore` at repo root:

```
node_modules/
dist/
.env
uploads/
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx jest tests/health.test.js`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```bash
git add server .gitignore && git commit -m "chore: scaffold express server with health endpoint and test setup"
```

---

### Task 2: User and Business models

**Files:**
- Create: `server/src/models/User.js`, `server/src/models/Business.js`
- Test: `server/tests/models.test.js`

**Interfaces:**
- Consumes: `setupTestDB()` from Task 1
- Produces:
  - `User` model: fields `name`, `email` (unique, lowercase), `passwordHash`, `role` (`'owner'|'staff'`), `businessId` (ObjectId, indexed). Virtual `password` setter hashes via bcryptjs. Method `comparePassword(plain) -> boolean`. `toJSON()` returns `{ id, name, email, role, businessId, createdAt, updatedAt }` — never `passwordHash`.
  - `Business` model: fields `name`, `logoUrl` (default `''`), `address` (default `''`), `gstin` (default `''`), `currency` (default `'INR'`), `invoicePrefix` (default `'INV'`), `invoiceCounter` (default `0`), `plan` (`'free'|'pro'`, default `'free'`), `planExpiresAt` (default `null`). `toJSON()` returns `{ id, ...fields, createdAt, updatedAt }`.

- [ ] **Step 1: Write the failing model tests**

Create `server/tests/models.test.js`:

```js
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Business = require('../src/models/Business');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

describe('User model', () => {
  it('hashes password via virtual and hides hash in toJSON', async () => {
    const business = await Business.create({ name: 'Test Shop' });
    const user = await User.create({
      name: 'Shubham',
      email: 'shubham@test.com',
      password: 'secret123',
      role: 'owner',
      businessId: business._id,
    });
    expect(user.passwordHash).not.toBe('secret123');
    expect(user.comparePassword('secret123')).toBe(true);
    expect(user.comparePassword('wrongpass')).toBe(false);
    const json = user.toJSON();
    expect(json.passwordHash).toBeUndefined();
    expect(json.email).toBe('shubham@test.com');
    expect(json.role).toBe('owner');
    expect(json.id).toBe(user._id.toString());
  });

  it('rejects duplicate email', async () => {
    const business = await Business.create({ name: 'Test Shop' });
    const userData = { password: 'secret123', businessId: business._id };
    await User.create({ ...userData, name: 'A', email: 'dup@test.com' });
    await expect(
      User.create({ ...userData, name: 'B', email: 'dup@test.com' })
    ).rejects.toThrow(/duplicate key|E11000/);
  });

  it('rejects invalid role', async () => {
    const business = await Business.create({ name: 'Test Shop' });
    await expect(
      User.create({
        name: 'A',
        email: 'role@test.com',
        password: 'secret123',
        role: 'admin',
        businessId: business._id,
      })
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });
});

describe('Business model', () => {
  it('applies v1 defaults', async () => {
    const business = await Business.create({ name: 'Kirana Store' });
    expect(business.currency).toBe('INR');
    expect(business.invoicePrefix).toBe('INV');
    expect(business.invoiceCounter).toBe(0);
    expect(business.plan).toBe('free');
    expect(business.planExpiresAt).toBeNull();
    const json = business.toJSON();
    expect(json.id).toBe(business._id.toString());
    expect(json._id).toBeUndefined();
  });

  it('rejects missing name', async () => {
    await expect(Business.create({})).rejects.toThrow(mongoose.Error.ValidationError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/models.test.js`
Expected: FAIL — `Cannot find module '../src/models/User'`

- [ ] **Step 3: Write the models**

Create `server/src/models/User.js`:

```js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'staff'], default: 'staff' },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

userSchema.virtual('password').set(function (password) {
  this.passwordHash = bcrypt.hashSync(password, 10);
});

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
```

Create `server/src/models/Business.js`:

```js
const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Business name is required'], trim: true },
    logoUrl: { type: String, default: '' },
    address: { type: String, default: '' },
    gstin: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
    invoicePrefix: { type: String, default: 'INV' },
    invoiceCounter: { type: Number, default: 0 },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    planExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

businessSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Business', businessSchema);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/models.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/models server/tests/models.test.js && git commit -m "feat: add User and Business mongoose models"
```

---

### Task 3: Error and validation middleware

**Files:**
- Create: `server/src/middleware/validate.js`
- Test: `server/tests/middleware.test.js` (`server/src/middleware/errors.js` already exists from Task 1 — this task verifies it)

**Interfaces:**
- Consumes: `app` from Task 1 (for the 404 test)
- Produces: `validate(validations)` express middleware — runs express-validator chains, on failure responds `400 { success: false, message: 'Validation failed', errors: string[] }`. `notFound` and `errorHandler` (from Task 1) verified: unknown route → 404 envelope; duplicate key → 409; Mongoose ValidationError → 400 with messages.

- [ ] **Step 1: Write the failing tests**

Create `server/tests/middleware.test.js`:

```js
const request = require('supertest');
const { validationResult } = require('express-validator');
const app = require('../src/app');
const { errorHandler } = require('../src/middleware/errors');
const { validate } = require('../src/middleware/validate');

describe('notFound', () => {
  it('returns 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Route not found');
  });
});

describe('errorHandler', () => {
  const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('maps duplicate key error to 409', () => {
    const res = makeRes();
    errorHandler({ code: 11000, keyValue: { email: 'a@b.com' } }, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it('maps mongoose ValidationError to 400 with messages', () => {
    const res = makeRes();
    const err = {
      name: 'ValidationError',
      errors: { email: { message: 'Email is required' }, name: { message: 'Name is required' } },
    };
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors).toEqual(
      expect.arrayContaining(['Email is required', 'Name is required'])
    );
  });

  it('maps CastError to 400', () => {
    const res = makeRes();
    errorHandler({ name: 'CastError' }, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('maps unknown errors to 500', () => {
    const res = makeRes();
    errorHandler(new Error('boom'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('validate', () => {
  it('returns 400 with error messages when validation fails', async () => {
    const testApp = require('express')();
    testApp.use(require('express').json());
    const { body } = require('express-validator');
    testApp.post(
      '/t',
      body('email').isEmail().withMessage('Valid email is required'),
      validate,
      (req, res) => res.json({ success: true, message: 'OK', data: null })
    );
    const res = await request(testApp).post('/t').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Valid email is required']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/middleware.test.js`
Expected: FAIL — `Cannot find module '../src/middleware/validate'`

- [ ] **Step 3: Write validate middleware**

Create `server/src/middleware/validate.js`:

```js
const { validationResult } = require('express-validator');

exports.validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((validation) => validation.run(req)));
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array().map((e) => e.msg),
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/middleware.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/validate.js server/tests/middleware.test.js && git commit -m "feat: add validation middleware and verify error handling"
```

---

### Task 4: Token utils + auth middleware (authenticate, tenantScope, requireRole)

**Files:**
- Create: `server/src/utils/tokens.js`, `server/src/middleware/auth.js`
- Test: `server/tests/authMiddleware.test.js`

**Interfaces:**
- Consumes: `User`, `Business` models (Task 2); `setupTestDB()` (Task 1)
- Produces:
  - `generateAccessToken(user) -> string` — JWT signed with `JWT_ACCESS_SECRET`, payload `{ id, businessId, role }` (all strings), expiry `15m`.
  - `generateRefreshToken(user) -> string` — JWT signed with `JWT_REFRESH_SECRET`, payload `{ id }`, expiry `7d`.
  - `authenticate` — reads `Authorization: Bearer <token>`, verifies, loads user from DB, sets `req.user = { id, role, businessId }` (strings). No/garbage/expired token or deleted user → `401 { success: false, message }`.
  - `tenantScope` — sets `req.businessId = req.user.businessId`; missing context → 403.
  - `requireRole(role)` — factory; `req.user.role !== role` → 403.

- [ ] **Step 1: Write the failing tests**

Create `server/tests/authMiddleware.test.js`:

```js
const express = require('express');
const request = require('supertest');
const { authenticate, tenantScope, requireRole } = require('../src/middleware/auth');
const { generateAccessToken } = require('../src/utils/tokens');
const User = require('../src/models/User');
const Business = require('../src/models/Business');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const makeApp = () => {
  const app = express();
  app.get('/api/v1/whoami', authenticate, tenantScope, (req, res) =>
    res.json({
      success: true,
      message: 'OK',
      data: { userId: req.user.id, businessId: req.businessId, role: req.user.role },
    })
  );
  app.get('/api/v1/owner-only', authenticate, requireRole('owner'), (req, res) =>
    res.json({ success: true, message: 'OK', data: null })
  );
  return app;
};

const createUser = async (role) => {
  const business = await Business.create({ name: 'Test Biz' });
  return User.create({
    name: 'Test User',
    email: `${role}-${Date.now()}-${Math.random()}@test.com`,
    password: 'secret123',
    role,
    businessId: business._id,
  });
};

describe('authenticate', () => {
  it('returns 401 without authorization header', async () => {
    const res = await request(makeApp()).get('/api/v1/whoami');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with a garbage token', async () => {
    const res = await request(makeApp())
      .get('/api/v1/whoami')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('sets req.user and req.businessId for a valid token', async () => {
    const user = await createUser('owner');
    const token = generateAccessToken(user);
    const res = await request(makeApp())
      .get('/api/v1/whoami')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(user._id.toString());
    expect(res.body.data.businessId).toBe(user.businessId.toString());
    expect(res.body.data.role).toBe('owner');
  });
});

describe('requireRole', () => {
  it('returns 403 for staff on owner-only route', async () => {
    const staff = await createUser('staff');
    const res = await request(makeApp())
      .get('/api/v1/owner-only')
      .set('Authorization', `Bearer ${generateAccessToken(staff)}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 for owner on owner-only route', async () => {
    const owner = await createUser('owner');
    const res = await request(makeApp())
      .get('/api/v1/owner-only')
      .set('Authorization', `Bearer ${generateAccessToken(owner)}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/authMiddleware.test.js`
Expected: FAIL — `Cannot find module '../src/middleware/auth'`

- [ ] **Step 3: Write tokens util and auth middleware**

Create `server/src/utils/tokens.js`:

```js
const jwt = require('jsonwebtoken');

exports.generateAccessToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      businessId: user.businessId.toString(),
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

exports.generateRefreshToken = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
```

Create `server/src/middleware/auth.js`:

```js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }
    req.user = {
      id: user._id.toString(),
      role: user.role,
      businessId: user.businessId.toString(),
    };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

exports.tenantScope = (req, res, next) => {
  if (!req.user || !req.user.businessId) {
    return res.status(403).json({ success: false, message: 'No business context' });
  }
  req.businessId = req.user.businessId;
  next();
};

exports.requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/authMiddleware.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/utils server/src/middleware/auth.js server/tests/authMiddleware.test.js && git commit -m "feat: add JWT token utils and auth/tenant/role middleware"
```

---

### Task 5: Auth routes (register, login, refresh, logout, me)

**Files:**
- Create: `server/src/controllers/authController.js`, `server/src/routes/authRoutes.js`
- Modify: `server/src/routes/index.js`
- Test: `server/tests/auth.test.js`

**Interfaces:**
- Consumes: models (Task 2), `validate` (Task 3), tokens + middleware (Task 4)
- Produces (all under `/api/v1/auth`, response envelope, `data` shapes):
  - `POST /register` body `{ businessName, name, email, password }` → 201 `{ accessToken, user, business }` + sets httpOnly `refreshToken` cookie (path `/api/v1/auth`, 7d). Duplicate email → 409. Bad body → 400.
  - `POST /login` body `{ email, password }` → 200 `{ accessToken, user, business }` + cookie. Wrong credentials → 401.
  - `POST /refresh` (cookie) → 200 `{ accessToken }` + rotated cookie. No/invalid cookie → 401.
  - `POST /logout` → 200, clears cookie.
  - `GET /me` (Bearer) → 200 `{ user, business }`.
  - `user` JSON shape from Task 2 `toJSON`; `business` likewise.

- [ ] **Step 1: Write the failing tests**

Create `server/tests/auth.test.js`:

```js
const request = require('supertest');
const app = require('../src/app');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerPayload = {
  businessName: 'Shubham Traders',
  name: 'Shubham',
  email: 'shubham@test.com',
  password: 'secret123',
};

describe('POST /api/v1/auth/register', () => {
  it('creates user + business and returns tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registerPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('shubham@test.com');
    expect(res.body.data.user.role).toBe('owner');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.business.name).toBe('Shubham Traders');
    expect(res.body.data.business.plan).toBe('free');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('refreshToken=');
    expect(cookie).toContain('HttpOnly');
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registerPayload, businessName: 'Other Biz', name: 'Other' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'x@test.com', password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining(['Business name is required', 'Name is required'])
    );
  });

  it('returns 400 for short password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registerPayload, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('Password must be at least 8 characters');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns 401 for wrong password', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'shubham@test.com', password: 'wrongpass1' });
    expect(res.status).toBe(401);
  });

  it('returns tokens and user for valid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(registerPayload);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'shubham@test.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('shubham@test.com');
    expect(res.body.data.business.name).toBe('Shubham Traders');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns a new access token for a valid cookie', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload);
    const cookie = reg.headers['set-cookie'][0];
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('returns 401 without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('clears the refresh cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toContain('refreshToken=;');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns user and business for a valid access token', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(registerPayload);
    const token = reg.body.data.accessToken;
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('shubham@test.com');
    expect(res.body.data.business.name).toBe('Shubham Traders');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/auth.test.js`
Expected: FAIL — 404s from `Route not found` (routes not mounted yet)

- [ ] **Step 3: Write the auth controller**

Create `server/src/controllers/authController.js`:

```js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Business = require('../models/Business');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokens');

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });
};

exports.register = async (req, res) => {
  const { businessName, name, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }
  const business = await Business.create({ name: businessName });
  const user = await User.create({
    name,
    email,
    password,
    role: 'owner',
    businessId: business._id,
  });
  setRefreshCookie(res, generateRefreshToken(user));
  return res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { accessToken: generateAccessToken(user), user: user.toJSON(), business: business.toJSON() },
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase().trim() });
  if (!user || !user.comparePassword(password || '')) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }
  const business = await Business.findById(user.businessId);
  setRefreshCookie(res, generateRefreshToken(user));
  return res.json({
    success: true,
    message: 'Login successful',
    data: { accessToken: generateAccessToken(user), user: user.toJSON(), business: business.toJSON() },
  });
};

exports.refresh = async (req, res) => {
  const token = req.cookies ? req.cookies.refreshToken : undefined;
  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }
    setRefreshCookie(res, generateRefreshToken(user));
    return res.json({
      success: true,
      message: 'Token refreshed',
      data: { accessToken: generateAccessToken(user) },
    });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  return res.json({ success: true, message: 'Logged out', data: null });
};

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id);
  const business = await Business.findById(req.user.businessId);
  if (!user || !business) {
    return res.status(404).json({ success: false, message: 'Account not found' });
  }
  return res.json({
    success: true,
    message: 'OK',
    data: { user: user.toJSON(), business: business.toJSON() },
  });
};
```

- [ ] **Step 4: Write the auth routes and mount them**

Create `server/src/routes/authRoutes.js`:

```js
const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/register',
  body('businessName').trim().notEmpty().withMessage('Business name is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').trim().toLowerCase(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
  authController.register
);

router.post(
  '/login',
  body('email').isEmail().withMessage('Valid email is required').trim().toLowerCase(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  authController.login
);

router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

module.exports = router;
```

Modify `server/src/routes/index.js`:

```js
const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));

module.exports = router;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx jest tests/auth.test.js`
Expected: PASS (9 tests)

- [ ] **Step 6: Run the full server suite**

Run: `cd server && npm test`
Expected: all test files PASS

- [ ] **Step 7: Commit**

```bash
git add server/src server/tests/auth.test.js && git commit -m "feat: add auth endpoints (register, login, refresh, logout, me)"
```

---

### Task 6: Business routes + tenant isolation test

**Files:**
- Create: `server/src/controllers/businessController.js`, `server/src/routes/businessRoutes.js`
- Modify: `server/src/routes/index.js`
- Test: `server/tests/business.test.js`

**Interfaces:**
- Consumes: models, middleware, tokens (Tasks 2–4)
- Produces:
  - `GET /api/v1/business` (Bearer) → 200 `{ business }` — always the caller's own business (from `req.user.businessId`).
  - `PATCH /api/v1/business` (Bearer + owner) → 200 `{ business }` — updates only `name`, `address`, `gstin`, `currency`, `invoicePrefix`. Staff → 403. GSTIN when present must be 15 chars → else 400.

- [ ] **Step 1: Write the failing tests (including the two-business isolation check)**

Create `server/tests/business.test.js`:

```js
const request = require('supertest');
const app = require('../src/app');
const Business = require('../src/models/Business');
const User = require('../src/models/User');
const { setupTestDB } = require('./setupTestDB');

setupTestDB();

const registerBusiness = async (suffix) => {
  const res = await request(app).post('/api/v1/auth/register').send({
    businessName: `Business ${suffix}`,
    name: `Owner ${suffix}`,
    email: `owner${suffix}@test.com`,
    password: 'secret123',
  });
  return res.body.data;
};

const createStaffFor = async (businessData, suffix) => {
  return User.create({
    name: `Staff ${suffix}`,
    email: `staff${suffix}@test.com`,
    password: 'secret123',
    role: 'staff',
    businessId: businessData.business.id,
  });
};

describe('GET /api/v1/business', () => {
  it('returns the caller own business', async () => {
    const data = await registerBusiness('A');
    const res = await request(app)
      .get('/api/v1/business')
      .set('Authorization', `Bearer ${data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.business.name).toBe('Business A');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/business');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/business', () => {
  it('owner can update business fields', async () => {
    const data = await registerBusiness('B');
    const res = await request(app)
      .patch('/api/v1/business')
      .set('Authorization', `Bearer ${data.accessToken}`)
      .send({ name: 'Renamed Biz', gstin: '27ABCDE1234F1Z5', address: 'MG Road, Pune' });
    expect(res.status).toBe(200);
    expect(res.body.data.business.name).toBe('Renamed Biz');
    expect(res.body.data.business.gstin).toBe('27ABCDE1234F1Z5');
  });

  it('staff gets 403', async () => {
    const data = await registerBusiness('C');
    const staff = await createStaffFor(data, 'C');
    const { generateAccessToken } = require('../src/utils/tokens');
    const res = await request(app)
      .patch('/api/v1/business')
      .set('Authorization', `Bearer ${generateAccessToken(staff)}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('rejects invalid GSTIN length', async () => {
    const data = await registerBusiness('D');
    const res = await request(app)
      .patch('/api/v1/business')
      .set('Authorization', `Bearer ${data.accessToken}`)
      .send({ gstin: 'TOOSHORT' });
    expect(res.status).toBe(400);
  });

  it('tenant isolation: business A update never touches business B', async () => {
    const dataA = await registerBusiness('E');
    const dataB = await registerBusiness('F');
    const res = await request(app)
      .patch('/api/v1/business')
      .set('Authorization', `Bearer ${dataA.accessToken}`)
      .send({ name: 'A New Name' });
    expect(res.status).toBe(200);
    const bizB = await Business.findById(dataB.business.id);
    expect(bizB.name).toBe('Business F');
    const bizA = await Business.findById(dataA.business.id);
    expect(bizA.name).toBe('A New Name');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/business.test.js`
Expected: FAIL — 404 `Route not found`

- [ ] **Step 3: Write the business controller and routes**

Create `server/src/controllers/businessController.js`:

```js
const Business = require('../models/Business');

exports.getBusiness = async (req, res) => {
  const business = await Business.findById(req.user.businessId);
  if (!business) {
    return res.status(404).json({ success: false, message: 'Business not found' });
  }
  return res.json({ success: true, message: 'OK', data: business.toJSON() });
};

exports.updateBusiness = async (req, res) => {
  const allowed = ['name', 'address', 'gstin', 'currency', 'invoicePrefix'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }
  const business = await Business.findByIdAndUpdate(req.user.businessId, updates, {
    new: true,
    runValidators: true,
  });
  if (!business) {
    return res.status(404).json({ success: false, message: 'Business not found' });
  }
  return res.json({ success: true, message: 'Business updated', data: business.toJSON() });
};
```

Create `server/src/routes/businessRoutes.js`:

```js
const express = require('express');
const { body } = require('express-validator');
const businessController = require('../controllers/businessController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/', authenticate, businessController.getBusiness);

router.patch(
  '/',
  authenticate,
  requireRole('owner'),
  body('name').optional().trim().notEmpty().withMessage('Business name cannot be empty'),
  body('gstin')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 15, max: 15 })
    .withMessage('GSTIN must be 15 characters'),
  validate,
  businessController.updateBusiness
);

module.exports = router;
```

Modify `server/src/routes/index.js`:

```js
const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/business', require('./businessRoutes'));

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/business.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Run full suite and verify server boots**

Run: `cd server && npm test`
Expected: all PASS

Then verify the real server starts (needs local MongoDB running; Ctrl+C after seeing the log):

```bash
cd server && npm run dev
```

Expected console output: `MongoDB connected` then `Server running on port 5000`. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add server/src server/tests/business.test.js && git commit -m "feat: add business endpoints with owner-only updates and tenant isolation test"
```

---

### Task 7: Client scaffold + glass theme

**Files:**
- Create: `client/` (Vite scaffold), then modify: `client/vite.config.js`, `client/tailwind.config.js`, `client/postcss.config.js`, `client/src/index.css`, `client/src/App.jsx`, `client/src/test/setup.js`, `client/.env.example`
- Test: `client/src/theme.test.jsx`

**Interfaces:**
- Consumes: nothing (first client task)
- Produces: Vite dev server on port 5173 with `/api` proxied to `http://localhost:5000`; Tailwind theme tokens `primary`, `accent`, `mint`, `sage`, `shadow-glass`, `bg-app-gradient`; component classes `.glass`, `.glass-input`, `.btn-primary`; Vitest + RTL wired with jsdom.

- [ ] **Step 1: Scaffold Vite React app and install deps**

```bash
npm create vite@latest client -- --template react
cd client && npm install && npm install react-router-dom axios && npm install -D tailwindcss@3.4 postcss autoprefixer vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Configure Vite (proxy + test), Tailwind, PostCSS**

Replace `client/vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});
```

Create `client/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2E7D32',
        accent: '#4CAF50',
        mint: '#E8F5E9',
        sage: '#F1F8F2',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      backgroundImage: {
        'app-gradient': 'linear-gradient(135deg, #E8F5E9 0%, #F1F8F2 100%)',
      },
    },
  },
  plugins: [],
};
```

Create `client/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Write the theme CSS and test setup**

Replace `client/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-app-gradient min-h-screen text-gray-800 antialiased;
  }
}

@layer components {
  .glass {
    @apply bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass rounded-2xl;
  }
  .glass-input {
    @apply w-full rounded-xl border border-white/60 bg-white/70 px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30;
  }
  .btn-primary {
    @apply rounded-xl bg-primary px-4 py-2.5 font-semibold text-white shadow-glass transition-colors hover:bg-accent;
  }
}
```

Create `client/src/test/setup.js`:

```js
import '@testing-library/jest-dom';
```

Replace `client/src/App.jsx` (temporary minimal version — replaced properly in Task 11):

```jsx
export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass p-8">
        <h1 className="text-2xl font-bold text-primary">Acc App</h1>
      </div>
    </div>
  );
}
```

Delete `client/src/App.css` and remove its import if present (App.jsx above has no import). Delete `client/src/assets/react.svg` if present. Update `client/index.html` `<title>` to `Acc App`.

Create `client/.env.example`:

```
# In dev, leave unset: Vite proxies /api to http://localhost:5000.
# In production, set to your deployed API base, e.g. https://api.example.com/api/v1
VITE_API_URL=
```

- [ ] **Step 4: Write the failing smoke test**

Create `client/src/theme.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('glass theme smoke test', () => {
  it('renders the app with glass card', () => {
    render(<App />);
    expect(screen.getByText('Acc App')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npx vitest run`
Expected: PASS (1 test). (This verifies the vitest+RTL+jsdom wiring; the scaffold itself was generated working.)

- [ ] **Step 6: Commit**

```bash
git add client && git commit -m "chore: scaffold react client with tailwind glass theme and vitest"
```

---

### Task 8: API client + AuthContext

**Files:**
- Create: `client/src/api/client.js`, `client/src/context/AuthContext.jsx`
- Test: `client/src/context/AuthContext.test.jsx`

**Interfaces:**
- Consumes: backend auth endpoints (Task 5 shapes)
- Produces:
  - `client/src/api/client.js`: default export `api` (axios instance, `baseURL = import.meta.env.VITE_API_URL || '/api/v1'`, `withCredentials: true`); named export `setAccessToken(token)` — module-level token injected as `Authorization: Bearer <token>` on every request; response interceptor retries once through `POST /auth/refresh` on 401 (never retries for `/auth/` URLs).
  - `client/src/context/AuthContext.jsx`: `AuthProvider` + `useAuth()` → `{ user, business, loading, login, register, logout }`. On mount performs silent refresh (`POST /auth/refresh` then `GET /auth/me`). `login(email, password)`, `register({ businessName, name, email, password })`, `logout()` — all async.

- [ ] **Step 1: Write the failing tests**

Create `client/src/context/AuthContext.test.jsx`:

```jsx
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import api, { setAccessToken } from '../api/client';

vi.mock('../api/client', () => ({
  default: { post: vi.fn(), get: vi.fn() },
  setAccessToken: vi.fn(),
}));

const Probe = () => {
  const { user, business, loading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user">{user ? user.email : 'none'}</div>
      <div data-testid="business">{business ? business.name : 'none'}</div>
    </div>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('silently refreshes on mount and loads user + business', async () => {
    api.post.mockResolvedValueOnce({ data: { data: { accessToken: 'tok' } } });
    api.get.mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u1', email: 'o@test.com', role: 'owner' },
          business: { id: 'b1', name: 'My Shop', plan: 'free' },
        },
      },
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('o@test.com'));
    expect(screen.getByTestId('business').textContent).toBe('My Shop');
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(setAccessToken).toHaveBeenCalledWith('tok');
    expect(api.post).toHaveBeenCalledWith('/auth/refresh');
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });

  it('ends unauthenticated when refresh fails', async () => {
    api.post.mockRejectedValueOnce(new Error('no cookie'));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });

  it('login sets user and business from response', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'tok',
          user: { id: 'u1', email: 'o@test.com', role: 'owner' },
          business: { id: 'b1', name: 'My Shop', plan: 'free' },
        },
      },
    });
    let ctx;
    const LoginProbe = () => {
      ctx = useAuth();
      return null;
    };
    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>
    );
    await waitFor(() => expect(ctx.loading).toBe(false));
    await act(async () => {
      await ctx.login('o@test.com', 'secret123');
    });
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'o@test.com', password: 'secret123' });
    expect(ctx.user.email).toBe('o@test.com');
    expect(ctx.business.name).toBe('My Shop');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/context/AuthContext.test.jsx`
Expected: FAIL — `Cannot find module './AuthContext'`

- [ ] **Step 3: Write the API client**

Create `client/src/api/client.js`:

```js
import axios from 'axios';

let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthRoute = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise || api.post('/auth/refresh');
        const { data } = await refreshPromise;
        refreshPromise = null;
        const newToken = data.data.accessToken;
        setAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        refreshPromise = null;
        setAccessToken(null);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 4: Write the AuthContext**

Create `client/src/context/AuthContext.jsx`:

```jsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { setAccessToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const silentRefresh = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.data.accessToken);
        const me = await api.get('/auth/me');
        if (!cancelled) {
          setUser(me.data.data.user);
          setBusiness(me.data.data.business);
        }
      } catch {
        setAccessToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    silentRefresh();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    setBusiness(data.data.business);
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    setBusiness(data.data.business);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
    setAccessToken(null);
    setUser(null);
    setBusiness(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, business, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/context/AuthContext.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add client/src/api client/src/context && git commit -m "feat: add axios client with token refresh and AuthContext"
```

---

### Task 9: Login and Register pages

**Files:**
- Create: `client/src/pages/Login.jsx`, `client/src/pages/Register.jsx`
- Test: `client/src/pages/authPages.test.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 8), `.glass`, `.glass-input`, `.btn-primary` classes (Task 7)
- Produces: `Login` — glass card with labeled `email`/`password` inputs, error banner, submit button "Sign in", link to `/register`. `Register` — labeled `businessName`/`name`/`email`/`password` inputs, submit "Create account", link to `/login`. Both call context `login`/`register` then navigate to `/dashboard`; server errors shown from `err.response.data.message`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/authPages.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';
import Register from './Register';

const mockLogin = vi.fn().mockResolvedValue(undefined);
const mockRegister = vi.fn().mockResolvedValue(undefined);

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

describe('Login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders labeled fields and submits credentials', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'o@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('o@test.com', 'secret123'));
  });

  it('shows server error message on failure', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { message: 'Invalid email or password' } } });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'o@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});

describe('Register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders labeled fields and submits registration payload', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/business name/i), { target: { value: 'My Shop' } });
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Shubham' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 's@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith({
        businessName: 'My Shop',
        name: 'Shubham',
        email: 's@test.com',
        password: 'secret123',
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/pages/authPages.test.jsx`
Expected: FAIL — `Cannot find module './Login'`

- [ ] **Step 3: Write the Login page**

Create `client/src/pages/Login.jsx`:

```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Is the server running?');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-primary">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in to your business account</p>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="glass-input mt-1"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="glass-input mt-1"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          New here?{' '}
          <Link to="/register" className="font-semibold text-primary">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the Register page**

Create `client/src/pages/Register.jsx`:

```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ businessName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Is the server running?';
      const details = err.response?.data?.errors?.length ? ` (${err.response.data.errors.join(', ')})` : '';
      setError(message + details);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-primary">Create your account</h1>
        <p className="mt-1 text-sm text-gray-600">Set up your business in under a minute</p>
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="businessName" className="text-sm font-medium text-gray-700">
              Business name
            </label>
            <input id="businessName" type="text" required className="glass-input mt-1"
              value={form.businessName} onChange={set('businessName')} />
          </div>
          <div>
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Your name
            </label>
            <input id="name" type="text" required className="glass-input mt-1"
              value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label htmlFor="reg-email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input id="reg-email" type="email" required className="glass-input mt-1"
              value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label htmlFor="reg-password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input id="reg-password" type="password" required minLength={8} className="glass-input mt-1"
              value={form.password} onChange={set('password')} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npx vitest run src/pages/authPages.test.jsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add client/src/pages && git commit -m "feat: add glass-styled login and register pages"
```

---

### Task 10: AppShell, protected routing, placeholder pages

**Files:**
- Create: `client/src/components/AppShell.jsx`, `client/src/components/PlaceholderPage.jsx`
- Modify: `client/src/App.jsx`
- Test: `client/src/App.test.jsx`, `client/src/components/AppShell.test.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 8), `Login`/`Register` (Task 9), theme classes (Task 7)
- Produces:
  - `App` routes: `/login`, `/register` public; everything else protected — unauthenticated → redirect `/login`; authenticated → `AppShell` with nested routes `/dashboard`, `/sales`, `/expenses`, `/customers`, `/suppliers`, `/products`, `/reports`, `/staff`, `/settings`, `/subscription` (all `PlaceholderPage`), `*` → `/dashboard`.
  - `AppShell`: glass sidebar with business name + plan; nav items filtered by role — owner sees all 10, staff sees Dashboard, Sales, Expenses, Customers, Suppliers, Products only; Logout button; mobile topbar.
  - `PlaceholderPage({ title })`: glass card with title + "This section is coming in the next phase."

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/AppShell.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppShell from './AppShell';

const mockAuth = {
  user: { role: 'owner', name: 'Owner' },
  business: { name: 'Owner Shop', plan: 'free' },
  logout: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const renderShell = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<AppShell />} />
      </Routes>
    </MemoryRouter>
  );

describe('AppShell', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows all nav items for owner', () => {
    renderShell();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Suppliers')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('Owner Shop')).toBeInTheDocument();
  });

  it('hides owner-only nav items for staff', () => {
    mockAuth.user = { role: 'staff', name: 'Staff' };
    renderShell();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.queryByText('Reports')).toBeNull();
    expect(screen.queryByText('Staff')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();
    expect(screen.queryByText('Subscription')).toBeNull();
    mockAuth.user = { role: 'owner', name: 'Owner' };
  });
});
```

Create `client/src/App.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

vi.mock('./api/client', () => ({
  default: {
    post: vi.fn().mockRejectedValue(new Error('no server')),
    get: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

describe('App routing', () => {
  it('redirects unauthenticated users to login', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/App.test.jsx src/components/AppShell.test.jsx`
Expected: FAIL — `Cannot find module './AppShell'`

- [ ] **Step 3: Write PlaceholderPage and AppShell**

Create `client/src/components/PlaceholderPage.jsx`:

```jsx
export default function PlaceholderPage({ title }) {
  return (
    <div className="glass p-8">
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      <p className="mt-2 text-gray-600">This section is coming in the next phase.</p>
    </div>
  );
}
```

Create `client/src/components/AppShell.jsx`:

```jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/sales', label: 'Sales', icon: '🧾' },
  { to: '/expenses', label: 'Expenses', icon: '💸' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/suppliers', label: 'Suppliers', icon: '🚚' },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/reports', label: 'Reports', icon: '📈', ownerOnly: true },
  { to: '/staff', label: 'Staff', icon: '🧑‍💼', ownerOnly: true },
  { to: '/settings', label: 'Settings', icon: '⚙️', ownerOnly: true },
  { to: '/subscription', label: 'Subscription', icon: '⭐', ownerOnly: true },
];

export default function AppShell() {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const items = NAV_ITEMS.filter((item) => !item.ownerOnly || user?.role === 'owner');

  return (
    <div className="flex min-h-screen">
      <aside className="glass m-4 mr-0 hidden w-60 shrink-0 flex-col p-4 md:flex">
        <div className="mb-6 px-2">
          <p className="text-lg font-bold text-primary">{business?.name || 'My Business'}</p>
          <p className="text-xs text-gray-500">
            {business?.plan === 'pro' ? 'Pro plan' : 'Free plan'}
          </p>
        </div>
        <nav className="flex-1 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary text-white shadow-glass' : 'text-gray-700 hover:bg-white/70'
                }`
              }
            >
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} className="btn-primary mt-4 w-full">
          Logout
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass m-4 mb-0 flex items-center justify-between px-6 py-3 md:hidden">
          <span className="font-bold text-primary">{business?.name || 'My Business'}</span>
          <button onClick={handleLogout} className="text-sm font-semibold text-primary">
            Logout
          </button>
        </header>
        <main className="m-4 flex-1 p-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire up App.jsx routing**

Replace `client/src/App.jsx`:

```jsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AppShell from './components/AppShell';
import PlaceholderPage from './components/PlaceholderPage';

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass px-8 py-4 font-medium text-primary">Loading…</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<PlaceholderPage title="Dashboard" />} />
        <Route path="/sales" element={<PlaceholderPage title="Sales" />} />
        <Route path="/expenses" element={<PlaceholderPage title="Expenses" />} />
        <Route path="/customers" element={<PlaceholderPage title="Customers" />} />
        <Route path="/suppliers" element={<PlaceholderPage title="Suppliers" />} />
        <Route path="/products" element={<PlaceholderPage title="Products" />} />
        <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
        <Route path="/staff" element={<PlaceholderPage title="Staff" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="/subscription" element={<PlaceholderPage title="Subscription" />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Run all client tests to verify they pass**

Run: `cd client && npx vitest run`
Expected: PASS (all files — theme, AuthContext, authPages, AppShell, App)

- [ ] **Step 6: Commit**

```bash
git add client/src && git commit -m "feat: add app shell with role-based nav and protected routing"
```

---

### Task 11: Root scripts, README, end-to-end verification

**Files:**
- Create: `package.json` (repo root), `README.md`
- Modify: none

**Interfaces:**
- Consumes: everything from Tasks 1–10
- Produces: `npm run install-all` (installs server + client deps), `npm run dev` (runs both via concurrently), README with setup + manual verification checklist.

- [ ] **Step 1: Create root package.json**

Create `package.json` at repo root:

```json
{
  "name": "acc-app-shubham",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "install-all": "npm install --prefix server && npm install --prefix client",
    "dev": "concurrently -n server,client -c green,blue \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "test:server": "npm test --prefix server",
    "test:client": "npx vitest run --prefix client"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

Run: `npm install` (repo root, installs concurrently)

- [ ] **Step 2: Create README**

Create `README.md`:

```markdown
# Acc App — Business Accounting SaaS

Multi-tenant MERN app for small Indian businesses: sales, expenses, customer khata,
suppliers, inventory, invoices, and reports with a light-green glassmorphism UI.

## Stack

- **Server:** Node.js, Express, MongoDB (Mongoose), JWT auth (access + refresh tokens)
- **Client:** React 18 (Vite), Tailwind CSS, React Router, axios, Recharts (later phase)

## Setup

1. Ensure MongoDB is running locally (or set `MONGO_URI` in `server/.env` to an Atlas URI).
2. `npm run install-all`
3. `npm run dev` — starts API on http://localhost:5000 and client on http://localhost:5173
   (the client proxies `/api` to the server, so cookies work in dev).

## Tests

- `npm run test:server` — Jest + Supertest + in-memory MongoDB
- `npm run test:client` — Vitest + React Testing Library

## Architecture

See `docs/superpowers/specs/2026-09-10-business-accounting-saas-design.md`.

Multi-tenancy: every business document carries `businessId`; the `authenticate` →
`tenantScope` → `requireRole` middleware chain scopes all queries to the caller's
business and gates owner-only operations.
```

- [ ] **Step 3: Run both test suites**

Run: `npm run test:server`
Expected: all server tests PASS

Run: `npm run test:client`
Expected: all client tests PASS

- [ ] **Step 4: Verify the API end-to-end with curl (no browser)**

Start both servers in one terminal: `npm run dev` (leave running).

In a second terminal, verify the full auth cycle:

```bash
curl -s -X POST http://localhost:5000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"businessName\":\"Curl Shop\",\"name\":\"Owner\",\"email\":\"curl@test.com\",\"password\":\"secret123\"}"
```

Expected: JSON with `success: true`, `data.accessToken`, `data.business.name` = "Curl Shop".

```bash
curl -s -X POST http://localhost:5000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"curl@test.com\",\"password\":\"secret123\"}"
```

Expected: `success: true` with a new accessToken.

Using the accessToken from login as `$TOKEN`:

```bash
curl -s http://localhost:5000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

Expected: user + business JSON.

```bash
curl -s -X PATCH http://localhost:5000/api/v1/business -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"gstin\":\"27ABCDE1234F1Z5\"}"
```

Expected: `success: true`, business with the GSTIN.

```bash
curl -s http://localhost:5000/api/v1/business
```

Expected: 401 (no token).

Stop the dev servers (Ctrl+C) when done.

- [ ] **Step 5: Hand UI verification to the user**

The agent must not open a browser (user rule). Ask the user to run `npm run dev`, open http://localhost:5173, and check:
1. Register page shows the glass card on the green gradient; registering lands on `/dashboard` with the business name in the sidebar.
2. Refreshing the page keeps them logged in (silent refresh).
3. Logout returns to `/login`; logging back in works.
4. All 10 nav items visible for the owner account.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json README.md && git commit -m "chore: add root dev scripts and README"
```

---

## Plan Self-Review (completed)

- **Spec coverage (Foundation scope):** auth (register/login/refresh/logout/me) ✓ Task 5; business settings endpoints ✓ Task 6 (logo upload deferred to Settings phase per spec's later-phase scope); tenant isolation ✓ Tasks 4+6; roles ✓ Tasks 4+6+10; glass theme ✓ Task 7; app shell + role-based nav ✓ Task 10; PWA manifest deferred to final phase (spec lists it under frontend polish). Data model users/businesses ✓ Task 2.
- **Placeholder scan:** no TBDs; every code step has full code; PlaceholderPage is a real v1 deliverable (routes exist, content arrives in Plans 2–4), not a plan placeholder.
- **Type consistency:** `useAuth()` shape `{ user, business, loading, login, register, logout }` used consistently in Tasks 8–10; envelope `{ success, message, data, errors }` consistent across all server tasks; `generateAccessToken(user)`/`generateRefreshToken(user)` signatures match between Task 4 and Task 5.
