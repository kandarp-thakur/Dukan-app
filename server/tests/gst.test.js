const {
    INDIAN_STATES,
    stateCodeFromGstin,
    isIntraState,
    computeGst,
} = require('../src/utils/gst');

describe('gst utils', () => {
    it('mapping a GSTIN to its state code', () => {
        expect(stateCodeFromGstin('27ABCDE1234F1Z5')).toBe('MH');
        expect(stateCodeFromGstin('29ABCDE1234F1Z5')).toBe('KA');
        expect(stateCodeFromGstin('')).toBe('');
        expect(stateCodeFromGstin('ZZ')).toBe('');
    });

    it('detects intra-state supply', () => {
        expect(isIntraState('27ABCDE1234F1Z5', 'MH')).toBe(true);
        expect(isIntraState('27ABCDE1234F1Z5', 'KA')).toBe(false);
        expect(isIntraState('', 'MH')).toBe(false);
    });

    it('lists all Indian state codes', () => {
        expect(Object.keys(INDIAN_STATES)).toHaveLength(37);
        expect(INDIAN_STATES.MH).toBe('Maharashtra');
    });

    it('returns zero GST for a non-GST sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, false, true);
        expect(r).toMatchObject({ cgst: 0, sgst: 0, igst: 0, tax: 0, taxableValue: 11000 });
    });

    it('splits CGST/SGST for an intra-state GST sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, true, true);
        expect(r.cgst).toBe(990);
        expect(r.sgst).toBe(990);
        expect(r.igst).toBe(0);
        expect(r.tax).toBe(1980);
        expect(r.taxableValue).toBe(11000);
    });

    it('charges IGST for an inter-state GST sale', () => {
        const r = computeGst([{ amount: 11000, gstRate: 18 }], 0, true, false);
        expect(r.igst).toBe(1980);
        expect(r.cgst).toBe(0);
        expect(r.sgst).toBe(0);
        expect(r.tax).toBe(1980);
    });

    it('allocates a sale-level discount across lines before taxing', () => {
        const r = computeGst(
            [
                { amount: 10000, gstRate: 18 },
                { amount: 10000, gstRate: 18 },
            ],
            2000,
            true,
            true
        );
        expect(r.taxableValue).toBe(18000);
        expect(r.tax).toBe(3240);
        expect(r.cgst).toBe(1620);
        expect(r.sgst).toBe(1620);
    });

    it('gives the odd paise remainder to CGST', () => {
        const r = computeGst([{ amount: 10020, gstRate: 5 }], 0, true, true);
        expect(r.tax).toBe(501);
        expect(r.cgst).toBe(251);
        expect(r.sgst).toBe(250);
    });

    it('sums mixed rates across lines', () => {
        const r = computeGst(
            [
                { amount: 10000, gstRate: 18 },
                { amount: 10000, gstRate: 5 },
            ],
            0,
            true,
            true
        );
        expect(r.tax).toBe(2300);
    });

    it('exposes per-line taxable values that sum to the discounted subtotal', () => {
        const r = computeGst(
            [
                { amount: 3333, gstRate: 18 },
                { amount: 3333, gstRate: 18 },
                { amount: 3334, gstRate: 18 },
            ],
            100,
            true,
            true
        );
        const sum = r.lines.reduce((s, l) => s + l.taxableValue, 0);
        expect(sum).toBe(9900);
    });
});
