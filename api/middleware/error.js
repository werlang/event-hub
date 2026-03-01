const ERROR_TYPES = {
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    409: 'Conflict',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    504: 'Gateway Timeout',
};

export function errorMiddleware(err, req, res, next) {
    if (!err) {
        next();
        return;
    }

    const derivedStatus = err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError'
        ? 401
        : null;

    const status = Number.isInteger(err.status)
        ? err.status
        : (Number.isInteger(err.code) ? err.code : (derivedStatus || 500));

    const safeStatus = ERROR_TYPES[status] ? status : 500;
    const payload = {
        error: true,
        status: safeStatus,
        type: err.type || ERROR_TYPES[safeStatus],
        message: safeStatus === 500
            ? (err.expose ? err.message : 'Internal Server Error')
            : (err.message || ERROR_TYPES[safeStatus]),
    };

    if (err.data !== undefined && err.data !== null) {
        payload.data = err.data;
    }

    if (safeStatus === 500 && process.env.NODE_ENV !== 'production') {
        payload.data = payload.data || { detail: err.message };
    }

    res.status(safeStatus).json(payload);
}
