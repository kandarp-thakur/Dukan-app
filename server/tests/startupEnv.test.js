const { assertStartupEnv, missingVars, formatError } = require('../src/config/env');

describe('startup env validation', () => {
    const complete = {
        MONGO_URI: 'mongodb://127.0.0.1:27017/test',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
    };

    it('passes when every required var is set', () => {
        expect(() => assertStartupEnv(complete)).not.toThrow();
    });

    it('reports all missing required vars, not just the first', () => {
        expect(missingVars({})).toEqual([
            'MONGO_URI',
            'JWT_ACCESS_SECRET',
            'JWT_REFRESH_SECRET',
        ]);
    });

    it('treats empty and whitespace-only values as missing', () => {
        expect(missingVars({ ...complete, MONGO_URI: '' })).toEqual(['MONGO_URI']);
        expect(missingVars({ ...complete, MONGO_URI: '   ' })).toEqual(['MONGO_URI']);
    });

    it('names every missing var in the thrown message', () => {
        let message = '';
        try {
            assertStartupEnv({ JWT_ACCESS_SECRET: 'only-this-one' });
        } catch (err) {
            message = err.message;
        }
        expect(message).toMatch(/MONGO_URI/);
        expect(message).toMatch(/JWT_REFRESH_SECRET/);
        // The one var that IS set must not be listed as missing.
        expect(message).not.toMatch(/Missing required environment variable\(s\): .*JWT_ACCESS_SECRET/);
    });

    it('does not list a fully-populated var as missing', () => {
        const partial = { ...complete };
        delete partial.JWT_REFRESH_SECRET;
        expect(missingVars(partial)).toEqual(['JWT_REFRESH_SECRET']);
    });

    it('does not require CLIENT_URL, which has a built-in fallback', () => {
        expect(missingVars(complete)).not.toContain('CLIENT_URL');
        expect(() => assertStartupEnv(complete)).not.toThrow();
    });

    it('explains how to fix it, mentioning the host env rather than a .env file', () => {
        const message = formatError(['MONGO_URI']);
        expect(message).toMatch(/Render/);
        expect(message).toMatch(/Redeploy/);
        expect(message).toMatch(/MONGO_URI/);
    });
});
