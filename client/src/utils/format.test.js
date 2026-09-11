import { describe, it, expect } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
    it('formats an ISO date as a short date string', () => {
        // 10:30 UTC is still 5 Sep in both UTC and IST (UTC+5:30), so this is
        // deterministic regardless of the machine timezone.
        expect(formatDate('2026-09-05T10:30:00.000Z')).toBe('05 Sep 2026');
    });

    it('returns an empty string for invalid dates', () => {
        expect(formatDate('not-a-date')).toBe('');
        expect(formatDate(undefined)).toBe('');
    });
});
