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

export function sendCreated(res, { data = null, message } = {}) {
    return sendSuccess(res, { status: 201, data, message });
}
