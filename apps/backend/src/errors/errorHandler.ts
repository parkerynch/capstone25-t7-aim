import { CustomException } from '@shared/errors/customException';

export const handleError = (error: unknown): { statusCode: number; body: string } => {
    if (error instanceof CustomException) {
        return {
            statusCode: error.httpStatus,
            body: JSON.stringify({
                success: false,
                error: error.toErrorResponse(),
            }),
        };
    }
    // 기본 에러
    return {
        statusCode: 500,
        body: JSON.stringify({
            success: false,
            error: { code: 'AIMDEP00100', message: '내부 서버 오류' },
        }),
    };
};
