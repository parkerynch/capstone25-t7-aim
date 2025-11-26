import { Deployment, IDeployment } from '../models/deployment.model';
import { Log, ILog } from '../models/log.model';
import { DeploymentResponse } from '@shared/types';
import { Document } from 'mongoose';
import { AimException, ErrorCode } from '@shared/errors';

// --- DTO 변환 헬퍼 ---
type DeploymentDoc = Document & IDeployment;
type LogDoc = Document & ILog;

/** Mongoose 문서를 DeploymentResponse DTO로 변환합니다. */
function mapToDeploymentResponse(doc: DeploymentDoc): DeploymentResponse {
    const obj = doc.toObject();
    return {
        id: obj._id.toString(),
        projectId: obj.projectId.toString(),
        status: obj.status,
        currentStep: obj.currentStep,
        websiteUrl: obj.websiteUrl,
        eurekaDeploymentId: obj.eurekaDeploymentId,
        errorMessage: obj.errorMessage,
        startedAt: obj.startedAt.toISOString(),
        completedAt: obj.completedAt ? obj.completedAt.toISOString() : undefined,
    };
}

// --- Repository 객체 ---
export const deploymentRepository = {
    async getDeploymentById(deploymentId: string): Promise<{ deployment: DeploymentResponse; logs: LogDoc[] }> {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) {
            throw new AimException(ErrorCode.NOT_FOUND);
        }

        const logs = await Log.find({ deploymentId }).sort({ timestamp: 1 });

        return {
            deployment: mapToDeploymentResponse(deployment),
            logs,
        };
    },

    async updateDeploymentUrls(deploymentId: string, websiteUrl?: string): Promise<void> {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (websiteUrl !== undefined) {
            updateData.websiteUrl = websiteUrl;
        }

        await Deployment.updateOne({ _id: deploymentId }, { $set: updateData });
    },
};
