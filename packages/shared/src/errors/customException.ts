import { ErrorCode, ErrorCodeMetadata } from './errorCode';
import { ErrorResponse } from './errorResponse';

export class CustomException extends Error {
    public readonly errorCode: ErrorCode;
    public readonly httpStatus: number;

    constructor(errorCode: ErrorCode, details?: string) {
        const metadata = ErrorCodeMetadata[errorCode];
        super(details || metadata.message);
        this.errorCode = errorCode;
        this.httpStatus = metadata.httpStatus;
        this.name = 'CustomException';
    }

    // ErrorResponse 생성
    toErrorResponse(): ErrorResponse {
        return {
            code: this.errorCode,
            message: this.message,
        };
    }
}
