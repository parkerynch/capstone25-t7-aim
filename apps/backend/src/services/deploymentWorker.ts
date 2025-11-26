import { Log } from '../models/log.model';
import { generateReadOnlyUrl, uploadProduct, uploadToS3, pollForWebsiteUrl } from './uploadService';
import axios from 'axios';
import { IDeployment, Deployment } from '../models/deployment.model';
import { AimException, ErrorCode } from '@shared/errors';
import { formatErrorMessage } from '../utils/formatErrorMessage';
import JSZip from 'jszip';
import * as path from 'path';

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
        await log(`Refactoring code with AI - currentStep set to: ${updatedDeployment2?.currentStep}`);

        // Generate pre-signed URL for AI analysis service
        const { signedUrl } = await generateReadOnlyUrl(s3Key);
        await log(`Generated pre-signed URL for AI analysis`);

        // Send pre-signed URL to AI analysis service
        let analyzeResponse;
        try {
            await log(`AI 분석 서비스 호출 중...`);
            analyzeResponse = await axios.post(`${AIM_HELLO_API_URL}/hello/refactor-code/gemini`, {
                s3Url: signedUrl,
            });
            await log(`AI 분석 서비스 응답 성공`);
        } catch (axiosError) {
            const errorDetails = formatErrorMessage(axiosError, 'AI analysis service failed');
            console.error(`❌ AI 분석 실패:`, errorDetails);
            throw new AimException(ErrorCode.AI_MODEL_UNAVAILABLE, errorDetails);
        }

        const analysisResult = analyzeResponse.data;

        // Check if monorepoFiles exist
        if (analysisResult.monorepoFiles && analysisResult.monorepoFiles.length > 0) {
            await log('Monorepo files generated successfully. Creating ZIP and uploading to S3.');

            // Create ZIP from monorepoFiles
            const zip = new JSZip();
            analysisResult.monorepoFiles.forEach((file: { path: string; content: string }) => {
                zip.file(file.path, file.content);
            });

            // Extract package name from package.json in the ZIP
            let packageName = `monorepo-${deployment._id as string}`; // fallback
            const packageJsonFile = analysisResult.monorepoFiles.find(
                (file: { path: string; content: string }) => file.path === 'package.json',
            );
            if (packageJsonFile) {
                try {
                    const packageJson = JSON.parse(packageJsonFile.content);
                    if (packageJson.name) {
                        packageName = packageJson.name;
                        await log(`Found package.json name: ${packageName}`);
                    }
                } catch (parseError) {
                    await log(`Warning: Could not parse package.json, using fallback name`);
                }
            }

            // Add metadata.json required by Product API
            const metadata = {
                name: packageName,
                version: '1.0.0',
                description: 'AI-generated monorepo project',
                createdAt: new Date().toISOString(),
                deploymentId: deployment._id?.toString(),
            };
            zip.file('metadata.json', JSON.stringify(metadata, null, 2));

            // Generate ZIP with proper compression and ZIP64 support
            await log(`Generating ZIP archive with ${analysisResult.monorepoFiles.length + 1} files...`);
            const zipBuffer = await zip.generateAsync({
                type: 'nodebuffer',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 9,
                },
            });
            const zipBase64 = zipBuffer.toString('base64');
            await log(
                `ZIP generated successfully. Size: ${zipBuffer.length} bytes, Base64 length: ${zipBase64.length}`,
            );

            // Save base64 to file for debugging/Postman testing
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fs = require('fs');
            const outputPath = path.join(process.cwd(), 'tmp', 'base64-output.txt');
            fs.writeFileSync(outputPath, zipBase64);
            await log(`Base64 data saved to: ${outputPath}`);

            // Use package.json name as title (required by Product API)
            const productTitle = packageName;
            const productFileName = `${packageName}.zip`;

            await log(`Using title for Product API: ${productTitle}`);
            await log(`Base64 data length: ${zipBase64.length} characters`);
            console.log('\n=== FULL BASE64 DATA (for Postman testing) ===');
            console.log(zipBase64);
            console.log('=== END BASE64 DATA ===\n');

            // NODE_ENV 값에 따라 업로드 로직 분기
            if (process.env.NODE_ENV === 'production') {
                // --- 1. 운영 환경: 실제 Product API로 업로드 ---

                await log('Production environment. Uploading to real Product API...');
                const response = await uploadProduct(
                    {
                        data: zipBase64,
                        title: productTitle,
                    },
                    (deployment._id as string).toString(),
                );
                await log(`ZIP uploaded to Product API. s3Uri: ${response.s3Uri}`);

                // Eureka Deployment ID 저장
                if (response.eurekaDeploymentId) {
                    await Deployment.updateOne(
                        { _id: deployment._id },
                        { $set: { eurekaDeploymentId: response.eurekaDeploymentId, monorepoZipUrl: response.s3Uri } },
                    );
                    await log(`Eureka Deployment ID saved: ${response.eurekaDeploymentId}`);
                    await log(`s3Uri saved as monorepoZipUrl: ${response.s3Uri}`);

                    // 비동기로 website URL 폴링 시작 (이제 s3Uri도 가져옴)
                    pollForWebsiteUrl(deployment._id as string, response.eurekaDeploymentId).catch(error => {
                        console.error('Failed to poll for website URL:', error);
                    });
                }
            } else {
                // --- 2. 테스트/개발 환경: 예전 S3(LocalStack) 로직으로 업로드 ---
                await log(`[MOCK] Development environment. Uploading to internal S3 (LocalStack)...`);

                // 1. S3에 업로드
                const { key } = await uploadToS3(zipBase64, productFileName);
                await log(`ZIP uploaded to S3 with key: ${key}`);

                // 2. S3 URL 생성
                const { signedUrl } = await generateReadOnlyUrl(key);
                await log(`Generated signed URL for ZIP: ${signedUrl}`);

                // Development에서는 monorepoZipUrl을 signedUrl로 저장
                await Deployment.updateOne({ _id: deployment._id }, { $set: { monorepoZipUrl: signedUrl } });
            }
        } else {
            await log('No monorepo files generated.');
        } // Check if refactoring was successful
        if (analysisResult.monorepoFiles && analysisResult.monorepoFiles.length > 0) {
            await log('Code refactoring completed successfully.');
        } else {
            await log('Code refactoring may have issues.');
        }

        // Extract analysis data (for future use)
        // const analysis = analysisResult.analysis || analysisResult;

        // 실제 배포는 Eureka에서 처리되므로 여기서는 완료 처리만
        await log('Deployment process completed. Waiting for Eureka deployment to finish.');
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
