# Public Landing Page with 3D Hero — Design Spec

**App:** Acc App (business accounting SaaS)
**Date:** 2026-09-15
**Status:** Approved (ready for implementation plan)
**Path:** Architectural (brainstormed in chat, section by section)

## 1. Context

Today the client has **no public entry point**. Every path except `/login`,
`/register`, and `/i/:token` falls into a catch-all that renders
`ProtectedRoutes`; an unauthenticated visit to `/` is immediately redirected
to `/login`. The only navigation in the product is the authenticated
sidebar in `AppShell`.

This spec adds a public marketing surface — a landing page at `/` with a 3D
hero, a shared public navbar, and refreshed Login/Register pages — without
changing the authenticated application tree.

## 2. Goals

- A public landing page at `/` with a 3D hero, features, pricing, a final
  CTA, and a footer.
- One shared public navbar used by both the landing page and the auth pages.
- Revamped Login and Register pages that share that navbar and match the
  3D landing aesthetic.
- The 3D hero must never block first paint, never run where it cannot work,
  and never make the page inaccessible or untestable.

## 3. Non-goals

- No new marketing routes (`/pricing`, `/about`). The lean section set lives
  on `/` only.
- No change to the authenticated app: `ProtectedRoutes`, `RequireOwner`,
  `AppShell`, and every app page stay as they are.
- No payment flow. There is no gateway in v1 and Pro upgrade only files a
  pending request; the landing page must not imply an immediate purchase.
- No replacement of the in-app sidebar with a top navbar.
- No post-processing/bloom in v1.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Introduce a `PublicLayout` route group owning `/`, `/login`, `/register` | One shell for all public pages; the authenticated tree never moves |
| D2 | `/` is public; a logged-in user is redirected to `/dashboard` | Locked in brainstorming; keeps the app one click away |
| D3 | 3D via `three` + `@react-three/fiber` + `@react-three/drei` | Chosen over CSS-only and over raw three.js |
| D4 | 3D loaded as a `React.lazy` island, hero only | three.js stays out of the main bundle; auth stays fast |
| D5 | One fallback component serves pre-load, no-WebGL, reduced-motion, and small screens | Single mechanism, single thing to test |
| D6 | Camera-fixed floating glass panels built from primitives | No image assets, no external model files |
| D7 | Pricing reads the public `GET /plans` with a static fallback constant | Landing copy cannot drift from the real catalog |
| D8 | Every 3D surface is `aria-hidden` decorative art | All meaning lives in real HTML |

## 5. Architecture

### 5.1 Routing

`/` becomes a public layout route; the catch-all stays authenticated.

```
App
├── AuthProvider
│   └── BrowserRouter
│       ├── Route "/"            element PublicLayout
│       │   ├── index            element LandingPage        (guest only)
│       │   ├── "login"          element Login
│       │   └── "register"       element Register
│       ├── Route "/i/:token"    element PublicInvoice
│       └── Route "/*"           element ProtectedRoutes
│           └── user ? AppShell : <Navigate to="/login">
```

- `ProtectedRoutes` is unchanged except that it is no longer reachable at `/`.
- Login and Register keep their existing submit handlers and their
  `navigate('/dashboard')` on success.
- A guest-only check on `/` sends an authenticated user to `/dashboard`.
  It is implemented inside the public group and does **not** touch
  `RequireOwner` or the app guard.

### 5.2 New units

| Unit | Path | Purpose | Depends on |
|---|---|---|---|
| `PublicNavbar` | `client/src/components/PublicNavbar.jsx` | Sticky nav; `Sign in` + `Get started`; transparent only when a hero is present, solid on auth pages or after scroll | `useAuth`, scroll listener |
| `PublicFooter` | `client/src/components/PublicFooter.jsx` | Brand line, product links, copyright | none |
| `PublicLayout` | `client/src/components/PublicLayout.jsx` | Navbar + `<Outlet/>` + footer shell | `PublicNavbar`, `PublicFooter` |
| `LandingPage` | `client/src/pages/LandingPage.jsx` | Composes sections; performs the guest redirect | sections, `useAuth` |
| `HeroSection` | `client/src/sections/HeroSection.jsx` | Headline, subhead, CTAs; hosts the lazy 3D island | `HeroScene` (lazy), `HeroFallback` |
| `HeroScene` | `client/src/components/HeroScene.jsx` | The `Canvas` + primitive glass panels (lazy chunk) | three, fiber, drei |
| `HeroFallback` | `client/src/components/HeroFallback.jsx` | Static CSS-3D glass art; the only fallback | none |
| `FeaturesSection` | `client/src/sections/FeaturesSection.jsx` | Feature grid from a local data array | `lucide-react` |
| `PricingSection` | `client/src/sections/PricingSection.jsx` | Free/Pro cards from live plans with static fallback | `plansApi`, `formatINR` |
| `CtaSection` | `client/src/sections/CtaSection.jsx` | Final call to action | `react-router-dom` |
| `webglSupport` | `client/src/utils/webglSupport.js` | Pure helper: can this environment render WebGL | none |

### 5.3 Modified files

- `client/src/App.jsx` — add the public route group.
- `client/src/pages/Login.jsx` — remove its own full-screen centering so it
  composes inside `PublicLayout`.
- `client/src/pages/Register.jsx` — same.
- `client/src/App.test.jsx` — the guest-at-`/` expectation changes from
  "Welcome back" to the landing headline; a case is kept proving protected
  app routes still redirect to `/login`.
- `client/src/index.css` — a small `@layer components` addition for the
  navbar scroll state and the hero CSS-3D perspective.

## 6. The 3D Hero

### 6.1 Scene

Three to four rounded panels floating in shallow perspective, each a
simplified abstract mini-UI drawn with thin colored boxes: a header bar, a
few rows, a green trend line. Rendered with a physical material at partial
transmission (target ~0.4) rather than full transmission, which is the
dominant GPU cost for the least structural value here. Motion is a gentle
drift plus light mouse parallax through `useFrame`. Lighting is a soft key
light plus a green rim light using the brand tokens (`#2E7D32`, `#4CAF50`).
The camera is fixed.

**No texture files. No `.glb`/`.gltf` model files.** Everything is geometry
and material, so there is no asset pipeline and no download beyond the JS
chunk.

### 6.2 Loading and fallback

`HeroSection` is the only place that knows about WebGL:

```
HeroSection
├── Suspense
│   ├── pending  -> HeroFallback        (CSS 3D)
│   └── loaded   -> HeroScene           (Canvas)
└── gate: reduced-motion | small viewport | !webglSupport()
        -> HeroFallback                 (CSS 3D)
```

- `const HeroScene = lazy(() => import('../components/HeroScene'))` — Vite
  emits three.js as a separate chunk fetched after first paint.
- The Suspense fallback **is** `HeroFallback`; the runtime gate renders the
  same component. One fallback, four entry paths: chunk-pending,
  no-WebGL, reduced-motion, small screen.
- The gate conditions are: `prefers-reduced-motion: reduce` matches, the
  viewport width is below `768px` (Tailwind `md`), or the WebGL probe fails.
- `HeroFallback` is static markup using existing `.glass` classes plus CSS
  `perspective`/`preserve-3d` tilt. It has no WebGL dependency and renders
  in jsdom.

### 6.3 Performance

- `dpr={[1, 1.75]}` capped on the `Canvas`.
- The canvas pauses when the hero scrolls out of view (IntersectionObserver)
  so nothing animates offscreen.
- No post-processing in v1.
- Success criterion: the three.js chunk does not appear in the entry chunk
  after `npm run build`.

### 6.4 Accessibility

- The entire hero visual is `aria-hidden="true"`; there are no interactive 3D
  controls and nothing inside the canvas is keyboard-reachable.
- Headline, subhead, and both CTAs are real HTML and are present in **both**
  the WebGL and the fallback states.
- `prefers-reduced-motion` yields a static scene.
- Contrast and type follow the existing glass design system.

## 7. Page Content

1. **Hero** — `<h1>` headline, one-sentence subhead, primary
   `Get started` → `/register`, secondary `Sign in` → `/login`, decorative
   3D art.
2. **Features** — six items drawn only from shipped capability, each with a
   `lucide-react` icon: Sales & invoicing, GST invoices, Expenses,
   Customers & khata, Suppliers & purchases, Reports & dashboard. Title plus
   one line each. No roadmap or invented features.
3. **Pricing** — Free and Pro cards from live data (see §8).
4. **Final CTA** — one line plus `Get started`.
5. **Footer** — product links (`/`, `/login`, `/register`), a short brand
   line, and a copyright with the current year.

Brand name in copy: **Acc App** (from `client/index.html`).

## 8. Pricing Data Flow

```
PricingSection mount
  -> plansApi.list()            GET /plans   (public, no auth)
  -> success: render server PLANS (free 0, pro 19900 paise + features)
  -> failure or empty: render FALLBACK_PLANS constant
```

- Prices are paise integers rendered through the existing `formatINR`
  helper, so the landing page and the in-app Subscription page cannot show
  different prices for the same plan.
- `FALLBACK_PLANS` mirrors the server `PLANS` shape.
- Because v1 has no payment gateway and Pro upgrade only files a pending
  request, the Pro card CTA is `Get started` → `/register`. It is never
  labelled "Buy now" or "Subscribe now".

## 9. Styling

Follow `docs/ui-style-guide.md` exactly:

- Panels: `.glass`; interactive cards: `.glass-card` (hover = shadow and
  tint only, no tilt).
- Buttons: `.btn-primary` (one per view) and `.btn-ghost`.
- Plan chip: `.badge-success` for Pro, `.badge-warning` for Free.
- Tokens come from `client/tailwind.config.js`; the page inherits the mint
  to sage gradient `body` background so marketing and app read as one product.
- New CSS is limited to the navbar transparent-to-solid transition and the
  hero fallback perspective, both in `@layer components`.

## 10. Testing

Vitest + Testing Library under jsdom. No test may require WebGL.

| Test | Asserts |
|---|---|
| `PublicNavbar.test.jsx` | Guest sees Sign in + Get started with correct `href`s; scroll toggles the solid state |
| `LandingPage.test.jsx` | Guest sees the headline and every section; an authenticated user is redirected to `/dashboard` |
| `PricingSection.test.jsx` | Renders plans from a mocked `plansApi.list()`; falls back to `FALLBACK_PLANS` on rejection |
| `HeroSection.test.jsx` | Headline and CTA links present with the lazy scene module mocked; visual region is `aria-hidden` |
| `webglSupport.test.js` | Probe returns false when canvas contexts are unavailable, as in jsdom |
| `App.test.jsx` (updated) | Guest at `/` sees the landing page; an unauthenticated app route still redirects to `/login` |

Suite-level criterion: the existing 136 client tests still pass, plus the new
ones. Build criterion: `npm run build` emits the three.js chunk separately
(§6.3).

## 11. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| three.js chunk inflates the page | Lazy island, hero only, verified separate chunk after build |
| WebGL unsupported or disabled | Runtime probe falls back to static CSS art before any canvas mounts |
| Reduced-motion users get animation | Gate renders the static fallback |
| jsdom cannot render WebGL | Lazy module mocked in tests; scene never mounts in the test env |
| Landing copy drifts from real pricing | Pricing reads `/plans` with a mirroring fallback constant |
| Landing implies a purchase flow that does not exist | Pro CTA is `Get started`, never "Buy now" |
| Adding `/` breaks an existing routing test | `App.test.jsx` is updated deliberately, and a protected-route case is kept |

## 12. Out of Scope

- Marketing routes beyond `/`.
- SEO/meta/Open Graph work and prerendering (noted as a possible follow-up).
- Analytics.
- Post-processing effects.
- Any server change.
