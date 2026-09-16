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
3. **Network Access** → *Add IP Address* → **Allow access from anywhere**
   (`0.0.0.0/0`). Render's free tier does not provide static outbound IPs, so a
   broad allowlist is required unless you pay for a static IP add-on.
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

| Key | Value | Notes |
|---|---|---|
| `MONGO_URI` | `mongodb+srv://.../acc-app?...` | From step 1 |
| `JWT_ACCESS_SECRET` | 96-char hex | Generated above |
| `JWT_REFRESH_SECRET` | different 96-char hex | Generated above |
| `CLIENT_URL` | `https://<your-app>.vercel.app` | **Exact** Vercel URL — CORS origin. Set after step 3, then redeploy |
| `SHARE_LINK_BASE_URL` | same as `CLIENT_URL` | Base for public invoice links (`/i/:token`) |
| `SHARE_LINK_TTL_DAYS` | `30` | Link expiry |
| `SMTP_HOST` | e.g. `smtp.gmail.com` | Optional — email only |
| `SMTP_PORT` | `587` | Optional |
| `SMTP_SECURE` | `false` | Optional (`true` for port 465) |
| `SMTP_USER` | your SMTP username | Optional |
| `SMTP_PASS` | your SMTP password / app password | Optional |
| `MAIL_FROM` | e.g. `Billing <billing@yourdomain.com>` | Optional |

> **Do not set `PORT`.** Render injects it and [`server/src/server.js`](../server/src/server.js:5)
> reads `process.env.PORT`.

**Verify the backend:**
```sh
curl https://acc-app-api.onrender.com/api/v1/health
# -> {"success":true,"message":"OK","data":null}
```

---

## Step 3 — Vercel (frontend)

1. Vercel dashboard → **Add New…** → **Project** → import the Git repo.
2. **Root Directory:** `client`. Framework preset should detect **Vite**
   (build `npm run build`, output `dist`). [`client/vercel.json`](../client/vercel.json)
   supplies these plus the SPA rewrite.
3. Add an **Environment Variable** (Production):
   - `VITE_API_URL` = `https://acc-app-api.onrender.com/api/v1`
     (include the `/api/v1` suffix).
4. Deploy. Copy the production URL, e.g. `https://acc-app-shubham.vercel.app`.

The rewrite in `client/vercel.json` sends all non-asset paths to `index.html` so
client-side routes (`/invoices`, `/customers`, `/i/:token`, …) survive a refresh
instead of 404ing.

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

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser console: CORS / "blocked by CORS policy" | `CLIENT_URL` ≠ exact Vercel origin | Set `CLIENT_URL` to the exact Vercel URL (no trailing slash) and redeploy Render |
| 401 loops / cookies not set | Cookie sent over HTTPS but `CLIENT_URL` mismatch, or `withCredentials` broken by wrong base URL | Confirm `VITE_API_URL` includes `/api/v1` and `CLIENT_URL` is exact |
| Backend build crashes: "MONGO_URI is not set" | Env var missing on Render | Add `MONGO_URI` in the Render dashboard and redeploy |
| Mongo connection timeout | Atlas IP allowlist blocks Render | Add `0.0.0.0/0` in Atlas *Network Access* |
| Deep link 404 on refresh | SPA rewrite missing | Confirm [`client/vercel.json`](../client/vercel.json) is present and deployed |
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
