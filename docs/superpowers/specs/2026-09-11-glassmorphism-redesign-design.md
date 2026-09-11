# Glassmorphism Depth Redesign — Design Document

**Date:** 2026-09-11
**Status:** Approved (design sections reviewed with stakeholder)
**Parent spec:** `docs/superpowers/specs/2026-09-10-business-accounting-saas-design.md`

## 1. Overview

Deepen the app's existing light glassmorphism UI into a rich, detailed, modern visual system while keeping the green/mint brand identity. This is a **visual depth pass only**: no new pages, no charts, no motion/animation, no changes to routes, logic, APIs, or the server.

The app already has a glass starter (`.glass`, `.glass-input`, `.btn-primary` in `client/src/index.css`, green tokens in `client/tailwind.config.js`). This redesign upgrades that foundation and applies it consistently across the app shell and all 14 pages, replacing emoji icons with a professional SVG icon set.

## 2. Confirmed Decisions

| Decision | Choice |
|---|---|
| Visual direction | Rich **light** glassmorphism, green/mint brand anchored; colorful multi-blob gradient background (mint/green with soft blue/lilac accents) |
| Scope | Depth pass only — refined cards, icons, badges, styled tables, skeleton loaders, polished empty states, nicer buttons. No charts, no page transitions, no hover tilt/lift motion |
| Icons | `lucide-react` SVG icon library replaces all emoji |
| Implementation | Approach 1: design tokens in `tailwind.config.js` + CSS component classes in `index.css` `@layer components`; pages apply classes. No shared-component extraction |
| Documents | This spec + `docs/ui-style-guide.md` + `docs/brain.md` + refreshed app docs (`ARCHITECTURE.md`, `API.md`, README) + implementation plan |
| Theme | Light only (no dark mode) |

## 3. Design System

### 3.1 Background — multi-blob gradient

The `body` background becomes a layered gradient stack, defined entirely in CSS (`client/src/index.css` `@layer base`). No extra DOM elements, no animation.

- **Base:** diagonal linear gradient `#E8F5E9` → `#F1F8F2` (existing identity)
- **Blob 1:** radial gradient, soft green `rgba(76, 175, 80, 0.20)`, top-left quadrant
- **Blob 2:** radial gradient, sky blue `rgba(64, 140, 255, 0.14)`, right edge, vertically centered
- **Blob 3:** radial gradient, lilac `rgba(167, 139, 250, 0.14)`, bottom-left
- **Blob 4:** radial gradient, pale teal `rgba(77, 208, 190, 0.12)`, bottom-right
- All layers `background-attachment: fixed` so the blobs stay put while panels scroll over them

### 3.2 Design tokens (`client/tailwind.config.js`)

Keep `primary: #2E7D32`, `accent: #4CAF50`, `mint`, `sage`. Add:

- `boxShadow.glass` — combined ambient + inset value used by `.glass` (Tailwind shadow utilities cannot stack; the class applies one `box-shadow` declaration): `0 8px 32px 0 rgba(31, 38, 135, 0.10), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)`
- `boxShadow.glass-lg` — elevated/hover variant, also combined: `0 12px 40px 0 rgba(31, 38, 135, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)`
- `boxShadow['btn-glow']` — soft green glow under primary buttons (`0 4px 16px 0 rgba(46, 125, 50, 0.30)`)

### 3.3 Component classes (`client/src/index.css` `@layer components`)

| Class | Style summary | Used for |
|---|---|---|
| `.glass` | `bg-white/55 backdrop-blur-xl border-white/60 rounded-2xl shadow-glass` (single combined shadow token) | Base panel: sidebar, header, form sections, detail blocks |
| `.glass-card` | `.glass` + interactive hover: shadow → `glass-lg`, background → `bg-white/70` | Dashboard stat cards, any clickable card |
| `.glass-input` | `bg-white/70`, `border-white/70`, focus ring `accent`/30, refined radius | All form inputs and selects |
| `.btn-primary` | Gradient fill `primary → accent` (135deg), white text, `shadow-btn-glow`, hover brightens gradient | Primary actions (Sign in, Record sale, Save) |
| `.btn-ghost` | Transparent with `border-white/60`, `text-primary`, hover `bg-white/60` | Secondary actions (quick actions, table row actions, Cancel) |
| `.btn-danger` | Red glass (`bg-red-500/90`), white text | Cancel sale, delete operations |
| `.badge` | Pill: `rounded-full px-2.5 py-0.5 text-xs font-semibold` | Base badge |
| `.badge-success` | `bg-green-100/80 text-green-700` | completed, paid, active |
| `.badge-danger` | `bg-red-100/80 text-red-700` | cancelled, overdue |
| `.badge-warning` | `bg-amber-100/80 text-amber-700` | pending, low stock |
| `.badge-neutral` | `bg-white/60 text-gray-600` | neutral states (cash, staff role) |
| `.skeleton` | `rounded-xl bg-white/50` with slow shimmer gradient pulse | Loading placeholders in tables and cards |
| `.empty-state` | Centered column: lucide icon in tinted glass circle, semibold title, gray hint | Empty lists on all pages |
| `.glass-table` | Table wrapper class: `thead` cells `bg-white/40`, rows `hover:bg-white/40`, row dividers `border-white/50` | All data tables |

### 3.4 Iconography — lucide-react

Replace every emoji with a lucide-react icon (18px in tables/badges, 20px in nav, 24–28px in stat cards and empty states):

| Location | Icon |
|---|---|
| Nav: Dashboard / Sales / Expenses / Customers / Suppliers / Products / Reports / Staff / Settings / Subscription | `LayoutDashboard` / `Receipt` / `Wallet` / `Users` / `Truck` / `Package` / `BarChart3` / `UserCog` / `Settings` / `Crown` |
| Dashboard stat cards | `TrendingUp` (Sales), `TrendingDown` (Expenses), `PiggyBank` (Profit), `IndianRupee` (Cash), `BookOpen` (To collect), `Landmark` (To pay) |
| Sidebar business header | `Store` |
| Auth pages | `LogIn` (login), `UserPlus` (register) |
| Empty states | Feature-relevant icons (`Receipt`, `Users`, `Package`, …) |

## 4. Screen-by-Screen Changes

### 4.1 AppShell (`client/src/components/AppShell.jsx`)

- Sidebar: `Store` icon beside the business name; plan displayed as a `.badge` (`badge-warning` for Free, `badge-success` for Pro)
- Nav items: lucide icons in a fixed-width icon container; active item = gradient pill (`bg-gradient-to-r from-primary to-accent` + `shadow-btn-glow`); inactive = `text-gray-700` with `hover:bg-white/70`
- Sidebar footer: avatar circle with user initials (`bg-gradient-to-r from-primary to-accent`), user name, `.badge-neutral` role chip, then Logout (`.btn-ghost`)
- Mobile header: same glass treatment, `Store` icon + name + Logout
- No structural, navigation, or role-filtering changes

### 4.2 Loading state (`client/src/App.jsx`)

Loading screen restyled: glass card with a `.skeleton` shimmer block.

### 4.3 Auth pages (Login, Register)

Centered `.glass` card with `LogIn`/`UserPlus` icon header, refined `.glass-input` fields, `.btn-primary` submit, `.badge`-styled error block (`.badge-danger` tones).

### 4.4 Dashboard

- Header: `LayoutDashboard` icon + "Dashboard" + segmented glass range toggle (Today / This month) with gradient active segment
- Six stat cards become `.glass-card` with: lucide icon in a tinted glass square (green/red/blue/orange per metric), uppercase label, large colored value, existing links intact
- Quick actions: first action `.btn-primary`, remaining `.btn-ghost`
- Loading: skeleton grid (6 `.skeleton` cards) instead of text

### 4.5 List pages (Sales, Customers, Suppliers, Products, Expenses, Staff)

- Page header: feature icon + title
- Tables → `.glass-table`: header row `bg-white/40`, row hover, `.badge` statuses (green for completed/active, red for cancelled), `.skeleton` rows while loading, `.empty-state` when empty
- Forms keep `.glass-input`; submit buttons `.btn-primary`; destructive buttons `.btn-danger`
- Example status mapping on Sales: `completed` → `.badge-success`, `cancelled` → `.badge-danger`

### 4.6 Detail pages (SaleDetail, CustomerDetail, SupplierDetail)

- Labeled info rows grouped in `.glass` blocks with small uppercase labels and values
- Status/plan/role → badges; amounts keep existing `formatINR` display
- Khata/statement tables → `.glass-table` with `.badge-success` (payment) / `.badge-danger` (credit)

### 4.7 Reports, Settings, Subscription

- Reports: report cards in `.glass-card` with icons
- Settings: form sections in `.glass`, save action `.btn-primary`
- Subscription: plan cards `.glass-card`, current plan highlighted with gradient border, features listed with `Check`/`X` lucide icons, Free/Pro as `.badge`

## 5. Testing

- Existing Vitest tests query by text/role/label — unaffected by class or icon changes; must keep passing unchanged
- `client/src/theme.test.jsx` extended: assert the AppShell renders with `.glass` sidebar and that a lucide icon (svg) is present
- New test: badge class renders for plan chip in sidebar
- Full `npm run test:client` + eslint pass required; visual verification via the running dev server is done by the user (no browser automation)

## 6. Out of Scope

- Dark mode / theme toggle
- Charts and dashboards data visuals
- Motion: page transitions, card lift/tilt, animated blobs (shimmer in `.skeleton` is the only animation)
- Shared React component extraction (`StatCard`, `PageHeader`, …) — candidate for a follow-up
- Any server, API, route, or data-logic change

## 7. Files Touched

| File | Change |
|---|---|
| `client/package.json` | Add `lucide-react` dependency |
| `client/tailwind.config.js` | Add shadow/inset/glow tokens |
| `client/src/index.css` | Blob gradient background; upgraded + new component classes |
| `client/src/components/AppShell.jsx` | Icons, badges, avatar, gradient active nav |
| `client/src/App.jsx` | Loading screen restyle |
| `client/src/pages/*.jsx` (14 files) | Apply design system: icons, badges, tables, skeletons, empty states |
| `client/src/theme.test.jsx` | Extend assertions |
| `docs/ui-style-guide.md` | New — standalone UI style guide |
| `docs/brain.md` | New — master project context (see plan) |
| `docs/ARCHITECTURE.md`, `docs/API.md`, `README.md` | New/refreshed app documentation |
