const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Formats an ISO date string as a short, deterministic date, e.g. "05 Sep 2026".
// Deliberately avoids toLocaleDateString so output is stable across environments.
export const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    return `${day} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
