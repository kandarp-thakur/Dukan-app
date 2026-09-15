# UI Style Guide — Glass Design System

**App:** Acc App (business accounting SaaS)
**Theme:** Rich light glassmorphism, green/mint brand
**Source of truth:** `client/tailwind.config.js` (tokens) + `client/src/index.css` (`@layer components` classes)
**Spec:** `docs/superpowers/specs/2026-09-11-glassmorphism-redesign-design.md`

This guide documents the visual language so any page (current or future) can be styled consistently without re-inventing styles.

## 1. Color Palette

### Brand

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#2E7D32` | Deep green — headings, links, active states, gradient start |
| `accent` | `#4CAF50` | Fresh green — gradient end, focus rings, hover states |
| `mint` | `#E8F5E9` | Background base start |
| `sage` | `#F1F8F2` | Background base end |

### Background blobs (ambient accents)

| Color | Approx. value | Position |
|---|---|---|
| Soft green | `rgba(76, 175, 80, 0.20)` | top-left |
| Sky blue | `rgba(64, 140, 255, 0.14)` | right, center |
| Lilac | `rgba(167, 139, 250, 0.14)` | bottom-left |
| Pale teal | `rgba(77, 208, 190, 0.12)` | bottom-right |

### Semantic (status colors)

| Meaning | Background | Text | Badge class |
|---|---|---|---|
| Positive (completed, paid, active, Pro) | `bg-green-100/80` | `text-green-700` | `.badge-success` |
| Negative (cancelled, credit owed, overdue) | `bg-red-100/80` | `text-red-700` | `.badge-danger` |
| Caution (pending, low stock, Free plan) | `bg-amber-100/80` | `text-amber-700` | `.badge-warning` |
| Neutral (cash, staff role, inactive) | `bg-white/60` | `text-gray-600` | `.badge-neutral` |

Stat card accents: sales `text-green-600`, expenses `text-red-600`, profit `text-primary`, cash `text-blue-600`, receivable `text-orange-600`, payable `text-red-700`.

## 2. Background Recipe

One `background-image` stack on `body` (plus `background-attachment: fixed`), defined in `index.css` `@layer base`:

```css
body {
  background-image:
    radial-gradient(...), /* blob 1: soft green, top-left */
    radial-gradient(...), /* blob 2: sky blue, right */
    radial-gradient(...), /* blob 3: lilac, bottom-left */
    radial-gradient(...), /* blob 4: pale teal, bottom-right */
    linear-gradient(135deg, #E8F5E9 0%, #F1F8F2 100%); /* base */
}
```

Glass panels float over this. Never add blob DOM elements — the background is pure CSS.

## 3. Shadows

| Token | Value | Usage |
|---|---|---|
| `shadow-glass` | `0 8px 32px 0 rgba(31, 38, 135, 0.10), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)` | Resting panels (`.glass`) — ambient + inner top highlight combined in ONE value (Tailwind shadow utilities cannot stack) |
| `shadow-glass-lg` | `0 12px 40px 0 rgba(31, 38, 135, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)` | Elevated/hover panels (`.glass-card:hover`) |
| `shadow-btn-glow` | `0 4px 16px 0 rgba(46, 125, 50, 0.30)` | Under `.btn-primary` and active nav pill |

## 4. Component Classes

All classes live in `index.css` `@layer components` and combine Tailwind utilities.

### 4.1 `.glass` — base panel

`bg-white/55 backdrop-blur-xl border border-white/60 rounded-2xl shadow-glass`

(`shadow-glass` is the single combined ambient + inset token — see §3.)

Use for: sidebar, mobile header, form sections, detail info blocks, loading card, segment toggles, error blocks (with `.badge-danger` tone).

### 4.2 `.glass-card` — interactive card

`.glass` + `transition` + hover: `shadow-glass-lg` (elevated combined token) and `bg-white/70`.

Use for: dashboard stat cards (wrapped in `<Link>`), report cards, subscription plan cards. No lift/tilt — shadow and tint only.

### 4.3 `.glass-input` — form control

`w-full rounded-xl border border-white/70 bg-white/70 px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30`

Use for every `<input>` and `<select>`. Labels: `text-sm font-medium text-gray-700` above the field.

### 4.4 Buttons

| Class | Look | Use |
|---|---|---|
| `.btn-primary` | 135deg gradient `primary→accent`, white text, `shadow-btn-glow`; hover brightens | One per view: Sign in, Record sale, Save |
| `.btn-ghost` | Transparent, `border-white/60`, `text-primary`, hover `bg-white/60` | Secondary: quick actions, table row links, Cancel |
| `.btn-danger` | `bg-red-500/90`, white text | Cancel sale, Delete |

Buttons share `rounded-xl px-4 py-2.5 font-semibold` sizing. Disabled: `disabled:opacity-60`.

### 4.5 Badges

Base `.badge` = `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold`, plus one of `.badge-success` / `.badge-danger` / `.badge-warning` / `.badge-neutral` (§1 semantic table).

Examples: sale status, khata entry type, plan chip, role chip, low-stock flag.

### 4.6 `.skeleton` — loading placeholder

`animate-pulse rounded-xl bg-white/50` (slow shimmer via Tailwind's `animate-pulse`). Use `h-*` utilities for height (e.g. `h-16` for a stat card, `h-8` for a table row).

Use while data loads instead of text "Loading…". The shimmer is the only animation in the system.

### 4.7 `.empty-state` — empty lists

Centered column: lucide icon inside a tinted glass circle (`bg-white/60 rounded-full p-3`), semibold title, gray hint text. Example:

```jsx
<div className="empty-state">
  <Receipt size={28} className="text-primary" />
  <p className="font-semibold">No sales yet</p>
  <p className="text-sm text-gray-500">Record your first sale above.</p>
</div>
```

### 4.8 `.glass-table` — data tables

Wrapper class on the table container. Rules:

- `thead` row: `bg-white/40`, `text-xs uppercase tracking-wide text-gray-500`
- Row dividers: `border-t border-white/50`
- Row hover: `hover:bg-white/40`
- Cell padding: `py-3` (rows), `pb-3` (header)
- Amounts: right-aligned `font-semibold` with `formatINR`
- Row actions: `.btn-ghost` mini buttons (`px-3 py-1.5 text-xs`)
- Status cells: `.badge-*`

## 5. Iconography (lucide-react)

Sizes: 20px nav, 18px tables/badges, 24px page headers, 28px stat cards and empty states.

| Area | Icons |
|---|---|
| Nav | `LayoutDashboard` `Receipt` `Wallet` `Users` `Truck` `Package` `BarChart3` `UserCog` `Settings` `Crown` |
| Dashboard stats | `TrendingUp` `TrendingDown` `PiggyBank` `IndianRupee` `BookOpen` `Landmark` |
| Misc | `Store` (business), `LogIn` `UserPlus` (auth), `Check` `X` (plan features) |

Icons inherit text color (`className="text-primary"` etc.). Stat-card icons sit in a tinted glass square: `bg-white/60 rounded-xl p-2.5`.

## 6. Typography

- Page titles: `text-2xl font-bold text-primary` (+ optional icon at 24px)
- Section titles: `text-lg font-semibold` or uppercase `text-sm font-semibold tracking-wide text-gray-500`
- Values: `text-3xl font-bold` + semantic color
- Body/labels: `text-sm`; hints `text-sm text-gray-500`; uppercase labels `text-xs font-semibold uppercase tracking-wide text-gray-500`

## 7. Layout

- Sidebar (`.glass`): `m-4 mr-0 w-60` hidden on mobile
- Content: `m-4` with `space-y-6` page rhythm, cards `p-6`
- Auth/loading: full-screen centered `max-w-md` glass card
- Grids: stat cards `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` with `gap-4`

## 8. Recipes (per-surface checklist)

- **New page:** `.glass` sections, page-title pattern, `.glass-input` forms, `.glass-table` lists, `.skeleton` loading, `.empty-state` empty, one `.btn-primary` + `.btn-ghost` secondaries
- **Status pill:** `<span className="badge badge-success">completed</span>`
- **Stat card:** `.glass-card` + icon square + uppercase label + `text-3xl` colored value
- **Never:** emoji icons, motion beyond `animate-pulse`, non-glass opaque panels, raw ad-hoc shadows

## 9. Public (marketing) surface

The public pages — `/` (landing), `/login`, `/register` — share `PublicLayout`
(`client/src/components/PublicLayout.jsx`): `PublicNavbar` + `<main>` + `PublicFooter`.

- The navbar is transparent only on `/` (it floats over the hero) and becomes
  solid after 16px of scroll; on auth pages it is always solid.
- The hero's 3D scene is decorative: its wrapper is `aria-hidden="true"` and it
  is mounted only when `shouldUse3D()` passes (WebGL present, >= 768px wide, no
  reduced-motion preference). Otherwise `HeroFallback` renders instead.
- Landing sections reuse the app's components verbatim: `.glass`, `.glass-card`,
  `.btn-primary`, `.btn-ghost`, `.badge-*`.
- Pricing mirrors the server plan catalog; `PricingSection` exports
  `FALLBACK_PLANS` and reads `/plans` when available.
