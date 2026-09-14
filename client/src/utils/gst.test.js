import { describe, it, expect } from 'vitest';
import { INDIAN_STATES, stateCodeFromGstin, isIntraState, computeGst } from './gst';

describe('gst utils (client)', () => {
    it('maps a GSTIN to its alpha-2 state code', () => {
        expect(stateCodeFromGstin('27ABCDE1234F1Z5')).toBe('MH');
        expect(stateCodeFromGstin('')).toBe('');
        expect(stateCodeFromGstin('25ABCDE1234F1Z5')).toBe('DN');
    });

    it('detects intra-state supply', () => {
        expect(isIntraState('27ABCDE1234F1Z5', 'MH')).toBe(true);
        expect(isIntraState('27ABCDE1234F1Z5', 'KA')).toBe(false);
    });

    it('lists 37 state codes', () => {
        expect(Object.keys(INDIAN_STATES)).toHaveLength(37);
    });

    it('splits CGST/SGST for an intra-state sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, true, true);
        expect(r.cgst).toBe(990);
        expect(r.sgst).toBe(990);
        expect(r.tax).toBe(1980);
    });

    it('charges IGST for an inter-state sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, true, false);
        expect(r.igst).toBe(1980);
        expect(r.cgst).toBe(0);
    });

    it('returns zero GST when the sale is not a GST sale', () => {
        const r = computeGst([{ amount: 2000, gstRate: 0 }], 0, false, true);
        expect(r.tax).toBe(0);
        expect(r.taxableValue).toBe(2000);
    });
});
