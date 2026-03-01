export class CustomError extends Error {

    constructor(status = 500, message = 'Internal Server Error', data = null, cause = null) {
        super(message);
        this.name = 'CustomError';
        this.status = status;
        this.code = status;
        this.type = null;
        this.data = data;
        this.cause = cause;
    }
}
