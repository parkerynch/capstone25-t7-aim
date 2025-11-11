import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET, useLocalStack } from '../lib/s3Client';
import { v4 as uuidv4 } from 'uuid';
import { AimException, ErrorCode } from '@shared/errors';
import axios from 'axios';

export const uploadToS3 = async (base64Data: string, fileName: string) => {
    const key = `${uuidv4()}-${fileName}`;

    // Base64 데이터를 Buffer로 변환
    const buffer = Buffer.from(base64Data, 'base64');

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET, // import된 S3_BUCKET 사용
        Key: key,
        Body: buffer,
        ContentType: 'application/zip', // ZIP 파일로 가정
    });

    try {
        await s3Client.send(command); // import된 s3Client 사용
        console.log(`✅ File uploaded to S3: ${key}`);
        return { key };
    } catch (error) {
        console.error('❌ S3 upload failed:', error);
        throw new AimException(ErrorCode.S3_UPLOAD_FAILED);
    }
};

export const generateReadOnlyUrl = async (s3Key: string) => {
    const command = new GetObjectCommand({
        Bucket: S3_BUCKET, // import된 S3_BUCKET 사용
        Key: s3Key,
    });

    // 읽기용 URL 생성
    const signedUrl = await getSignedUrl(s3Client, command, {
        // import된 s3Client 사용
        expiresIn: 3600, // 1시간 동안 유효
    });

    // LocalStack을 사용할 때 로컬 호스트로 접근할 수 있도록 호스트 교체가 필요합니다.
    const finalSignedUrl = useLocalStack // import된 useLocalStack 사용
        ? signedUrl.replace('localstack:4566', 'localhost:4566')
        : signedUrl;

    return { signedUrl: finalSignedUrl };
};

// [중요] API_KEY가 deploymentWorker의 환경 변수에 설정되어 있어야 합니다.
const apiKey = process.env.API_KEY || 'your-api-key';

const api = axios.create({
    baseURL: 'https://8kcc2tiiqk.execute-api.ap-northeast-2.amazonaws.com',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
    },
    timeout: 60_000,
    maxBodyLength: Infinity,
});

export interface ProductUploadBody {
    data: string; // Base64 인코딩된 Zip 데이터
    title: string;
    version?: string;
}

export interface UploadResponse {
    s3Uri: string; // 업로드 결과 URL
}

export async function uploadProduct(
    body: ProductUploadBody,
    productId: number = 0, // 현재는 0으로 고정 사용
): Promise<UploadResponse> {
    try {
        const path = `/prod/products/${productId}/upload`;
        const res = await api.post<UploadResponse>(path, body);
        return res.data;
    } catch (error) {
        console.error('Failed to upload product to external API:', error);
        throw new AimException(ErrorCode.S3_UPLOAD_FAILED, `Product API upload failed`);
    }
}
