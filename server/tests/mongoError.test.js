const { describeMongoError, classifyMongoError } = require('../src/config/mongoError');

// Shapes taken from real driver errors (mongoose 8 / mongodb driver 6).
function serverSelectionError(message) {
    const err = new Error(
        message ||
        'Could not connect to any servers in your MongoDB Atlas cluster. One common reason ' +
        'is that you\'re trying to access the database from an IP that isn\'t whitelisted.'
    );
    err.name = 'MongooseServerSelectionError';
    return err;
}

describe('classifyMongoError', () => {
    it('classifies an unreachable cluster as a server-selection problem', () => {
        expect(classifyMongoError(serverSelectionError())).toBe('SERVER_SELECTION');
    });

    it('classifies bad credentials by message', () => {
        const err = new Error('Authentication failed.');
        expect(classifyMongoError(err)).toBe('AUTH');
    });

    it('classifies bad credentials by driver code 18', () => {
        const err = new Error('command insert requires authentication');
        err.code = 18;
        expect(classifyMongoError(err)).toBe('AUTH');
    });

    it('classifies a DNS/SRV resolution failure ahead of server selection', () => {
        const err = serverSelectionError('getaddrinfo ENOTFOUND cluster0.invalid.mongodb.net');
        expect(classifyMongoError(err)).toBe('DNS');
    });

    it('classifies a malformed connection string', () => {
        expect(classifyMongoError(new Error('Invalid scheme, expected connection string to start with "mongodb://" or "mongodb+srv://"'))).toBe('PARSE');
    });

    it('falls back to UNKNOWN for anything it does not recognise', () => {
        expect(classifyMongoError(new Error('totally unexpected'))).toBe('UNKNOWN');
    });

    it('does not throw on a missing error', () => {
        expect(classifyMongoError(undefined)).toBe('UNKNOWN');
        expect(classifyMongoError(null)).toBe('UNKNOWN');
    });
});

describe('describeMongoError', () => {
    it('names Atlas Network Access and the free-tier allowlist value for an unreachable cluster', () => {
        const out = describeMongoError(serverSelectionError());
        expect(out).toMatch(/Network Access/);
        expect(out).toMatch(/0\.0\.0\.0\/0/);
        expect(out).toMatch(/Redeploy/);
    });

    it('preserves the original driver message so logs stay truthful', () => {
        const out = describeMongoError(serverSelectionError('specific driver detail here'));
        expect(out).toContain('specific driver detail here');
    });

    it('points at credentials and percent-encoding for an auth failure', () => {
        const err = new Error('Authentication failed.');
        err.code = 18;
        const out = describeMongoError(err);
        expect(out).toMatch(/Database Access/);
        expect(out).toMatch(/percent-encoded/);
        expect(out).not.toMatch(/0\.0\.0\.0\/0/);
    });

    it('points at DNS/SRV rather than the allowlist for a resolution failure', () => {
        const out = describeMongoError(serverSelectionError('getaddrinfo ENOTFOUND nope.mongodb.net'));
        expect(out).toMatch(/DNS/);
        expect(out).not.toMatch(/0\.0\.0\.0\/0/);
    });

    it('masks the password when the driver echoes the connection string', () => {
        const err = new Error(
            'connect ECONNREFUSED mongodb+srv://acc-app-user:sup3r-s3cr3t@cluster0.t8a0tp3.mongodb.net/acc-app'
        );
        const out = describeMongoError(err);
        expect(out).not.toContain('sup3r-s3cr3t');
        expect(out).toContain('acc-app-user:***@cluster0.t8a0tp3.mongodb.net');
    });

    it('masks non-srv mongodb:// credentials too', () => {
        const err = new Error('failed mongodb://localuser:hunter2@127.0.0.1:27017/acc-app');
        const out = describeMongoError(err);
        expect(out).not.toContain('hunter2');
    });

    it('still produces a message for an unrecognised error', () => {
        const out = describeMongoError(new Error('weird'));
        expect(out).toMatch(/MONGO_URI/);
        expect(out).toContain('weird');
    });

    it('suggests a concrete action when no error is supplied', () => {
        const out = describeMongoError();
        expect(out).toMatch(/MONGO_URI/);
        expect(typeof out).toBe('string');
        expect(out.length).toBeGreaterThan(0);
    });
});
