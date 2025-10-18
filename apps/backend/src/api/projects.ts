import { Router } from 'express';
import { generatePresignedUrl } from '../services/uploadService';
import { Project } from '../models/project.model';
import { addDeploymentJob } from '../services/queueService';

const router = Router();

router.post('/projects', async (req, res) => {
    const { fileName } = req.body;

    if (!fileName) {
        return res.status(400).json({ message: 'fileName is required' });
    }

    try {
        const { signedUrl, key } = await generatePresignedUrl(fileName);

        const project = new Project({
            fileName: key,
        });
        await project.save();

        await addDeploymentJob({
            projectId: project._id as string,
            s3Key: key,
        });

        res.status(201).json({ signedUrl, key });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error generating pre-signed URL' });
    }
});

export default router;