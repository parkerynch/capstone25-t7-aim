import { Router } from 'express';
import { uploadToS3 } from '../services/uploadService';
import { addDeploymentJob } from '../services/queueService';
import { projectRepository } from '../repositories/project.repository';

const router = Router();

router.get('/projects', async (req, res) => {
    try {
        const projects = await projectRepository.getAllProjects();
        res.json(projects);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching projects' });
    }
});

router.get('/projects/:id', async (req, res) => {
    try {
        const project = await projectRepository.getProjectById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching project' });
    }
});

router.delete('/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await projectRepository.deleteProjectById(id);
        if (!deleted) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting project' });
    }
});

router.post('/projects', async (req, res) => {
    const { fileName, projectName, fileData } = req.body;

    if (!fileName || !projectName || !fileData) {
        return res.status(400).json({
            message: 'fileName, projectName, and fileData are required',
        });
    }

    try {
        // 1. Upload file to S3 directly
        const { key } = await uploadToS3(fileData, fileName);

        // 2. Save project to database using repository
        const projectId = await projectRepository.createProject({
            name: projectName,
            description: '',
            version: '1.0.0',
            tags: [],
            zipFileUrl: key,
            originalFileName: fileName,
            fileSize: Buffer.from(fileData, 'base64').length,
        });

        // 3. Add deployment job to queue
        const deploymentId = await addDeploymentJob({
            projectId,
            s3Key: key,
        });

        res.status(201).json({
            projectId,
            deploymentId,
            message: 'Project created and deployment started successfully',
        });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ message: 'Error creating project' });
    }
});

export default router;
