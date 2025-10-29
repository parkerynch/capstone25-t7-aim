import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const S3_BUCKET = process.env.S3_BUCKET || 'aim-deploy-bucket';
const S3_REGION = process.env.S3_REGION || 'ap-northeast-2';

// 💻 로컬 환경일 때 LocalStack을 사용하도록 설정 추가
const isLocal = process.env.NODE_ENV === 'development'; // 환경 변수로 로컬 여부 판단

const s3Client = new S3Client({
    region: S3_REGION,
    // 로컬 환경일 경우에만 endpoint와 credentials 설정
    ...(isLocal && {
        endpoint: 'http://localhost:4566', // LocalStack 주소
        credentials: {
            accessKeyId: 'test', // LocalStack은 아무 값이나 사용 가능
            secretAccessKey: 'test',
        },
        forcePathStyle: true, // S3 경로 스타일을 강제 (LocalStack에 필요)
    }),
});

export const uploadToS3 = async (base64Data: string, fileName: string) => {
    const key = `${uuidv4()}-${fileName}`;

    // Base64 데이터를 Buffer로 변환
    const buffer = Buffer.from(base64Data, 'base64');

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: 'application/zip', // ZIP 파일로 가정
    });

    try {
        await s3Client.send(command);
        console.log(`✅ File uploaded to S3: ${key}`);
        return { key };
    } catch (error) {
        console.error('❌ S3 upload failed:', error);
        throw error;
    }
};

export const generateReadOnlyUrl = async (s3Key: string) => {
    const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
    });

    // 읽기용 URL 생성
    const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600, // 1시간 동안 유효
    });

    // LocalStack URL 수정
    const finalSignedUrl = isLocal ? signedUrl.replace('localstack:4566', 'localhost:4566') : signedUrl;

    return { signedUrl: finalSignedUrl };
};
