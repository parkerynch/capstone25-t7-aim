import { Deployment, IDeployment } from '../models/deployment.model';
import { Log, ILog } from '../models/log.model';
import { DeploymentResponse } from '@shared/types';
import { Document } from 'mongoose';

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
        frontendUrl: obj.frontendUrl,
        backendUrl: obj.backendUrl,
        errorMessage: obj.errorMessage,
        startedAt: obj.startedAt.toISOString(),
        completedAt: obj.completedAt ? obj.completedAt.toISOString() : undefined,
    };
}

// --- Repository 객체 ---
export const deploymentRepository = {
    async getDeploymentById(deploymentId: string): Promise<{ deployment: DeploymentResponse; logs: LogDoc[] } | null> {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) {
            return null;
        }

        const logs = await Log.find({ deploymentId }).sort({ timestamp: 1 });

        return {
            deployment: mapToDeploymentResponse(deployment),
            logs,
        };
    },

    async getDeploymentStatusById(deploymentId: string): Promise<{
        status: DeploymentResponse['status'];
        currentStep: DeploymentResponse['currentStep'];
        projectId: string;
        frontendUrl?: string;
        backendUrl?: string;
    } | null> {
        const deployment = await Deployment.findById(deploymentId).select(
            'status currentStep projectId frontendUrl backendUrl',
        );
        if (!deployment) {
            return null;
        }

        return {
            status: deployment.status,
            currentStep: deployment.currentStep,
            projectId: deployment.projectId.toString(),
            frontendUrl: deployment.frontendUrl,
            backendUrl: deployment.backendUrl,
        };
    },
};
