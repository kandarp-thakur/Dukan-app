// All money values are paise integers (₹123.45 = 12345).

export const paiseToRupees = (paise) => (paise || 0) / 100;

export const rupeesToPaise = (rupees) => Math.round((Number(rupees) || 0) * 100);

// Indian grouping: last 3 digits, then groups of 2 (12,34,567).
const groupIndian = (digits) => {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    if (!rest) return last3;
    const parts = [];
    for (let i = rest.length; i > 0; i -= 2) {
        parts.unshift(rest.slice(Math.max(0, i - 2), i));
    }
    return [...parts, last3].join(',');
};

export const formatINR = (paise) => {
    const negative = paise < 0;
    const abs = Math.abs(paise || 0);
    const rupees = Math.floor(abs / 100);
    const remainder = abs % 100;
    const grouped = groupIndian(String(rupees));
    const sign = negative ? '-' : '';
    if (remainder === 0) return `${sign}₹${grouped}`;
    return `${sign}₹${grouped}.${String(remainder).padStart(2, '0')}`;
};

const ONES = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigitsToWords = (n) => {
    if (n < 20) return ONES[n];
    const ten = Math.floor(n / 10);
    const one = n % 10;
    return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
};

const threeDigitsToWords = (n) => {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const parts = [];
    if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
    if (rest) parts.push(twoDigitsToWords(rest));
    return parts.join(' ');
};

// Indian numbering: crore, lakh, thousand, hundred.
const rupeesToWords = (n) => {
    if (n === 0) return 'Zero';
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const rest = n % 1000;
    const parts = [];
    if (crore) parts.push(`${rupeesToWords(crore)} Crore`);
    if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
    if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
    if (rest) parts.push(threeDigitsToWords(rest));
    return parts.join(' ');
};

export const amountToWords = (paise) => {
    // Derive the magnitude before formatting so a negative input still reaches the
    // `n === 0` base case in rupeesToWords; prefix the sign on the finished string.
    const negative = paise < 0;
    const abs = Math.abs(paise || 0);
    const rupees = Math.floor(abs / 100);
    const remainder = abs % 100;
    let out = `${rupeesToWords(rupees)} Rupees`;
    if (remainder) out += ` and ${twoDigitsToWords(remainder)} Paise`;
    return `${negative ? '-' : ''}${out} Only`;
};
