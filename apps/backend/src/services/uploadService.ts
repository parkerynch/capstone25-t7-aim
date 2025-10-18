import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

export const generatePresignedUrl = async (fileName: string) => {
    const key = `${uuidv4()}-${fileName}`;

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600,
    });

    // LocalStack이 생성한 URL(localhost:4566)을 클라이언트가 접근할 수 있도록 수정
    const finalSignedUrl = isLocal ? signedUrl.replace('localstack:4566', 'localhost:4566') : signedUrl;

    return { signedUrl: finalSignedUrl, key };
};
