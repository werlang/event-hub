import { describe, expect, test } from '@jest/globals';
import { getCurrentWeekRangeLocal } from '../../helpers/week-range.js';

describe('helpers/week-range', () => {
    test('uses the requested time zone when resolving the current Sunday-to-Saturday range', () => {
        const referenceDate = new Date('2026-04-11T12:30:00.000Z');

        expect(getCurrentWeekRangeLocal(referenceDate)).toEqual({
            from: '2026-04-05',
            to: '2026-04-11',
        });
        expect(getCurrentWeekRangeLocal(referenceDate, { timeZone: 'Pacific/Kiritimati' })).toEqual({
            from: '2026-04-12',
            to: '2026-04-18',
        });
    });
});