import { Router } from 'express';
import { deploymentRepository } from '../repositories/deployment.repository';

const router = Router();

router.get('/deployments/:deploymentId', async (req, res) => {
    const { deploymentId } = req.params;

    try {
        const result = await deploymentRepository.getDeploymentById(deploymentId);
        if (!result) {
            return res.status(404).json({ message: 'Deployment not found' });
        }

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error getting deployment status' });
    }
});

router.get('/deployments/:deploymentId/status', async (req, res) => {
    const { deploymentId } = req.params;

    try {
        const result = await deploymentRepository.getDeploymentStatusById(deploymentId);
        if (!result) {
            return res.status(404).json({ message: 'Deployment not found' });
        }

        res.json(result);
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ message: 'Error getting deployment status' });
    }
});

export default router;
