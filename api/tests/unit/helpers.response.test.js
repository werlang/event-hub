import { describe, expect, test } from '@jest/globals';
import { sendCreated, sendSuccess } from '../../helpers/response.js';
import { createResponseDouble } from './support/doubles.js';

describe('helpers/response', () => {
    test('sendSuccess returns the standard success envelope', () => {
        const response = createResponseDouble();

        const returnedResponse = sendSuccess(response, {
            status: 202,
            data: { ok: true },
            message: 'accepted',
        });

        expect(returnedResponse).toBe(response);
        expect(response.statusCode).toBe(202);
        expect(response.body).toEqual({
            error: false,
            status: 202,
            data: { ok: true },
            message: 'accepted',
        });
    });

    test('sendCreated sends a 201 response envelope', () => {
        const response = createResponseDouble();

        sendCreated(response, { data: { id: 'event-1' } });

        expect(response.statusCode).toBe(201);
        expect(response.body).toEqual({
            error: false,
            status: 201,
            data: { id: 'event-1' },
        });
    });
});