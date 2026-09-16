import { describe, it, expect } from 'vitest';
import { resolveApiBaseUrl } from './baseUrl';

describe('resolveApiBaseUrl', () => {
    it('uses the explicit VITE_API_URL when provided', () => {
        expect(resolveApiBaseUrl({ VITE_API_URL: 'https://acc-app-api.onrender.com/api/v1', PROD: true })).toBe(
            'https://acc-app-api.onrender.com/api/v1'
        );
    });

    it('trims surrounding whitespace from VITE_API_URL', () => {
        expect(resolveApiBaseUrl({ VITE_API_URL: '  https://api.example.com/api/v1  ', PROD: true })).toBe(
            'https://api.example.com/api/v1'
        );
    });

    it('falls back to the same-origin proxy path in development', () => {
        expect(resolveApiBaseUrl({ VITE_API_URL: '', PROD: false })).toBe('/api/v1');
    });

    it('throws in a production build when VITE_API_URL is unset', () => {
        // Silent fallback to the static host is the documented cause of the
        // login HTTP 405 ("Method Not Allowed") bug — fail loudly instead.
        expect(() => resolveApiBaseUrl({ VITE_API_URL: '', PROD: true })).toThrow(/VITE_API_URL/);
    });

    it('throws in a production build when VITE_API_URL is only whitespace', () => {
        expect(() => resolveApiBaseUrl({ VITE_API_URL: '   ', PROD: true })).toThrow(/VITE_API_URL/);
    });
});
