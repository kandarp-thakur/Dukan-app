#!/usr/bin/env node
'use strict';

/**
 * Post-deploy verification for the Render API.
 *
 * Answers three questions a green "Live" badge does not:
 *   1. Is the service actually up, and is it our API (not a proxy error page)?
 *   2. Is CLIENT_URL wired correctly, so the browser is allowed to call it?
 *   3. Is the database reachable (i.e. did MONGO_URI work)?
 *
 * USAGE
 *   npm run verify:deploy -- --api-url=https://acc-app-api.onrender.com
 *   npm run verify:deploy -- --api-url=https://... --client-url=https://app.vercel.app
 *
 * FLAGS
 *   --api-url=URL      Required (or set API_URL). The Render service base URL.
 *   --client-url=URL   Optional. Checks CORS preflight allows this origin.
 *   --timeout=MS       Per-request timeout. Default 90000, because Render's free
 *                      tier cold-starts in ~30-50s and a shorter timeout reports
 *                      a healthy service as down.
 *
 * EXIT CODES
 *   0 all checks passed       1 a check failed       2 usage / bad arguments
 */

const DEFAULT_TIMEOUT_MS = 90_000;

const USAGE = `Usage: npm run verify:deploy -- --api-url=https://<service>.onrender.com

Options:
  --api-url=URL      Render service base URL (or env API_URL).
  --client-url=URL   Vercel origin, to assert CORS allows it.
  --timeout=MS       Per-request timeout (default ${DEFAULT_TIMEOUT_MS}; Render free tier
                     needs a generous value for cold starts).
  --help, -h         Show this message.`;

function parseArgs(argv) {
    const opts = {
        apiUrl: process.env.API_URL || '',
        clientUrl: '',
        timeout: DEFAULT_TIMEOUT_MS,
        help: false,
    };

    for (const arg of argv) {
        if (arg === '--help' || arg === '-h') opts.help = true;
        else if (arg.startsWith('--api-url=')) opts.apiUrl = arg.slice('--api-url='.length);
        else if (arg.startsWith('--client-url=')) opts.clientUrl = arg.slice('--client-url='.length);
        else if (arg.startsWith('--timeout=')) {
            const n = Number(arg.slice('--timeout='.length));
            if (!Number.isFinite(n) || n <= 0) throw new Error('--timeout must be a positive number of milliseconds');
            opts.timeout = n;
        } else throw new Error(`Unknown argument "${arg}". Run with --help for usage.`);
    }

    return opts;
}

/** Returns a base URL with no trailing slash, so path joins are predictable. */
function normalizeBase(raw) {
    return String(raw).trim().replace(/\/+$/, '');
}

function mask(value) {
    const s = String(value || '');
    if (s.length <= 12) return s;
    return `${s.slice(0, 8)}...${s.slice(-4)}`;
}

async function timedFetch(url, options, timeoutMs) {
    const started = Date.now();
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    return { res, elapsed: Date.now() - started };
}

const results = [];
function record(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function checkHealth(base, timeout) {
    const url = `${base}/api/v1/health`;
    try {
        const { res, elapsed } = await timedFetch(url, { method: 'GET' }, timeout);
        const text = await res.text();

        let body;
        try {
            body = JSON.parse(text);
        } catch {
            record(
                'GET /api/v1/health returns JSON',
                false,
                `got ${res.status} ${res.headers.get('content-type') || 'unknown content type'}. ` +
                'This means the URL is not the API -- it is likely a static host or proxy page.'
            );
            return false;
        }

        if (res.status !== 200 || body.success !== true) {
            record('GET /api/v1/health returns success envelope', false, `status ${res.status}, body ${text.slice(0, 200)}`);
            return false;
        }

        const cold = elapsed > 5000 ? ` (took ${(elapsed / 1000).toFixed(1)}s -- cold start)` : '';
        record('GET /api/v1/health returns success envelope', true, `${elapsed}ms${cold}`);
        return true;
    } catch (err) {
        const cold = err.name === 'TimeoutError' || err.name === 'AbortError';
        record(
            'GET /api/v1/health is reachable',
            false,
            cold
                ? `timed out after ${timeout}ms. Render free tier sleeps after ~15min; retry, ` +
                `or raise --timeout. If it never wakes, the service is crashing on boot -- ` +
                `check the Render logs for "Failed to start server".`
                : `${err.message}. Check the URL and that the service is deployed.`
        );
        return false;
    }
}

async function checkCors(base, clientUrl, timeout) {
    const url = `${base}/api/v1/health`;
    try {
        const { res } = await timedFetch(
            url,
            {
                method: 'OPTIONS',
                headers: {
                    Origin: clientUrl,
                    'Access-Control-Request-Method': 'GET',
                },
            },
            timeout
        );

        const allowed = res.headers.get('access-control-allow-origin');
        const credentials = res.headers.get('access-control-allow-credentials');

        if (allowed === clientUrl) {
            const credNote = credentials === 'true' ? 'credentials allowed' : 'credentials NOT allowed';
            record(`CORS allows ${clientUrl}`, true, `${allowed} (${credNote})`);
            return true;
        }

        record(
            `CORS allows ${clientUrl}`,
            false,
            allowed
                ? `origin echoed as "${allowed}" instead`
                : 'no Access-Control-Allow-Origin header. CLIENT_URL is likely unset on ' +
                'Render, so app.js falls back to http://localhost:5173.'
        );
        return false;
    } catch (err) {
        record(`CORS allows ${clientUrl}`, false, err.message);
        return false;
    }
}

async function main() {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(2);
    }

    if (opts.help) {
        console.log(USAGE);
        return;
    }

    if (!opts.apiUrl) {
        console.error('Error: --api-url is required (or set API_URL).\n');
        console.log(USAGE);
        process.exit(2);
    }

    const base = normalizeBase(opts.apiUrl);
    if (!/^https?:\/\//i.test(base)) {
        console.error(`Error: --api-url must start with http:// or https:// (received "${opts.apiUrl}").`);
        process.exit(2);
    }

    console.log('');
    console.log(`Target : ${base}`);
    console.log(`Timeout: ${opts.timeout}ms${opts.timeout >= 30000 ? ' (tolerant of Render cold starts)' : ' (may be too short for a cold start)'}`);
    if (opts.clientUrl) console.log(`Origin : ${normalizeBase(opts.clientUrl)}`);
    console.log('');

    const healthOk = await checkHealth(base, opts.timeout);

    // A failing health check makes the CORS result misleading, so only run it if
    // the service answered, or if the user explicitly asked about an origin.
    if (opts.clientUrl && healthOk) {
        await checkCors(base, normalizeBase(opts.clientUrl), opts.timeout);
    }

    const failed = results.filter((r) => !r.ok);

    console.log('');
    if (!failed.length) {
        console.log(`All ${results.length} check(s) passed.`);
        console.log('');
        console.log('Remaining manual checks (cannot be automated from here):');
        console.log('  - register + log in on the Vercel URL (proves cookies + CORS end to end)');
        console.log('  - hard-refresh a deep link such as /invoices (proves the SPA rewrite)');
        return;
    }

    console.log(`${failed.length} of ${results.length} check(s) failed.`);
    console.log('');
    console.log('Most common causes, in order:');
    console.log('  1. MONGO_URI not set on the Render service -> boot exits 1.');
    console.log('  2. Service is a manual Web Service, so render.yaml (and its');
    console.log('     sync:false prompts) were ignored. Recreate via Blueprint.');
    console.log('  3. CLIENT_URL not set -> CORS falls back to localhost:5173.');
    console.log('  4. Atlas Network Access does not allow Render (0.0.0.0/0, or the');
    console.log('     outbound CIDRs if a static IP add-on is attached).');
    console.log('See docs/DEPLOYMENT.md -> Troubleshooting.');
    process.exit(1);
}

main().catch((err) => {
    console.error(`Unexpected error: ${err && err.stack ? err.stack : err}`);
    process.exit(1);
});
