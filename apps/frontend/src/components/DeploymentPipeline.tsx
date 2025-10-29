import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchDeployment } from '../services/deployment/deploymentApi';
import { Deployment } from '../types';

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

interface DeploymentPipelineProps {
    projectId: string;
    initialDeployment?: Deployment | null;
    initialLogs?: { message: string }[];
}

export default function DeploymentPipeline({
    projectId: _projectId,
    initialDeployment,
    initialLogs,
}: DeploymentPipelineProps): JSX.Element {
    const { deploymentId } = useParams();

    // 초기 상태는 모두 'pending'으로 설정
    const [steps, setSteps] = useState<PipelineStep[]>([
        {
            id: 1,
            title: 'File Upload',
            description: 'Processing uploaded file...',
            status: 'pending',
        },
        { id: 2, title: 'Analyzing Code', description: 'Analyzing code structure and dependencies', status: 'pending' },
        { id: 3, title: 'Splitting Frontend & Backend', description: 'Separating app layers...', status: 'pending' },
        {
            id: 4,
            title: 'Deploying Backend',
            description: 'Setting up backend infra...',
            status: 'pending',
        },
        {
            id: 5,
            title: 'Deploying Frontend',
            description: 'Publishing static files...',
            status: 'pending',
        },
        {
            id: 6,
            title: 'Finalizing Deployment',
            description: 'Finishing build & testing routes...',
            status: 'pending',
        },
    ]);

    const [envVars] = useState<EnvVar[]>([
        { key: 'API_KEY', value: 'sk-1234567890abcdef' },
        { key: 'DB_URL', value: 'postgresql://localhost:5432/mydb' },
        { key: 'NODE_ENV', value: 'production' },
    ]);

    const [logs, setLogs] = useState<string[]>(initialLogs ? initialLogs.map(log => log.message) : []);

    useEffect(() => {
        let deployment = initialDeployment;
        let logsData: { message: string }[] = initialLogs || [];

        const fetchDeploymentData = async () => {
            if (!deployment && deploymentId) {
                try {
                    const { deployment: fetchedDeployment, logs: fetchedLogs } = await fetchDeployment(deploymentId);
                    deployment = fetchedDeployment;
                    logsData = fetchedLogs;
                } catch (error) {
                    console.error('Error fetching deployment data:', error);
                    return;
                }
            }

            if (deployment) {
                // Set projectId from deployment data
                const projectIdValue = deployment.projectId;
                localStorage.setItem('currentProjectId', projectIdValue);

                console.log('Frontend - Deployment data:', deployment);
                console.log('Frontend - Current step:', deployment.currentStep);

                // 배포 상태에 따른 단계 업데이트 (백엔드에서 6가지 상태 체크)
                const overallStatus = deployment.status; // 'PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED'
                const currentStepString = deployment.currentStep;

                // 백엔드의 string currentStep을 숫자로 변환
                const stepMapping: Record<string, number> = {
                    UPLOADING: 1,
                    ANALYZING: 2,
                    SPLITTING: 3,
                    DEPLOYING_BACKEND: 4,
                    DEPLOYING_FRONTEND: 5,
                    FINALIZING: 6,
                };
                const currentStep = currentStepString ? stepMapping[currentStepString] || 0 : 0;

                // 단계별 상태 업데이트
                const newSteps: PipelineStep[] = steps.map((step, index) => {
                    const stepNumber = index + 1; // 1부터 시작하는 단계 번호

                    if (overallStatus === 'SUCCESS') {
                        return { ...step, status: 'completed' };
                    }

                    if (overallStatus === 'FAILED') {
                        // 실패한 단계까지는 completed, 실패한 단계는 failed
                        if (stepNumber < currentStep) {
                            return { ...step, status: 'completed' };
                        } else if (stepNumber === currentStep) {
                            return { ...step, status: 'failed' };
                        }
                        return { ...step, status: 'pending' };
                    }

                    if (overallStatus === 'IN_PROGRESS') {
                        if (stepNumber < currentStep) {
                            return { ...step, status: 'completed' };
                        } else if (stepNumber === currentStep) {
                            return { ...step, status: 'in-progress' };
                        }
                        return { ...step, status: 'pending' };
                    }

                    // PENDING 상태일 때는 File Upload만 completed로 설정
                    if (overallStatus === 'PENDING' && stepNumber === 1) {
                        return { ...step, status: 'completed' };
                    }

                    return { ...step, status: 'pending' };
                });

                setSteps(newSteps);

                // 로그 업데이트
                if (logsData) {
                    setLogs(logsData.map((log: { message: string }) => log.message));
                }

                // 배포 완료/실패 시 추가 처리 (필요시 구현)
            }
        };

        // 페이지 로드 시 한 번만 데이터 가져오기 (새로고침으로 상태 확인)
        fetchDeploymentData();

        // 폴링 제거 - 새로고침으로 상태 확인
    }, [deploymentId, initialDeployment, initialLogs]); // 폴링 제거로 isDeploymentComplete 의존성 제거

    const progressPercent = (steps.filter(s => s.status === 'completed').length / steps.length) * 100;

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
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">🚀 Deployment Pipeline</h2>
                            <p className="text-gray-500">Monitor your build and deployment progress in real-time.</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden mb-8">
                        <motion.div
                            className={`h-3 ${
                                steps.some(s => s.status === 'failed')
                                    ? 'bg-gradient-to-r from-red-400 to-red-500'
                                    : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                            }`}
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
                                          : step.status === 'failed'
                                            ? 'bg-red-50 border border-red-100'
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
                                              : step.status === 'failed'
                                                ? 'bg-red-500 text-white'
                                                : 'bg-gray-300 text-gray-600'
                                    }`}
                                >
                                    {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✕' : idx + 1}
                                </div>
                                <div>
                                    <h3
                                        className={`font-semibold ${
                                            step.status === 'failed' ? 'text-red-700' : 'text-gray-800'
                                        }`}
                                    >
                                        {step.title}
                                    </h3>
                                    <p className="text-sm text-gray-500">{step.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Bottom Buttons */}
                    <div className="mt-8">
                        {/* API 폴링 방식이므로 'Pause' 버튼은 실제 동작과 맞지 않아 주석 처리합니다.
                          <button
                              onClick={() => setIsAutoProgress(!isAutoProgress)}
                              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg transition-colors"
                          >
                              {isAutoProgress ? '⏸ Pause Auto Progress' : '▶ Resume Auto Progress'}
                          </button>
                        */}
                    </div>
                </motion.div>

                {/* ---- Right: Env Variables (내용은 원본과 동일하게 비워둠) ---- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="backdrop-blur-lg bg-white/80 border border-gray-200 rounded-2xl shadow-lg p-8"
                >
                    {/* 환경 변수 UI가 위치할 곳 */}
                    <h2 className="text-2xl font-bold mb-6">Environment Variables</h2>
                    <div className="space-y-3">
                        {envVars.map(env => (
                            <div
                                key={env.key}
                                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
                            >
                                <span className="font-semibold text-gray-700">{env.key}:</span>
                                <span className="font-mono text-gray-500 blur-sm hover:blur-none transition-all cursor-pointer">
                                    {env.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* ---- Bottom: Logs ---- */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2 backdrop-blur-lg bg-white/80 border border-gray-200 rounded-2xl shadow-lg p-8"
                >
                    <h2 className="text-2xl font-bold mb-6">Logs</h2>
                    <div className="bg-gray-900 text-white font-mono text-sm rounded-lg p-4 h-64 overflow-y-auto">
                        {logs.length > 0 ? (
                            logs.map((log, index) => (
                                <div key={index} className="flex">
                                    <span className="text-gray-500 mr-2">&gt;</span>
                                    <span>{log}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-gray-400">Waiting for deployment logs...</div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
