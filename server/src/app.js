require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');

const DEFAULT_CLIENT_URL = 'http://localhost:5173';

/**
 * Turns the CLIENT_URL env var into a clean allowlist.
 *
 * Tolerates the two things the Render dashboard makes easy to get wrong:
 *   - a trailing slash ("https://app.vercel.app/"), which never byte-matches
 *     the browser's `Origin` header and would silently reject every preflight;
 *   - several origins separated by commas, so production and a staging/preview
 *     deployment can both be allowed without a second variable.
 */
function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(process.env.CLIENT_URL);

if (allowedOrigins.length === 0) {
  allowedOrigins.push(DEFAULT_CLIENT_URL);
  // Deliberately loud. CORS is read once at import, and when this is unset in a
  // deploy the API still boots and /health stays green -- yet every request from
  // the deployed frontend is rejected at the preflight. The browser then reports
  // NO response at all (the POST is never sent), which surfaces in the UI as
  // "Can't reach the API at https://<api>/api/v1" and looks like a dead backend.
  // This line is the difference between a 5-minute fix and an hour of guessing.
  console.warn(
    `[cors] CLIENT_URL is not set. Falling back to ${DEFAULT_CLIENT_URL}. ` +
    'Requests from a deployed frontend will be blocked. Set CLIENT_URL to the ' +
    'exact frontend origin (no trailing slash) on Render and redeploy.'
  );
}

/**
 * CORS gate for the separately-hosted frontend.
 *
 * Auth uses `credentials: true` cookies, so the allow-origin value must be an
 * exact origin -- never `*`, which browsers reject for credentialed requests.
 * A request carrying a JSON body (e.g. `POST /auth/login`) is not a "simple"
 * request, so the browser sends an OPTIONS preflight first; if that fails the
 * real request is never made. Hence this middleware, not the login handler, is
 * what an unreachable-API error usually points at.
 */
const corsOptions = {
  origin(origin, callback) {
    // No Origin header: same-origin navigation, curl, or Render's health probe.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(
      `[cors] Blocked origin ${origin}. Allowed: ${allowedOrigins.join(', ')}. ` +
      'If this is your frontend, set CLIENT_URL to it exactly (no trailing slash).'
    );
    // Do not throw: the error handler would turn a CORS rejection into a 500,
    // which misdirects debugging. Omitting the header lets the browser report a
    // CORS failure, which is the accurate description.
    return callback(null, false);
  },
  credentials: true,
};

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, message: 'OK', data: null });
});

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
