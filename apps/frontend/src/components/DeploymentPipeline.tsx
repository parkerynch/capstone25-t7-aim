import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface PipelineStep {
    id: number;
    title: string;
    description: string;
    status: 'completed' | 'in-progress' | 'failed' | 'pending';
}

interface EnvVar {
    key: string;
    value: string;
}

interface Service {
    type: 'FRONTEND' | 'BACKEND';
    url: string;
}

export default function DeploymentPipeline(): JSX.Element {
    const location = useLocation();
    const navigate = useNavigate();
    const { deploymentId } = useParams();

    // location.state에서 데이터 받기
    const { projectName, envVars: initialEnvVars } = location.state || {};

    const [steps, setSteps] = useState<PipelineStep[]>([
        { id: 1, title: 'File Upload', description: 'AI Agent ZIP file uploaded successfully', status: 'in-progress' },
        { id: 2, title: 'Analyzing Code', description: 'Analyzing code structure and dependencies', status: 'pending' },
        { id: 3, title: 'Splitting Frontend & Backend', description: 'Separating app layers...', status: 'pending' },
        {
            id: 4,
            title: 'Deploying Backend',
            description: 'Setting up backend infra on AWS Lambda...',
            status: 'pending',
        },
        {
            id: 5,
            title: 'Deploying Frontend',
            description: 'Publishing static files to S3 & CloudFront',
            status: 'pending',
        },
        {
            id: 6,
            title: 'Finalizing Deployment',
            description: 'Finishing build & testing routes...',
            status: 'pending',
        },
    ]);

    const [isAutoProgress, setIsAutoProgress] = useState(true);
    const [isDeploymentComplete, setIsDeploymentComplete] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [deployedUrl, setDeployedUrl] = useState('');
    const [envVars, setEnvVars] = useState<EnvVar[]>(
        initialEnvVars || [
            { key: 'API_KEY', value: 'sk-1234567890abcdef' },
            { key: 'DB_URL', value: 'postgresql://localhost:5432/mydb' },
            { key: 'NODE_ENV', value: 'production' },
        ],
    );

    useEffect(() => {
        const fetchDeploymentStatus = async () => {
            if (deploymentId) {
                try {
                    const response = await fetch(`/api/deployments/${deploymentId}`);
                    const data = await response.json();

                    // Update steps based on the fetched data
                    const newSteps = steps.map(step => {
                        // This is a simplified example.
                        // In a real application, you would have a more sophisticated mapping
                        // between the backend status and the frontend steps.
                        if (data.deployment.status === 'SUCCESS') {
                            return { ...step, status: 'completed' as 'completed' };
                        } else if (data.deployment.status === 'FAILED') {
                            return { ...step, status: 'failed' as 'failed' };
                        }
                        return step;
                    });
                    setSteps(newSteps);

                    if (data.deployment.status === 'SUCCESS' || data.deployment.status === 'FAILED') {
                        setIsDeploymentComplete(true);
                        if (data.deployment.status === 'SUCCESS') {
                            // Assuming the backend returns the URL of the deployed service
                            setDeployedUrl(data.services.find((s: Service) => s.type === 'FRONTEND')?.url || '');
                            setShowModal(true);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching deployment status:', error);
                }
            }
        };

        const interval = setInterval(fetchDeploymentStatus, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, [deploymentId]);

    const progressPercent = (steps.filter(s => s.status === 'completed').length / steps.length) * 100;

    const handleVisitSite = () => {
        window.open(deployedUrl, '_blank');
        setShowModal(false);
    };

    const handleGoToProject = () => {
        setShowModal(false);
        navigate('/project');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b p-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-7xl mx-auto">
                {/* ---- Left: Deployment Progress ---- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="backdrop-blur-lg bg-white/80 border border-gray-200 rounded-2xl shadow-lg p-8"
                >
                    <h2 className="text-2xl font-bold mb-2">🚀 Deployment Pipeline</h2>
                    <p className="text-gray-500 mb-6">Monitor your build and deployment progress in real-time.</p>

                    {/* Progress Bar */}
                    <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden mb-8">
                        <motion.div
                            className="h-3 bg-gradient-to-r from-cyan-400 to-blue-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>

                    {/* Steps */}
                    <div className="space-y-6">
                        {steps.map((step, idx) => (
                            <motion.div
                                key={step.id}
                                className={`flex items-start gap-4 p-4 rounded-xl ${
                                    step.status === 'completed'
                                        ? 'bg-green-50 border border-green-100'
                                        : step.status === 'in-progress'
                                          ? 'bg-blue-50 border border-blue-100'
                                          : 'bg-gray-50 border border-gray-100'
                                }`}
                                whileHover={{ scale: 1.01 }}
                            >
                                <div
                                    className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
                                        step.status === 'completed'
                                            ? 'bg-green-500 text-white'
                                            : step.status === 'in-progress'
                                              ? 'bg-blue-500 text-white'
                                              : 'bg-gray-300 text-gray-600'
                                    }`}
                                >
                                    {step.status === 'completed' ? '✓' : idx + 1}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800">{step.title}</h3>
                                    <p className="text-sm text-gray-500">{step.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Bottom Buttons */}
                    <div className="mt-8">
                        {isDeploymentComplete ? (
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowModal(true)}
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-3 rounded-lg font-semibold shadow-md"
                            >
                                Deployment Completed
                            </motion.button>
                        ) : (
                            <button
                                onClick={() => setIsAutoProgress(!isAutoProgress)}
                                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg transition-colors"
                            >
                                {isAutoProgress ? '⏸ Pause Auto Progress' : '▶ Resume Auto Progress'}
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* ---- Right: Env Variables ---- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="backdrop-blur-lg bg-white/80 border border-gray-200 rounded-2xl shadow-lg p-8"
                >
                    <h2 className="text-2xl font-bold mb-6">ProjectName : {projectName || 'Unknown'}</h2>

                    <div className="space-y-3 ">
                        {envVars.map((env, idx) => (
                            <div key={idx} className="flex gap-3">
                                <input
                                    type="text"
                                    value={env.key}
                                    onChange={e => {
                                        const updated = [...envVars];
                                        updated[idx].key = e.target.value;
                                        setEnvVars(updated);
                                    }}
                                    placeholder="KEY"
                                    className="flex-1 px-3 py-2 border rounded-lg"
                                />
                                <input
                                    type="text"
                                    value={env.value}
                                    onChange={e => {
                                        const updated = [...envVars];
                                        updated[idx].value = e.target.value;
                                        setEnvVars(updated);
                                    }}
                                    placeholder="VALUE"
                                    className="flex-1 px-3 py-2 border rounded-lg"
                                />
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* ---- Deployment Complete Modal ---- */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', duration: 0.5 }}
                            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8"
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setShowModal(false)}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>

                            {/* Success Icon */}
                            <div className="flex justify-center mb-6">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                                    className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg"
                                >
                                    <span className="text-4xl">🎉</span>
                                </motion.div>
                            </div>

                            {/* Title */}
                            <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                Congratulation!
                            </h2>
                            <p className="text-center text-gray-600 mb-6">Your Project is deployed successfully!</p>

                            {/* URL Display */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Deployed URL:</label>
                                <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-blue-100 rounded-xl">
                                    <span className="flex-1 text-sm font-mono text-blue-600 truncate">
                                        {deployedUrl}
                                    </span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(deployedUrl);
                                        }}
                                        className="px-4 py-2 text-sm bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors font-medium"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleVisitSite}
                                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
                                >
                                    Go to Deployed Url
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleGoToProject}
                                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
                                >
                                    Go to Projects
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
