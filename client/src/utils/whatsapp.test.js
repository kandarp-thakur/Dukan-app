import { describe, it, expect } from 'vitest';
import { toWhatsAppNumber, whatsappUrl } from './whatsapp';

describe('toWhatsAppNumber', () => {
    it('prefixes 91 to a bare 10-digit number', () => {
        expect(toWhatsAppNumber('9876543210')).toBe('919876543210');
    });

    it('drops non-digits', () => {
        expect(toWhatsAppNumber('+91 98765 43210')).toBe('919876543210');
        expect(toWhatsAppNumber('(987) 654-3210')).toBe('919876543210');
    });

    it('drops a single leading zero', () => {
        expect(toWhatsAppNumber('09876543210')).toBe('919876543210');
    });

    it('keeps an already-prefixed 12-digit number', () => {
        expect(toWhatsAppNumber('919876543210')).toBe('919876543210');
    });

    it('returns an empty string for empty input', () => {
        expect(toWhatsAppNumber('')).toBe('');
        expect(toWhatsAppNumber(undefined)).toBe('');
        expect(toWhatsAppNumber('---')).toBe('');
    });
});

describe('whatsappUrl', () => {
    it('builds a wa.me deep link with an encoded message', () => {
        const url = whatsappUrl('9876543210', 'Invoice INV-1 · ₹129.80\nhttps://x.test/i/abc');
        expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
        expect(url).toContain(encodeURIComponent('Invoice INV-1'));
        expect(url).toContain(encodeURIComponent('https://x.test/i/abc'));
        expect(url).not.toContain('\n');
    });
});
