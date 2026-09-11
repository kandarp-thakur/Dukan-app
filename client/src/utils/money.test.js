import { describe, it, expect } from 'vitest';
import { formatINR, rupeesToPaise, paiseToRupees, amountToWords } from './money';

describe('formatINR', () => {
    it('formats paise as Indian Rupees with lakh/crore grouping', () => {
        expect(formatINR(0)).toBe('₹0');
        expect(formatINR(123456789)).toBe('₹12,34,567.89');
        expect(formatINR(10000000)).toBe('₹1,00,000');
        expect(formatINR(123400)).toBe('₹1,234');
        expect(formatINR(5500)).toBe('₹55');
        expect(formatINR(123455)).toBe('₹1,234.55');
    });

    it('handles negative amounts', () => {
        expect(formatINR(-5000)).toBe('-₹50');
    });

    it('formats with paise only when needed', () => {
        expect(formatINR(1050)).toBe('₹10.50');
        expect(formatINR(1005)).toBe('₹10.05');
    });
});

describe('rupeesToPaise / paiseToRupees', () => {
    it('converts rupees to paise integers', () => {
        expect(rupeesToPaise(123.45)).toBe(12345);
        expect(rupeesToPaise(0)).toBe(0);
        expect(rupeesToPaise(55)).toBe(5500);
    });

    it('rounds stray floating point noise', () => {
        expect(rupeesToPaise(10.1)).toBe(1010);
        expect(rupeesToPaise(0.1)).toBe(10);
    });

    it('converts paise back to rupees', () => {
        expect(paiseToRupees(12345)).toBe(123.45);
        expect(paiseToRupees(0)).toBe(0);
    });
});

describe('amountToWords', () => {
    it('converts small amounts', () => {
        expect(amountToWords(0)).toBe('Zero Rupees Only');
        expect(amountToWords(100000)).toBe('One Thousand Rupees Only');
        expect(amountToWords(5500)).toBe('Fifty Five Rupees Only');
    });

    it('includes paise when non-zero', () => {
        expect(amountToWords(123455)).toBe('One Thousand Two Hundred Thirty Four Rupees and Fifty Five Paise Only');
    });

    it('handles large amounts with lakh and crore', () => {
        expect(amountToWords(10000000)).toBe('One Lakh Rupees Only');
        expect(amountToWords(19900)).toBe('One Hundred Ninety Nine Rupees Only');
    });
});
