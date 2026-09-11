# Acc App — Business Accounting SaaS

Multi-tenant MERN app for small Indian businesses: sales, expenses, customer khata,
suppliers, inventory, invoices, and reports with a rich light-green glassmorphism UI.

## Stack

- **Server:** Node.js, Express, MongoDB (Mongoose), JWT auth (access + refresh tokens)
- **Client:** React 18 (Vite), Tailwind CSS, React Router, axios, lucide-react icons

## Setup

1. Ensure MongoDB is running locally (or set `MONGO_URI` in `server/.env` to an Atlas URI).
2. `npm run install-all`
3. `npm run dev` — starts API on http://localhost:5000 and client on http://localhost:5173
   (the client proxies `/api` to the server, so cookies work in dev).

## Tests

- `npm run test:server` — Jest + Supertest + in-memory MongoDB
- `npm run test:client` — Vitest + React Testing Library

## Documentation

Read [`docs/brain.md`](docs/brain.md) first — it is the master project context
(what the app is, decisions, layout, current state, roadmap).

| Doc | Covers |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, multi-tenancy, data model, request lifecycle |
| [`docs/API.md`](docs/API.md) | Full REST API reference |
| [`docs/ui-style-guide.md`](docs/ui-style-guide.md) | Glass design system: colors, tokens, component classes, recipes |
| [`docs/superpowers/specs/`](docs/superpowers/specs/) | Design specs (product + UI redesign) and implementation plans |

Multi-tenancy: every business document carries `businessId`; the `authenticate` →
`tenantScope` → `requireRole` middleware chain scopes all queries to the caller's
business and gates owner-only operations.
