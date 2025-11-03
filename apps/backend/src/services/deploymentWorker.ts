import { Log } from '../models/log.model';
import { generateReadOnlyUrl } from './uploadService';
import axios from 'axios';
import { IDeployment, Deployment } from '../models/deployment.model';
import { AimException, ErrorCode } from '@shared/errors';
import { formatErrorMessage } from '../utils/formatErrorMessage';

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
export const processDeploymentJob = async (deployment: IDeployment) => {
    const { s3Key } = deployment;

    const log = async (message: string) => {
        const newLog = new Log({
            deploymentId: deployment._id as string,
            message,
        });
        await newLog.save();
        console.log(`[Deployment ${deployment._id as string}] ${message}`);
    };

    // Initialize framework variables (for future use)
    // const frontendFramework: string | null = null;
    // const backendFramework: string | null = null;

    try {
        // File Upload 단계
        await Deployment.updateOne({ _id: deployment._id }, { $set: { currentStep: 'UPLOADING' } });
        const updatedDeployment1 = await Deployment.findById(deployment._id);
        await log(`File Upload - currentStep set to: ${updatedDeployment1?.currentStep}`);

        // Analyzing 단계
        await Deployment.updateOne({ _id: deployment._id }, { $set: { currentStep: 'ANALYZING' } });
        const updatedDeployment2 = await Deployment.findById(deployment._id);
        await log(`Generating Blog Content with AI - currentStep set to: ${updatedDeployment2?.currentStep}`);

        // Generate pre-signed URL for AI analysis service
        const { signedUrl } = await generateReadOnlyUrl(s3Key);
        await log(`Generated pre-signed URL for AI analysis`);

        // Send pre-signed URL to AI analysis service
        let analyzeResponse;
        try {
            analyzeResponse = await axios.post(`${AIM_HELLO_API_URL}/hello/generate-blog-content/gemini`, {
                keyword: 'code analysis', // 나중에 동적으로 변경
                s3Url: signedUrl,
            });
        } catch (axiosError) {
            const errorDetails = formatErrorMessage(axiosError, 'AI analysis service failed');
            console.error(errorDetails);
            throw new AimException(ErrorCode.AI_MODEL_UNAVAILABLE, errorDetails);
        }
        const analysisResult = analyzeResponse.data;
        await log(`Blog content generated: ${JSON.stringify(analysisResult)}`);

        // Check if blog content was generated
        if (analysisResult.titles && analysisResult.tags) {
            await log('Blog content generated successfully. Proceeding with deployment.');
        } else {
            await log('Blog content generation may have issues.');
        }

        // Extract analysis data (for future use)
        // const analysis = analysisResult.analysis || analysisResult;

        // Splitting 단계
        await Deployment.updateOne({ _id: deployment._id }, { $set: { currentStep: 'SPLITTING' } });
        const updatedDeployment3 = await Deployment.findById(deployment._id);
        await log(`Splitting Frontend & Backend - currentStep set to: ${updatedDeployment3?.currentStep}`);
        // This is a conceptual step, no actual code needed for this simulation

        // Deploying Backend 단계
        await Deployment.updateOne({ _id: deployment._id }, { $set: { currentStep: 'DEPLOYING_BACKEND' } });
        const updatedDeployment4 = await Deployment.findById(deployment._id);
        await log(`Deploying Backend to AWS Lambda - currentStep set to: ${updatedDeployment4?.currentStep}`);

        // TODO: Implement actual AWS Lambda deployment
        // 1. Create Lambda function from backend code
        // 2. Set up API Gateway for the Lambda
        // 3. Configure environment variables
        // For now, simulate deployment with LocalStack

        const backendUrl = `https://${deployment._id}-backend.lambda-url.us-east-1.on.aws/`;

        // Simulate deployment delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        await log(`Backend deployed successfully at ${backendUrl}`);

        // Update deployment with backend URL
        await Deployment.updateOne({ _id: deployment._id }, { $set: { backendUrl } });

        // Deploying Frontend 단계
        await Deployment.updateOne({ _id: deployment._id }, { $set: { currentStep: 'DEPLOYING_FRONTEND' } });
        const updatedDeployment5 = await Deployment.findById(deployment._id);
        await log(`Deploying Frontend to AWS S3 - currentStep set to: ${updatedDeployment5?.currentStep}`);

        // TODO: Implement actual AWS S3 static website hosting
        // 1. Build frontend application
        // 2. Upload build artifacts to S3 bucket
        // 3. Configure S3 for static website hosting
        // 4. Set up CloudFront CDN (optional)
        // For now, simulate deployment with LocalStack

        const frontendUrl = `https://${deployment._id}-frontend.s3-website-us-east-1.amazonaws.com/`;

        // Simulate deployment delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        await log(`Frontend deployed successfully at ${frontendUrl}`);

        // Update deployment with frontend URL
        await Deployment.updateOne({ _id: deployment._id }, { $set: { frontendUrl } });

        // Finalizing 단계
        await Deployment.updateOne({ _id: deployment._id }, { $set: { currentStep: 'FINALIZING' } });
        const updatedDeployment6 = await Deployment.findById(deployment._id);
        await log(`Finalizing Deployment - currentStep set to: ${updatedDeployment6?.currentStep}`);
        // Deployment status update will be handled in queueService
        await log('Deployment completed successfully.');
    } catch (error) {
        console.error(error);
        if (error instanceof AimException) {
            const aimError = error as AimException;
            await log(`Deployment failed: ${aimError.message}`);
        } else {
            await log(`Deployment failed: ${String(error)}`);
        }
        throw error; // Re-throw to let queueService handle status update
    }
};
