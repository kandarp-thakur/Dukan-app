// GST helpers. All money values are integer paise.
// The canonical place-of-supply value is the ISO alpha-2 state code (e.g. 'MH').

// ISO 3166-2:IN alpha-2 code -> state name. Used for the place-of-supply dropdown.
const INDIAN_STATES = {
    AN: 'Andaman and Nicobar Islands',
    AP: 'Andhra Pradesh',
    AR: 'Arunachal Pradesh',
    AS: 'Assam',
    BR: 'Bihar',
    CH: 'Chandigarh',
    CT: 'Chhattisgarh',
    DN: 'Dadra and Nagar Haveli and Daman and Diu',
    DL: 'Delhi',
    GA: 'Goa',
    GJ: 'Gujarat',
    HR: 'Haryana',
    HP: 'Himachal Pradesh',
    JK: 'Jammu and Kashmir',
    JH: 'Jharkhand',
    KA: 'Karnataka',
    KL: 'Kerala',
    LA: 'Ladakh',
    LD: 'Lakshadweep',
    MP: 'Madhya Pradesh',
    MH: 'Maharashtra',
    MN: 'Manipur',
    ML: 'Meghalaya',
    MZ: 'Mizoram',
    NL: 'Nagaland',
    OR: 'Odisha',
    PY: 'Puducherry',
    PB: 'Punjab',
    RJ: 'Rajasthan',
    SK: 'Sikkim',
    TN: 'Tamil Nadu',
    TG: 'Telangana',
    TR: 'Tripura',
    UP: 'Uttar Pradesh',
    UT: 'Uttarakhand',
    WB: 'West Bengal',
    OT: 'Other Territory',
};

const GST_RATES = [0, 5, 12, 18, 28];

// GSTIN numeric state prefix -> alpha-2 code.
const GST_NUMERIC_TO_ALPHA = {
    '01': 'JK', '02': 'HP', '03': 'PB', '04': 'CH', '05': 'UT', '06': 'HR',
    '07': 'DL', '08': 'RJ', '09': 'UP', '10': 'BR', '11': 'SK', '12': 'AR',
    '13': 'NL', '14': 'MN', '15': 'MZ', '16': 'TR', '17': 'ML', '18': 'AS',
    '19': 'WB', '20': 'JH', '21': 'OR', '22': 'CT', '23': 'MP', '24': 'GJ',
    '25': 'DN', '26': 'DN', '27': 'MH', '29': 'KA', '30': 'GA', '31': 'LD', '32': 'KL',
    '33': 'TN', '34': 'PY', '35': 'AN', '36': 'TG', '37': 'AP', '38': 'LA',
    '97': 'OT',
};

const stateCodeFromGstin = (gstin) => {
    if (!gstin || gstin.length < 2) return '';
    return GST_NUMERIC_TO_ALPHA[gstin.slice(0, 2)] || '';
};

const isIntraState = (businessGstin, placeOfSupply) => {
    const code = stateCodeFromGstin(businessGstin);
    return Boolean(code) && code === placeOfSupply;
};

// Distributes a sale-level discount across lines proportionally; the last line
// absorbs the rounding remainder so the allocated discounts sum exactly to `discount`.
const allocateDiscounts = (amounts, discount) => {
    const subtotal = amounts.reduce((s, a) => s + a, 0);
    if (!subtotal || !discount) return amounts.map(() => 0);
    const allocations = [];
    let allocated = 0;
    amounts.forEach((amount, i) => {
        if (i === amounts.length - 1) {
            allocations.push(discount - allocated);
        } else {
            const share = Math.round((discount * amount) / subtotal);
            allocations.push(share);
            allocated += share;
        }
    });
    return allocations;
};

// Per-line taxable value and total GST for that line.
const lineBreakup = (items, discount) => {
    const amounts = items.map((it) => it.amount || 0);
    const allocations = allocateDiscounts(amounts, discount || 0);
    return items.map((it, i) => {
        const taxableValue = amounts[i] - allocations[i];
        const gstRate = Number(it.gstRate) || 0;
        const tax = Math.round((taxableValue * gstRate) / 100);
        return { taxableValue, gstRate, tax };
    });
};

const computeGst = (items, discount, isGst, intraState) => {
    const lines = lineBreakup(items, discount);
    const taxableValue = lines.reduce((s, l) => s + l.taxableValue, 0);
    if (!isGst) {
        return { cgst: 0, sgst: 0, igst: 0, tax: 0, taxableValue, lines };
    }
    const gstTotal = lines.reduce((s, l) => s + l.tax, 0);
    if (intraState) {
        const cgst = Math.ceil(gstTotal / 2);
        const sgst = gstTotal - cgst;
        return { cgst, sgst, igst: 0, tax: gstTotal, taxableValue, lines };
    }
    return { cgst: 0, sgst: 0, igst: gstTotal, tax: gstTotal, taxableValue, lines };
};

module.exports = {
    INDIAN_STATES,
    GST_RATES,
    stateCodeFromGstin,
    isIntraState,
    lineBreakup,
    computeGst,
};
