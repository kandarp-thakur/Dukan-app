# Deployment Runbook — Atlas + Render + Vercel

This project deploys as three independent tiers, each from the same Git repo:

| Tier | Platform | What it runs | Root dir |
|---|---|---|---|
| Database | **MongoDB Atlas** | Managed MongoDB cluster | — |
| Backend | **Render** (Web Service) | Node/Express API | `server/` |
| Frontend | **Vercel** | React/Vite static build | `client/` |

```
Browser
  │
  ├─► Frontend (Vercel)                 VITE_API_URL = https://acc-app-api.onrender.com/api/v1
  │        │
  │        ▼
  └─► Backend (Render Web Service)      start: node src/server.js  (PORT injected by Render)
           │  CLIENT_URL + SHARE_LINK_BASE_URL = the Vercel URL
           ▼
        MongoDB Atlas                   MONGO_URI = mongodb+srv://user:pass@cluster/acc-app
```

> **Free-tier note:** Render's free web service sleeps after ~15 min idle, so the
> first request after inactivity takes ~30–50s to wake. Upgrade to a paid
> instance if you need always-on. Chosen Render region must be reasonably close
> to your Atlas region and your users.

---

## Prerequisites

Collect these before you start:

- A **Git repo** (GitHub/GitLab/Bitbucket) with push access to this code.
- A **MongoDB Atlas** account.
- A **Render** account (sign in with GitHub is easiest).
- A **Vercel** account (sign in with GitHub is easiest).
- Two strong random secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
  Generate them with:
  ```sh
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
  Run it twice — one value for each variable. Never reuse, never commit.
- *(Optional)* SMTP credentials for invoice email (see step 5).

---

## Step 0 — Push the repo

If the code is not yet on a remote:

```sh
git init
git add .
git commit -m "chore: add deployment config"
git branch -M main
git remote add origin https://github.com/<you>/acc-app-shubham.git
git push -u origin main
```

Confirm `.env` files are **not** tracked (`git status` should not list any real
`.env`). Only the `.example` templates are committed.

---

## Step 1 — MongoDB Atlas (database)

1. Create a free **M0** cluster at <https://cloud.mongodb.com>. Choose the region
   closest to your Render region.
2. **Database Access** → *Add New Database User*:
   - Authentication: Password.
   - Username: e.g. `acc-app-user`; generate a strong password and save it.
   - Privileges: *Read and write to any database* (or scope it to `acc-app`).
3. **Network Access** → *Add IP Address*. What you add depends on how your Render
   service gets its outbound IP:

   - **Free tier, or no static IP add-on:** Render's egress IPs are dynamic and
     unpublished, so there is no specific range to allowlist. Add
     **`0.0.0.0/0`** (*Allow access from anywhere*). Your defence is then the
     Atlas database user: keep it scoped to read/write on `acc-app` only, with a
     strong unique password.
   - **Static IP add-on attached:** do **not** use `0.0.0.0/0`. Add **only** the
     CIDR blocks listed under that service's **Connect → Outbound IP addresses**.
     Those blocks are assigned to your service and are the only addresses it will
     ever connect from.

   > Not sure which case applies? Open the service's **Connect** tab. A service
   > without a static IP add-on lists no outbound addresses at all.
   >
   > **Fastest way to settle it:** from the Render Shell run `npm run db:check`
   > (see step 2). It prints the egress IP MongoDB is actually seeing, so you
   > allowlist the real address instead of guessing. A green `PASS` there means
   > this step is already correct.
   >
   > ⚠️ **Never allowlist IPs from another provider, from your own ISP, or copied
   > from a blog post.** The allowlist is matched against the *source* address of
   > the incoming connection. If the ranges do not match what Render reports for
   > *this specific service*, MongoDB rejects every connection from Render and you
   > get `MongoServerSelectionError` / timeouts — i.e. adding the wrong range is
   > worse than adding none.
   >
   > Note this is a **separate concern from `MONGO_URI` being unset**. If the
   > process exits `1` on boot, it never reached the network and no allowlist
   > change can help (see *Troubleshooting*).
4. **Database** → *Connect* → *Drivers* → copy the connection string. It looks like:
   ```
   mongodb+srv://acc-app-user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Append the database name `/acc-app` before the `?` and URL-encode the password
   (special characters like `@`, `:`, `/`, `#` must be percent-encoded). Final form:
   ```
   mongodb+srv://acc-app-user:<password>@cluster0.xxxxx.mongodb.net/acc-app?retryWrites=true&w=majority
   ```
   This is your **`MONGO_URI`**.

---

## Step 2 — Render (backend)

> ⚠️ **Root Directory must be `server`.** This is the single most common cause of
> the backend crashing on boot with:
> ```
> Error: Cannot find module '/opt/render/project/src/src/server.js'
> ```
> Render clones the repo to `/opt/render/project/src`. If **Root Directory** is
> left blank (or set to the repo root), the start command `node src/server.js`
> resolves against the repo root and appends another `src/` — looking for
> `…/src/src/server.js`, which does not exist. The API entry point is
> [`server/src/server.js`](../server/src/server.js:1).
>
> Two tell-tale signs that the service is running on dashboard defaults and is
> **not** reading [`render.yaml`](../render.yaml) (i.e. it was created as a manual
> **Web Service** rather than via **Blueprint**): the crash log prints a Node
> version other than the pinned `20` (e.g. `Node.js v24.x`), and the **Root
> Directory** field is empty.

1. Render dashboard → **New +** → **Blueprint** (or **Web Service**).
2. Connect the Git repo. If you use **Blueprint**, Render reads
   [`render.yaml`](../render.yaml) and pre-fills root dir, build/start commands,
   health check, and env var keys. If you configure manually:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Health Check Path:** `/api/v1/health`
3. Set the environment variables (values from the table below). `sync: false`
   keys in `render.yaml` appear as blanks for you to fill.
4. Deploy. Wait for the build to finish and the service to report **Live**.
5. Copy the service URL, e.g. `https://acc-app-api.onrender.com`.

### Backend environment variables

**Required — the server exits `1` without them.** This is enforced at boot by
[`server/src/config/env.js`](../server/src/config/env.js:1), which reports *every*
missing variable in one message, so a single redeploy tells you everything you are
missing instead of surfacing one variable per attempt.

| Key | Value | Notes |
|---|---|---|
| `MONGO_URI` | `mongodb+srv://.../acc-app?...` | From step 1 |
| `JWT_ACCESS_SECRET` | 96-char hex | Generated above |
| `JWT_REFRESH_SECRET` | different 96-char hex | Generated above |

**Strongly recommended.** Without `CLIENT_URL` the API still boots and its health
check passes, but every request from the deployed frontend is rejected by CORS,
because [`server/src/app.js`](../server/src/app.js:15) silently falls back to
`http://localhost:5173`. A green health check with broken logins usually means
this variable is missing.

| Key | Value | Notes |
|---|---|---|
| `CLIENT_URL` | `https://<your-app>.vercel.app` | **Exact** Vercel URL — CORS origin. Set after step 3, then redeploy |
| `SHARE_LINK_BASE_URL` | same as `CLIENT_URL` | Base for public invoice links (`/i/:token`) |

**Optional — each has a working default or disables itself cleanly when unset:**

| Key | Value | Notes |
|---|---|---|
| `SHARE_LINK_TTL_DAYS` | `30` | Link expiry |
| `SMTP_HOST` | e.g. `smtp.gmail.com` | Optional — email only |
| `SMTP_PORT` | `587` | Optional |
| `SMTP_SECURE` | `false` | Optional (`true` for port 465) |
| `SMTP_USER` | your SMTP username | Optional |
| `SMTP_PASS` | your SMTP password / app password | Optional |
| `MAIL_FROM` | e.g. `Billing <billing@yourdomain.com>` | Optional |

> **Do not set `PORT`.** Render injects it and [`server/src/server.js`](../server/src/server.js:5)
> reads `process.env.PORT`.
>
> **Node version:** two mechanisms pin Node to 20. [`render.yaml`](../render.yaml:23)
> sets `NODE_VERSION=20`, but that applies **only to Blueprint-managed services**.
> Independently, a committed [`.node-version`](../server/.node-version) (present at
> both the repo root and `server/`) is honored by Render's Node runtime for **any**
> service type when it sits in the service root directory. A manual **Web Service**
> with **Root Directory** = `server` therefore also boots on Node 20. If the build
> log still shows `Using Node.js version <X> (default)` with an `<X>` other than
> `20`, the committed file is not being read — check that **Root Directory** is
> `server` (or the repo root), or set `NODE_VERSION` = `20` explicitly under the
> service's **Environment** tab.

**Verify the backend:**
```sh
curl https://acc-app-api.onrender.com/api/v1/health
# -> {"success":true,"message":"OK","data":null}
```

---

## Step 3 — Vercel (frontend)

> ⚠️ **Set Root Directory to `client`.** This is the single most common cause of a
> platform-level `404 NOT_FOUND` on the site. If Vercel builds the **repo root**
> instead of `client`, it never reads [`client/vercel.json`](../client/vercel.json),
> so the SPA rewrite is never applied and every deep link (`/login`, `/invoices`, …)
> — and often the whole site — 404s with Vercel's own error page.
>
> The repo also ships a **defensive root-level [`vercel.json`](../vercel.json)** that
> builds `client/dist` with the same rewrite, so a root-directory deployment still
> works. Even so, **Root Directory = `client`** is the recommended setting.

1. Vercel dashboard → **Add New…** → **Project** → import the Git repo.
2. **Root Directory:** `client` (see warning above). Framework preset should detect
   **Vite** (build `npm run build`, output `dist`).
   [`client/vercel.json`](../client/vercel.json) supplies these plus the SPA rewrite.
3. Add an **Environment Variable** (Production):
   - `VITE_API_URL` = `https://acc-app-api.onrender.com/api/v1`
     (include the `/api/v1` suffix).
4. Deploy. Copy the production URL, e.g. `https://acc-app-shubham.vercel.app`.

> **The build now fails fast if `VITE_API_URL` is missing.** [`client/vite.config.js`](../client/vite.config.js:1)
> aborts a `production` build when `VITE_API_URL` is unset, so a deployment can
> never silently ship a bundle that talks to the static host. If you run
> `npm run build --prefix client` locally you must export `VITE_API_URL` first.

The rewrite `"/((?!assets/).*)" → "/index.html"` sends every non-asset path to
`index.html` so client-side routes (`/invoices`, `/customers`, `/i/:token`, …)
survive a hard refresh instead of 404ing. Vercel still serves real static files
(`/vite.svg`, `/assets/*`) directly, because a rewrite only applies when no file
exists at the requested path.

---

## Step 4 — Wire CORS (close the loop)

The API allows only one origin — `CLIENT_URL` ([`server/src/app.js`](../server/src/app.js:15)).
Auth uses `credentials: true` cookies, so this must match exactly.

1. In Render, set `CLIENT_URL` and `SHARE_LINK_BASE_URL` to the Vercel URL
   from step 3 (e.g. `https://acc-app-shubham.vercel.app`, no trailing slash).
2. Redeploy the Render service (env changes take effect on the next deploy).
3. If a later deploy changes the Vercel URL, update these and redeploy.

---

## Step 5 — SMTP (optional, for emailing invoices)

Invoice email is the only feature that needs SMTP ([`server/src/services/emailService.js`](../server/src/services/emailService.js:4)).
If `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are unset, the email action
disables cleanly — PDF download and WhatsApp share links still work.

Options:
- **Gmail:** enable 2FA, create an *App Password*, use `SMTP_HOST=smtp.gmail.com`,
  `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=<gmail>`, `SMTP_PASS=<app password>`.
- **Resend / SendGrid / Amazon SES:** copy their SMTP host, port, and credentials.

Set a `MAIL_FROM` that your provider permits (verified sender/domain).

---

## Step 6 — Custom domain (optional)

**Vercel:** Project → Settings → Domains → add `app.yourdomain.com`, then create
the `CNAME` record your DNS provider shows.

**Render:** Service → Settings → Custom Domains → add `api.yourdomain.com`, then
create the shown `CNAME`.

After domains are live, update `CLIENT_URL`, `SHARE_LINK_BASE_URL` (Render), and
`VITE_API_URL` (Vercel) to the custom hostnames and redeploy both.

---

## Post-deploy verification checklist

- [ ] `GET https://<api>/api/v1/health` returns `{ "success": true, "message": "OK" }`.
- [ ] Register a new account on the Vercel URL, then log in — proves CORS +
      `credentials: true` cookie flow works end-to-end.
- [ ] Hard-refresh a deep link (e.g. `https://<app>/invoices` while logged in) —
      proves the SPA rewrite works.
- [ ] Create an invoice and download the PDF (client-side, always works).
- [ ] *(If SMTP set)* Email an invoice to yourself and confirm delivery.
- [ ] Create a share link, open it in a private window at `/i/<token>` — confirms
      `SHARE_LINK_BASE_URL` is correct.

---

## Demo / client-review account

There is **no built-in default login** — accounts only exist after someone
registers, and passwords are stored as bcrypt hashes. To hand a client working
credentials without them signing up, seed a demo account:

```bash
cd server
npm run seed
```

This creates (or resets) a business + owner account plus a small catalog,
customers and some sales so the dashboard is not empty. Default credentials:

| Field | Value |
|---|---|
| Email | `demo@dukan.app` |
| Password | `Demo@12345` |
| Business | Demo Traders |

Override any of them with env vars:

```bash
SEED_EMAIL=client@example.com SEED_PASSWORD='Client@2026' npm run seed
```

Notes:

- The seeder is **idempotent** — re-running it resets that business's demo data
  rather than duplicating it, and re-hashes the password so the login always works.
- It runs against whatever `MONGO_URI` is set in `server/.env`, so to seed the
  **production** database point `MONGO_URI` at Atlas first (e.g. via a one-off
  Render job or by running it locally with the Atlas URI).
- **Change the password before sharing** the app publicly; `Demo@12345` is
  intentionally simple and lives in source control.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login says **"Login failed (HTTP 405)..."** (or *"the request reached a static host, not the API"*) | `VITE_API_URL` was unset at build time, so the bundle fell back to the relative `/api/v1` and the login `POST` hit the **static Vercel host** instead of Render. Static hosts answer non-GET verbs with **405 Method Not Allowed** and a non-JSON body — note this app's Express `notFound` returns **404 JSON**, so a 405 proves the API was never reached. | Set `VITE_API_URL` = `https://<api>.onrender.com/api/v1` as a Vercel **Production** env var, then **Redeploy** (Vite inlines env vars at build time — editing the variable without redeploying changes nothing). The production build now fails fast if the var is missing ([`client/vite.config.js`](../client/vite.config.js:1)). Confirm in DevTools → Network that the `login` request URL is the Render host, not `*.vercel.app`. |
| Login says **"Can't reach the API at ..."** | `VITE_API_URL` was unset at build time, so the bundle fell back to `/api/v1` on the Vercel origin. The SPA rewrite in [`client/vercel.json`](../client/vercel.json) then returns `index.html` for that path, so axios gets HTML instead of JSON and throws before credentials are checked. | Set `VITE_API_URL` = `https://<api>.onrender.com/api/v1` as a Vercel **Production** env var, then **Redeploy** (Vite inlines env vars at build time — editing the variable without redeploying changes nothing). Confirm in DevTools → Network that the `login` request URL is the Render host, not `*.vercel.app`. |
| Login says **"Invalid email or password"** | Correct credentials never seeded, or seeded against a different database | Run `npm run seed` with `MONGO_URI` pointed at the **same** database the Render API uses (see *Demo / client-review account*). |
| Browser console: CORS / "blocked by CORS policy" | `CLIENT_URL` ≠ exact Vercel origin. If `CLIENT_URL` is **unset**, [`server/src/app.js`](../server/src/app.js:15) falls back to `http://localhost:5173`, so every deployed request is rejected | Set `CLIENT_URL` to the exact Vercel URL (no trailing slash) and redeploy Render |
| 401 loops / cookies not set | Cookie sent over HTTPS but `CLIENT_URL` mismatch, or `withCredentials` broken by wrong base URL | Confirm `VITE_API_URL` includes `/api/v1` and `CLIENT_URL` is exact |
| Backend crashes at boot: `Cannot find module '/opt/render/project/src/src/server.js'` (note the **doubled `src`**) | Render **Root Directory** is not set to `server`, so the start command `node src/server.js` runs from the repo root and resolves `…/src/src/server.js` | Service → Settings → **Root Directory** = `server`, then **Redeploy**. (Recreate the service via **Blueprint** to pick up [`render.yaml`](../render.yaml) automatically.) If the crash log shows a Node version other than the pinned `20`, the manual service is ignoring the Blueprint — recreate it. |
| Build log says `Using Node.js version <X> (default)` with `<X>` not `20` | Neither [`render.yaml`](../render.yaml:23) nor the committed [`.node-version`](../server/.node-version) was read — usually because the service's **Root Directory** is neither `server` nor the repo root | Set **Root Directory** = `server`, or add env var `NODE_VERSION` = `20` under **Environment**. Non-fatal, but loses the tested-runtime guarantee. |
| Boot log: `Failed to start server: MONGO_URI is not set` then `Exited with status 1` | The `MONGO_URI` env var is not present in the running service. Because [`server/src/config/db.js`](../server/src/config/db.js:4) throws before `app.listen`, the process exits `1` and Render marks the deploy failed — **this is a deploy-time failure, not a runtime one**. Most often the service is a manual **Web Service** rather than a **Blueprint** service, so the `sync: false` prompt in [`render.yaml`](../render.yaml:26) was never shown; alternatively the value was added but the service was not redeployed. | Render dashboard → the service → **Environment** → add `MONGO_URI` (the Atlas string from step 1) → **Save** → **Redeploy** (env changes only take effect on a new deploy). If the value was never prompted for, recreate the service via **New + → Blueprint** so Render reads [`render.yaml`](../render.yaml:1) and prompts for every `sync: false` key. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are `sync: false` too — set them now, or the API boots but login fails later. |
| Log line `◇ injected env (0) from .env` (or `enable debugging { debug: true }`) | **Not an error.** [`server/src/server.js`](../server/src/server.js:1) calls `require('dotenv').config()`, and there is no `.env` in the deployed bundle — correct, since [`.gitignore`](../.gitignore:8) excludes it and secrets live in the Render dashboard | Ignore it. Read the *next* line for the real status (`MongoDB connected` on success). The `(0)` count refers only to file-loaded vars; dashboard vars never appear in it. |
| Boot log: `Failed to start server [SERVER_SELECTION]` / `Could not connect to any servers in your MongoDB Atlas cluster` then `Exited with status 1` | **Atlas is refusing Render's source IP.** The connection URI is usually fine — proof is that the same URI works from your laptop. Render's free tier has no static outbound IP and its egress addresses are dynamic, so the allowlist entry must cover them | **Run `npm run db:check` from the Render Shell** (Environment tab → Shell). It resolves SRV, opens a TCP socket to a shard, and prints the exact egress IP Atlas is seeing, or the DNS error if that is the real fault. Then: free tier → add `0.0.0.0/0` in Atlas *Network Access* (keep the database user scoped); static IP add-on → add only the CIDRs from the service's **Connect** tab. **Do not allowlist another provider's, blog-post, or your own ISP's ranges** — a wrong range blocks Render entirely. Allow ~1 minute for the Atlas change, then redeploy |
| Boot log: `Failed to start server [AUTH]` | Password or username in `MONGO_URI` is wrong, or a special character is unencoded. The driver reports this as "bad auth" | Fix the user in Atlas *Database Access*, or re-copy the URI; percent-encode `@ : / #` in the password (`@` → `%40`). Update `MONGO_URI` in Render → Environment → **Redeploy** |
| Boot log: `Failed to start server [DNS]` | The cluster hostname in `MONGO_URI` does not resolve from Render, so the allowlist was never consulted | Confirm the hostname (`cluster0.xxxxx.mongodb.net`) is exactly what Atlas shows under *Database → Connect → Drivers* |
| `404 NOT_FOUND` on **every** URL, incl. the site root | Vercel project **Root Directory** is not `client`, so [`client/vercel.json`](../client/vercel.json) (and its SPA rewrite) is never applied | Project → Settings → General → **Root Directory** = `client`, then **Redeploy**. (A root [`vercel.json`](../vercel.json) is also provided as a fallback for root-directory builds.) |
| Deep link 404 on refresh (site root still works) | SPA rewrite missing or not deployed | Confirm [`client/vercel.json`](../client/vercel.json) (or root [`vercel.json`](../vercel.json)) is present, committed, and part of the deployed commit |
| First request slow (~40s) | Render free tier cold start | Expected; upgrade instance or keep it warm |
| Email button disabled | SMTP not configured | Set the `SMTP_*` + `MAIL_FROM` vars (step 5) |
| Could not send email (502) | Bad SMTP creds / blocked port | Re-check SMTP user/password; many hosts block 587 outbound on free tiers — try an API-based provider |

---

## Secret-handling rules

- Never commit real `.env` files. Root [`.gitignore`](../.gitignore) and
  [`client/.gitignore`](../client/.gitignore) ignore `.env` and all `.env.*`
  variants while keeping `*.example` templates.
- Secret values live only in the Render / Vercel dashboards.
- Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` by changing them in Render
  and redeploying — this invalidates all existing sessions.
