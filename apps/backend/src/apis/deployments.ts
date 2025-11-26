import { Router } from 'express';
import { deploymentRepository } from '../repositories/deployment.repository';

const router = Router();

router.get('/deployments/:deploymentId', async (req, res) => {
    const { deploymentId } = req.params;
    const result = await deploymentRepository.getDeploymentById(deploymentId);
    res.json(result);
});

router.get('/deployments/:deploymentId/status', async (req, res) => {
    const { deploymentId } = req.params;
    const result = await deploymentRepository.getDeploymentById(deploymentId);
    // status API를 위한 간소화된 응답
    const statusResponse = {
        status: result.deployment.status,
        currentStep: result.deployment.currentStep,
        projectId: result.deployment.projectId,
        websiteUrl: result.deployment.websiteUrl,
    };
    res.json(statusResponse);
});

export default router;
