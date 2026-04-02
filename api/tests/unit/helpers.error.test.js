import { describe, expect, test } from '@jest/globals';
import { CustomError, HttpError } from '../../helpers/error.js';

describe('helpers/error', () => {
    test('CustomError stores the message and debug payload', () => {
        const error = new CustomError('broken', { detail: 'stack omitted' });

        expect(error.name).toBe('CustomError');
        expect(error.message).toBe('broken');
        expect(error.data).toEqual({ detail: 'stack omitted' });
    });

    test('HttpError normalizes the status and exposes safe properties', () => {
        const error = new HttpError(404, 'missing');

        expect(error.name).toBe('HttpError');
        expect(error.status).toBe(404);
        expect(error.code).toBe(404);
        expect(error.expose).toBe(true);
        expect(error.type).toBeNull();
    });
});