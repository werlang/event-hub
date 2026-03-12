/**
 * Sends a success response using the project's envelope contract.
 */
export function sendSuccess(res, { status = 200, data = null, message } = {}) {
    const payload = {
        error: false,
        status,
        data,
    };

    if (message) {
        payload.message = message;
    }

    return res.status(status).json(payload);
}

/**
 * Sends a 201 Created response using the success envelope.
 */
export function sendCreated(res, { data = null, message } = {}) {
    return sendSuccess(res, { status: 201, data, message });
}
