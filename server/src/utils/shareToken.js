const crypto = require('crypto');

const DEFAULT_TTL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 32 random bytes as base64url -> 43 characters, 256 bits of entropy.
const generateShareToken = () => crypto.randomBytes(32).toString('base64url');

const shareTokenExpiry = (days) => {
    const configured = Number(process.env.SHARE_LINK_TTL_DAYS);
    const ttl = Number(days) || (Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_DAYS);
    return new Date(Date.now() + ttl * MS_PER_DAY);
};

// Fails closed: a token with no usable expiry is expired, never permanent.
const isTokenExpired = (sale) => {
    const expiry = sale && sale.shareTokenExpiresAt;
    if (!expiry) return true;
    const when = expiry instanceof Date ? expiry : new Date(expiry);
    if (Number.isNaN(when.getTime())) return true;
    return when.getTime() <= Date.now();
};

const shareUrlFor = (token) => {
    const base = (process.env.SHARE_LINK_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
    return `${base}/i/${token}`;
};

module.exports = { generateShareToken, shareTokenExpiry, isTokenExpired, shareUrlFor };
