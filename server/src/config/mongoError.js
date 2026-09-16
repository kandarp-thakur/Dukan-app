/**
 * Turns an opaque MongoDB driver error into an actionable one.
 *
 * Why this exists: mongoose/mongodb collapse a dozen very different failures
 * (denied IP, bad password, dead DNS, truncated URI) into one generic message
 * that lists three possible causes and identifies none. A deploy log that says
 * "one common reason is..." costs a human a round of guessing. This classifies
 * the error and states the single most likely fix.
 *
 * It also masks credentials: driver errors sometimes echo the connection
 * string, and Render logs are visible in the dashboard.
 */

// mongodb://user:password@  ->  mongodb://user:***@
const CREDENTIALS_IN_URI = /(mongodb(?:\+srv)?:\/\/[^:@/\s]+):([^@/\s]+)@/g;

function maskSecrets(text) {
    if (typeof text !== 'string') return '';
    return text.replace(CREDENTIALS_IN_URI, '$1:***@');
}

function classifyMongoError(err) {
    if (!err) return 'UNKNOWN';

    const name = err.name || '';
    const message = typeof err.message === 'string' ? err.message : String(err);
    const haystack = `${name} ${message}`;

    // Order matters. A DNS failure surfaces as a MongooseServerSelectionError
    // too, so it must be recognised before the broader server-selection case.
    if (/MongoParseError|Invalid scheme|expected connection string/i.test(haystack)) {
        return 'PARSE';
    }
    if (/getaddrinfo|ENOTFOUND|EAI_AGAIN|querySrv|queryTxt|ESERVFAIL/i.test(haystack)) {
        return 'DNS';
    }
    if (err.code === 18 || /Authentication failed|bad auth|auth failed|SCRAM/i.test(haystack)) {
        return 'AUTH';
    }
    if (
        name === 'MongooseServerSelectionError' ||
        name === 'MongoServerSelectionError' ||
        /server selection|Could not connect to any servers/i.test(haystack)
    ) {
        return 'SERVER_SELECTION';
    }
    return 'UNKNOWN';
}

function describeMongoError(err) {
    const kind = classifyMongoError(err);
    const raw = err && (err.message || err.toString());
    const detail = maskSecrets(raw || '');
    const driverBlock = detail ? `\n\nDriver said:\n  ${detail}` : '';
    const noError = '\n\nNo error object was captured, so check that MONGO_URI is set and points at a reachable cluster.';

    switch (kind) {
        case 'SERVER_SELECTION':
            return (
                'MongoDB refused the connection (server selection timed out). ' +
                'The cluster is reachable from elsewhere, but not from this host\'s IP address — ' +
                'the connection string itself is usually fine, which is why the driver suggests the allowlist.' +
                driverBlock +
                '\n\nFix in Render:\n' +
                '  1. MongoDB Atlas -> Network Access -> Add IP Address.\n' +
                '  2. Render\'s free tier has no static outbound IP, so add 0.0.0.0/0\n' +
                '     (keep the Atlas database user scoped to this database with a strong password).\n' +
                '     With a static IP add-on, add only the outbound CIDRs shown on the\n' +
                '     service\'s Connect tab instead.\n' +
                '  3. Save, allow ~1 minute for the change to apply, then Redeploy in Render\n' +
                '     and look for "MongoDB connected" in the log.'
            );

        case 'AUTH':
            return (
                'MongoDB rejected the credentials in MONGO_URI.' +
                '\n\nCheck MongoDB Atlas -> Database Access: the username and password must match. ' +
                'If the password contains special characters it must be percent-encoded inside the URI ' +
                '(@ -> %40, : -> %3A, / -> %2F, # -> %23). ' +
                'After changing the Atlas user, update MONGO_URI in Render -> Environment and Redeploy.' +
                driverBlock
            );

        case 'DNS':
            return (
                'MongoDB hostname could not be resolved from this host (DNS/SRV lookup failed). ' +
                'This is a name-resolution problem, NOT an Atlas IP allowlist problem. ' +
                'Verify the cluster hostname inside MONGO_URI and that this host can resolve DNS and query SRV records.' +
                driverBlock
            );

        case 'PARSE':
            return (
                'MONGO_URI is not a valid MongoDB connection string. ' +
                'It must start with mongodb:// or mongodb+srv:// and include the database name, e.g. ' +
                'mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/acc-app?retryWrites=true . ' +
                'A very common cause is a stray character from pasting into the Render dashboard ' +
                '(a wrapping quote, a trailing space, or an unencoded # in the password).' +
                driverBlock
            );

        default:
            return (
                'Could not connect to MongoDB. Check that MONGO_URI is correct, that the Atlas cluster ' +
                'is running, and that this host is allowed in Atlas -> Network Access.' +
                driverBlock +
                (err ? '' : noError)
            );
    }
}

module.exports = { classifyMongoError, describeMongoError, maskSecrets };
