/**
 * Startup environment validation.
 *
 * Runs before the HTTP listener is bound so a misconfigured deploy fails
 * immediately and visibly, instead of booting "successfully" and then failing
 * every request (health check green, all logins broken -- a much harder bug to
 * spot than a failed deploy).
 *
 * It reports *all* missing variables at once. Without this, the process dies on
 * whichever variable happens to be read first, so each missing value costs a
 * full redeploy cycle to discover.
 *
 * Deliberately optional:
 *   - SHARE_LINK_*        only used when minting public invoice links
 *   - SMTP_* / MAIL_FROM  email action disables itself cleanly (emailService.js)
 */

const REQUIRED = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

/**
 * Required only when deployed -- never for local development.
 *
 * CLIENT_URL is the CORS allowlist (see app.js). When it is unset the API still
 * boots and its `/health` check stays green, but it falls back to
 * `http://localhost:5173` and rejects every browser request from the real
 * frontend. Because `POST /auth/login` sends JSON it is not a CORS *simple
 * request*, so the browser sends an `OPTIONS` preflight first; when that is
 * rejected the `POST` is never sent and the app sees **no reply at all** --
 * surfacing as "Can't reach the API at https://<api>/api/v1" even though the
 * backend is healthy. That is a deploy-time configuration fault, so it must
 * fail the deploy rather than hide behind a green health check.
 */
const DEPLOYED_REQUIRED = ['CLIENT_URL'];

const DESCRIPTIONS = {
    MONGO_URI: 'MongoDB Atlas connection string, database name included.',
    JWT_ACCESS_SECRET: 'any long random string (>=32 chars).',
    JWT_REFRESH_SECRET: 'a DIFFERENT long random string.',
    CLIENT_URL:
        'the exact frontend origin allowed by CORS, e.g. ' +
        'https://<app>.vercel.app -- no trailing slash. Without it the API ' +
        'falls back to http://localhost:5173 and rejects every deployed request.',
};

/**
 * True when running on a host (Render, or NODE_ENV=production) rather than a
 * developer machine, where the localhost fallback is intentional.
 */
function isDeployed(env = process.env) {
    if (String(env.NODE_ENV || '').toLowerCase() === 'production') return true;
    // Render sets RENDER=true on every service; RENDER_EXTERNAL_URL is the
    // public URL, so either is a reliable signal even if NODE_ENV is unset.
    return Boolean(env.RENDER || env.RENDER_EXTERNAL_URL);
}

/** Returns the required keys that are absent, empty, or whitespace-only. */
function missingVars(env = process.env) {
    const required = isDeployed(env)
        ? [...REQUIRED, ...DEPLOYED_REQUIRED]
        : REQUIRED;

    return required.filter((key) => {
        const value = env[key];
        return value === undefined || value === null || String(value).trim() === '';
    });
}

function formatError(missing) {
    const lines = [
        `Missing required environment variable(s): ${missing.join(', ')}.`,
        '',
        'Set them in your host\'s environment',
        '(Render: service -> Environment -> add the variable -> Redeploy).',
        'A deployed bundle contains no .env, so nothing is read from a file there.',
        '',
    ];

    for (const key of missing) {
        lines.push(`  ${key.padEnd(20)} ${DESCRIPTIONS[key]}`);
    }

    // Only suggest secret generation when a secret is actually missing.
    if (missing.some((key) => key.startsWith('JWT_'))) {
        lines.push(
            '',
            'Generate a secret with:',
            '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
        );
    }

    lines.push(
        '',
        'For local development, copy server/.env.example to server/.env instead.'
    );

    return lines.join('\n');
}

/** Throws a single error listing every missing required variable. */
function assertStartupEnv(env = process.env) {
    const missing = missingVars(env);
    if (missing.length) {
        throw new Error(formatError(missing));
    }
}

module.exports = {
    REQUIRED,
    DEPLOYED_REQUIRED,
    isDeployed,
    missingVars,
    formatError,
    assertStartupEnv,
};
