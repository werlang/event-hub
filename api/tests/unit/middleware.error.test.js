import { afterEach, describe, expect, test } from '@jest/globals';
import { CustomError, HttpError } from '../../helpers/error.js';
import { errorMiddleware } from '../../middleware/error.js';
import { createResponseDouble } from './support/doubles.js';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
});

describe('middleware/error', () => {
    test('serializes HttpError instances with the project envelope', () => {
        const response = createResponseDouble();

        errorMiddleware(new HttpError(409, 'Duplicado'), {}, response, () => {});

        expect(response.statusCode).toBe(409);
        expect(response.body).toEqual({
            error: true,
            status: 409,
            type: 'Conflict',
            message: 'Duplicado',
        });
    });

    test('maps JWT parser failures to 401', () => {
        const response = createResponseDouble();

        errorMiddleware({ name: 'JsonWebTokenError', message: 'invalid token' }, {}, response, () => {});

        expect(response.statusCode).toBe(401);
        expect(response.body).toEqual({
            error: true,
            status: 401,
            type: 'Unauthorized',
            message: 'invalid token',
        });
    });

    test('preserves debug data outside production', () => {
        process.env.NODE_ENV = 'test';
        const response = createResponseDouble();

        errorMiddleware(new CustomError('boom', { detail: 'trace' }), {}, response, () => {});

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: true,
            status: 500,
            type: 'Internal Server Error',
            message: 'boom',
            data: { detail: 'trace' },
        });
    });

    test('hides debug data in production', () => {
        process.env.NODE_ENV = 'production';
        const response = createResponseDouble();

        errorMiddleware(new CustomError('boom', { detail: 'trace' }), {}, response, () => {});

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: true,
            status: 500,
            type: 'Internal Server Error',
            message: 'boom',
        });
    });

    test('delegates to next when no error is provided', () => {
        const calls = [];

        errorMiddleware(null, {}, createResponseDouble(), value => {
            calls.push(value);
        });

        expect(calls).toEqual([undefined]);
    });
});