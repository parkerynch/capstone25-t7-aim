import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET, useLocalStack } from '../lib/s3Client';
import { v4 as uuidv4 } from 'uuid';
import { AimException, ErrorCode } from '@shared/errors';
import axios from 'axios';
import { deploymentRepository } from '../repositories/deployment.repository';

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
const isProduction = process.env.NODE_ENV === 'production';

// 개발/운영 환경에 따라 baseURL 분기
const baseURL = 'https://openapi.eureka.codes/v1'; // 항상 v1 사용

// axios 인스턴스 생성
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
    },
    timeout: 60_000,
    maxBodyLength: Infinity,
});

export async function pollForWebsiteUrl(deploymentDbId: string, eurekaDeploymentId: string): Promise<void> {
    const maxAttempts = 50; // 최대 50회 시도 (약 8분 20초, 10초 간격)
    const intervalMs = 10000; // 10초 간격

    // 배포 시작 시 currentStep을 DEPLOYING_FRONTEND로 설정
    await deploymentRepository.updateDeploymentData(deploymentDbId, { currentStep: 'DEPLOYING_FRONTEND' });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Polling attempt ${attempt}/${maxAttempts} for website URL (Eureka ID: ${eurekaDeploymentId})`);

            const productPath = `/codes/${eurekaDeploymentId}@2/product`;
            const productResponse = await api.get(productPath);

            if (productResponse.data.progress$ && productResponse.data.progress$.status === 'running') {
                const websiteEndpoint = productResponse.data.stack$.websiteEndpoint;
                console.log(`🌐 Website Endpoint found: ${websiteEndpoint}`);

                // DB에 websiteEndpoint 저장, currentStep을 FINALIZING으로 설정
                await deploymentRepository.updateDeploymentData(deploymentDbId, {
                    websiteUrl: websiteEndpoint,
                    currentStep: 'FINALIZING',
                });
                console.log(`✅ Website URL saved to DB: ${websiteEndpoint}`);
                return; // 성공하면 종료
            } else {
                console.log(`⏳ Website Endpoint not ready yet (attempt ${attempt})`);
            }
        } catch (error) {
            console.log(`⚠️ Polling error (attempt ${attempt}):`, error);
        }

        // 마지막 시도가 아니면 대기
        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }

    console.log(`❌ Failed to get website URL after ${maxAttempts} attempts`);
}

export interface ProductUploadBody {
    data: string; // Base64 인코딩된 Zip 데이터
    title: string;
    version?: string;
}

export interface UploadResponse {
    s3Uri: string; // 업로드 결과 URL
    eurekaDeploymentId: string; // Eureka API에서 반환된 deployment ID
}

export async function uploadProduct(
    body: ProductUploadBody,
    deploymentDbId: string, // DB의 deployment _id
    productId: number = 1008343, // ID 고정
    step: string = 'build-monorepo', // step 파라미터 추가
): Promise<UploadResponse> {
    try {
        const useMock = false; // mock 모드 비활성화
        const path = `/codes/${productId}/upload?step=${step}${useMock ? '&mock=1' : ''}`;

        console.log(`> Uploading to: ${api.defaults.baseURL}${path}`);
        console.log(`> Using Product ID: ${productId} (${!isProduction ? 'DEMO' : 'PRODUCTION'})`);

        console.log('\n=== REQUEST BODY FOR POSTMAN ===');
        console.log(JSON.stringify(body, null, 2));
        console.log('=================================\n');

        // axios로 POST 요청
        const response = await api.post(path, body);

        // axios response 확인
        console.log('\n=== UPLOAD RESPONSE ===');
        console.log('Status:', response.status, response.statusText);
        console.log('Response Data:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('======================\n');

        // 1. Upload response에서 id 추출
        if (response.data.id) {
            const eurekaDeploymentId = response.data.id;
            console.log(`Eureka Deployment ID: ${eurekaDeploymentId}`);

            return { s3Uri: response.data.s3Uri, eurekaDeploymentId };
        }

        return { s3Uri: response.data.s3Uri, eurekaDeploymentId: '' };
    } catch (error) {
        console.error('Failed to upload product to external API:', error);
        if (axios.isAxiosError(error)) {
            console.error('Response status:', error.response?.status);
            console.error('Response data:', error.response?.data);
        }
        throw new AimException(ErrorCode.S3_UPLOAD_FAILED, `Product API upload failed`);
    }
}
