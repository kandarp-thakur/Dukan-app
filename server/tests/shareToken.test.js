const {
    generateShareToken,
    shareTokenExpiry,
    isTokenExpired,
    shareUrlFor,
} = require('../src/utils/shareToken');

describe('shareToken utils', () => {
    it('generates a 43-character base64url token', () => {
        const token = generateShareToken();
        expect(token).toHaveLength(43);
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates a distinct token every call', () => {
        const seen = new Set();
        for (let i = 0; i < 100; i += 1) seen.add(generateShareToken());
        expect(seen.size).toBe(100);
    });

    it('expires 30 days out by default', () => {
        const before = Date.now();
        const expiry = shareTokenExpiry();
        const delta = expiry.getTime() - before;
        expect(delta).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
        expect(delta).toBeLessThan(31 * 24 * 60 * 60 * 1000);
    });

    it('honours an explicit day count', () => {
        const expiry = shareTokenExpiry(1);
        const delta = expiry.getTime() - Date.now();
        expect(delta).toBeGreaterThan(23 * 60 * 60 * 1000);
        expect(delta).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('treats a missing or null expiry as expired', () => {
        expect(isTokenExpired({})).toBe(true);
        expect(isTokenExpired({ shareTokenExpiresAt: null })).toBe(true);
        expect(isTokenExpired(null)).toBe(true);
        expect(isTokenExpired({ shareTokenExpiresAt: 'not-a-date' })).toBe(true);
    });

    it('treats a past expiry as expired and a future one as live', () => {
        expect(isTokenExpired({ shareTokenExpiresAt: new Date(Date.now() - 1) })).toBe(true);
        expect(isTokenExpired({ shareTokenExpiresAt: new Date(Date.now() + 60000) })).toBe(false);
    });

    it('builds the public URL from the configured base', () => {
        process.env.SHARE_LINK_BASE_URL = 'https://bills.example.com/';
        expect(shareUrlFor('abc')).toBe('https://bills.example.com/i/abc');
        process.env.SHARE_LINK_BASE_URL = 'http://localhost:5173';
        expect(shareUrlFor('abc')).toBe('http://localhost:5173/i/abc');
    });
});
