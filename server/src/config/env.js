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
 * Only variables the running API genuinely cannot function without are
 * required. Deliberately optional:
 *   - CLIENT_URL          falls back to http://localhost:5173 in app.js
 *   - SHARE_LINK_*        only used when minting public invoice links
 *   - SMTP_* / MAIL_FROM  email action disables itself cleanly (emailService.js)
 */

const REQUIRED = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

const DESCRIPTIONS = {
    MONGO_URI: 'MongoDB Atlas connection string, database name included.',
    JWT_ACCESS_SECRET: 'any long random string (>=32 chars).',
    JWT_REFRESH_SECRET: 'a DIFFERENT long random string.',
};

/** Returns the required keys that are absent, empty, or whitespace-only. */
function missingVars(env = process.env) {
    return REQUIRED.filter((key) => {
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

    lines.push(
        '',
        'Generate a secret with:',
        '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
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

module.exports = { REQUIRED, missingVars, formatError, assertStartupEnv };
