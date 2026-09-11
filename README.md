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
