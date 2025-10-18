import { Deployment } from '../models/deployment.model';
import { Service } from '../models/service.model';
import { Log } from '../models/log.model';
import { generatePresignedUrl } from './uploadService';
import axios from 'axios';

const AIM_HELLO_API_URL = process.env.AIM_HELLO_API_URL || 'http://localhost:8000';

/**
 * 배포 작업 처리 함수
 *
 * 현재 구현: MongoDB 기반으로 배포 작업 처리
 * - DB에서 배포 데이터를 직접 받아 처리
 * - 배포 상태를 DB에 저장
 *
 * 향후 개선: Redis + BullMQ 기반으로 변경 가능
 * - Job 타입으로 변경
 * - 작업 큐에서 Job 데이터 받기
 */
export const processDeploymentJob = async (deploymentData: any) => {
    const { _id, projectId, s3Key } = deploymentData;

    const deployment = await Deployment.findById(_id);

    if (!deployment) {
        throw new Error(`Deployment ${_id} not found`);
    }

    const log = async (message: string) => {
        const newLog = new Log({
            deploymentId: deployment._id,
            message,
        });
        await newLog.save();
        console.log(`[Deployment ${deployment._id}] ${message}`);
    };

    try {
        await log('Deployment process started.');

        // 1. Get analysis from aim-hello-api
        await log('Analyzing project...');
        const { signedUrl } = await generatePresignedUrl(s3Key);
        const analyzeResponse = await axios.post(`${AIM_HELLO_API_URL}/hello/analyze`, {
            s3Url: signedUrl,
        });
        const analysis = analyzeResponse.data;
        await log(`Analysis complete: ${JSON.stringify(analysis)}`);

        // 2. Deploy frontend
        await log('Deploying frontend...');
        const frontendService = new Service({
            deploymentId: deployment._id,
            type: 'FRONTEND',
            status: 'DEPLOYING',
        });
        await frontendService.save();

        // TODO: Implement actual frontend deployment logic
        // 1. Download the project zip file from S3.
        // 2. Unzip the file.
        // 3. Navigate to the 'apps/frontend' directory.
        // 4. Install dependencies using 'npm install'.
        // 5. Build the React application using 'npm run build'.
        // 6. Upload the 'build' directory to a static hosting service (e.g., AWS S3, Vercel, Netlify).
        // 7. Get the URL of the deployed frontend service.

        frontendService.status = 'RUNNING';
        frontendService.url = 'http://frontend-url.com'; // Replace with actual URL
        await frontendService.save();
        await log('Frontend deployed successfully.');

        // 3. Deploy backend
        await log('Deploying backend...');
        const backendService = new Service({
            deploymentId: deployment._id,
            type: 'BACKEND',
            status: 'DEPLOYING',
        });
        await backendService.save();

        // TODO: Implement actual backend deployment logic
        // 1. Download the project zip file from S3.
        // 2. Unzip the file.
        // 3. Navigate to the 'apps/backend' directory.
        // 4. Create a Dockerfile if it doesn't exist.
        // 5. Build a Docker image.
        // 6. Push the Docker image to a container registry (e.g., Amazon ECR, Docker Hub).
        // 7. Deploy the Docker image to a container orchestration service (e.g., Amazon ECS, Kubernetes).
        // 8. Get the URL of the deployed backend service.

        backendService.status = 'RUNNING';
        backendService.url = 'http://backend-url.com'; // Replace with actual URL
        await backendService.save();
        await log('Backend deployed successfully.');

        deployment.status = 'SUCCESS';
        await deployment.save();
        await log('Deployment completed successfully.');
    } catch (error) {
        console.error(error);
        deployment.status = 'FAILED';
        await deployment.save();
        if (error instanceof Error) {
            await log(`Deployment failed: ${error.message}`);
        } else {
            await log(`Deployment failed: ${String(error)}`);
        }
    }
};
