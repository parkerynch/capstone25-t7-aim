import { useState, useEffect } from 'react';

interface EnvVar {
    key: string;
    value: string;
}

interface Project {
    id: string;
    name: string;
    status: '실행 중' | '중지됨' | '배포 중';
    deployDate: string;
    url: string;
    originalFileName?: string;
    fileSize?: number;
    s3Url?: string;
    envVars?: EnvVar[];
}

interface BuildSettings {
    buildCommand: string;
    outputDirectory: string;
    installCommand: string;
    runtime: string;
    memory: string;
    timeout: string;
}

interface SettingsProps {
    project: Project | null;
}

export default function Settings({ project }: SettingsProps): JSX.Element {
    const [envVars, setEnvVars] = useState<EnvVar[]>([]);
    const [buildSettings, setBuildSettings] = useState<BuildSettings>({
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
        installCommand: 'npm install',
        runtime: 'nodejs20.x',
        memory: '1024',
        timeout: '30',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // 프로젝트 설정 로드
    useEffect(() => {
        if (!project?.id) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        // localStorage에서 설정 불러오기
        const savedSettings = localStorage.getItem(`project-settings-${project.id}`);

        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                console.log('저장된 설정 불러오기:', parsed);

                if (parsed.envVars && Array.isArray(parsed.envVars)) {
                    setEnvVars(parsed.envVars);
                } else if (project.envVars && Array.isArray(project.envVars)) {
                    // 프로젝트에 저장된 환경변수 사용
                    setEnvVars(project.envVars);
                } else {
                    setEnvVars([]);
                }

                if (parsed.buildSettings) {
                    setBuildSettings(parsed.buildSettings);
                }
            } catch (error) {
                console.error('설정 로드 실패:', error);
                // 프로젝트에 저장된 환경변수로 폴백
                if (project.envVars && Array.isArray(project.envVars)) {
                    setEnvVars(project.envVars);
                } else {
                    setEnvVars([]);
                }
            }
        } else {
            // 저장된 설정이 없으면 프로젝트의 초기 환경변수 사용
            console.log('저장된 설정 없음, 프로젝트 환경변수 사용:', project.envVars);
            if (project.envVars && Array.isArray(project.envVars)) {
                setEnvVars(project.envVars);
            } else {
                setEnvVars([]);
            }
        }

        setIsLoading(false);
    }, [project?.id, project?.envVars]);

    const handleEnvChange = (index: number, field: keyof EnvVar, value: string): void => {
        const updated = [...envVars];
        updated[index][field] = value;
        setEnvVars(updated);
    };

    const handleDeleteEnv = (index: number): void => {
        if (window.confirm('이 환경변수를 삭제하시겠습니까?')) {
            setEnvVars(envVars.filter((_, i) => i !== index));
        }
    };

    const handleAddEnv = (): void => {
        setEnvVars([...envVars, { key: '', value: '' }]);
    };

    const handleBuildSettingChange = (field: keyof BuildSettings, value: string): void => {
        setBuildSettings(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSaveSettings = async (): Promise<void> => {
        if (!project?.id) {
            alert('프로젝트 정보가 없습니다.');
            return;
        }

        // 빈 환경변수 필터링
        const validEnvVars = envVars.filter(env => env.key.trim() !== '');

        setIsSaving(true);
        setSaveMessage('');

        try {
            // localStorage에 설정 저장
            const settings = {
                envVars: validEnvVars,
                buildSettings,
                updatedAt: new Date().toISOString(),
            };

            localStorage.setItem(`project-settings-${project.id}`, JSON.stringify(settings));

            // 프로젝트 목록에도 환경변수 업데이트
            const savedProjects = localStorage.getItem('deployedProjects');
            if (savedProjects) {
                const projects: Project[] = JSON.parse(savedProjects);
                const updatedProjects = projects.map(p => {
                    if (p.id === project.id) {
                        return { ...p, envVars: validEnvVars };
                    }
                    return p;
                });
                localStorage.setItem('deployedProjects', JSON.stringify(updatedProjects));

                // 커스텀 이벤트 발생
                window.dispatchEvent(new Event('projectsUpdated'));
            }

            console.log('설정 저장 완료:', settings);

            // 성공 메시지
            setSaveMessage('설정이 저장되었습니다. ✅');

            // 메시지 자동 삭제
            setTimeout(() => {
                setSaveMessage('');
            }, 3000);
        } catch (error) {
            console.error('설정 저장 실패:', error);
            setSaveMessage('설정 저장에 실패했습니다. ❌');

            setTimeout(() => {
                setSaveMessage('');
            }, 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const runtimeOptions = [
        { value: 'nodejs20.x', label: 'Node.js 20.x' },
        { value: 'nodejs18.x', label: 'Node.js 18.x' },
        { value: 'nodejs16.x', label: 'Node.js 16.x' },
        { value: 'python3.12', label: 'Python 3.12' },
        { value: 'python3.11', label: 'Python 3.11' },
    ];

    const memoryOptions = ['128', '256', '512', '1024', '2048', '3008'];
    const timeoutOptions = ['10', '30', '60', '120', '300', '900'];

    if (!project) {
        return (
            <div className="bg-white p-8 rounded-lg">
                <div className="text-center py-12 text-gray-500">
                    <p>프로젝트 정보를 불러올 수 없습니다.</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="bg-white p-8 rounded-lg">
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                    <span className="ml-3 text-gray-600">설정을 불러오는 중...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg">
            <div className="w-full">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold mb-2">{project.name} - 프로젝트 설정</h1>
                    <p className="text-gray-600">환경변수, 빌드 옵션, Lambda 런타임을 설정하세요.</p>
                </div>

                {/* 환경변수 섹션 */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold mb-1">
                                환경변수
                                <span className="ml-2 text-sm font-normal text-gray-500">({envVars.length}개)</span>
                            </h2>
                            <p className="text-sm text-gray-600">API_KEY, DB_URL 등 환경변수를 설정하세요</p>
                        </div>
                        <button
                            onClick={handleAddEnv}
                            className="bg-cyan-400 hover:bg-cyan-500 text-white font-medium py-2 px-4 rounded flex items-center gap-2 transition-colors"
                        >
                            <span className="text-xl">+</span>
                            추가
                        </button>
                    </div>

                    {envVars.length === 0 ? (
                        <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-gray-300">
                            <svg
                                className="w-12 h-12 text-gray-300 mx-auto mb-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                />
                            </svg>
                            <p className="text-gray-500 font-medium">환경변수가 없습니다</p>
                            <p className="text-sm text-gray-400 mt-1">추가 버튼을 눌러 환경변수를 설정하세요</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {envVars.map((env: EnvVar, index: number) => (
                                <div key={index} className="flex gap-3 items-center">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={env.key}
                                            onChange={e => handleEnvChange(index, 'key', e.target.value)}
                                            placeholder="KEY (예: API_KEY)"
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded focus:outline-none focus:border-cyan-400 bg-white"
                                        />
                                    </div>
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={env.value}
                                            onChange={e => handleEnvChange(index, 'value', e.target.value)}
                                            placeholder="VALUE (예: sk-xxxxx)"
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded focus:outline-none focus:border-cyan-400 bg-white"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleDeleteEnv(index)}
                                        className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                                        title="삭제"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 빌드 & 런타임 섹션 */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold mb-1">빌드 설정</h2>
                        <p className="text-sm text-gray-600">프로젝트 빌드 명령어와 출력 디렉토리를 설정하세요</p>
                    </div>

                    <div className="space-y-4">
                        {/* 빌드 명령어 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">빌드 명령어</label>
                            <input
                                type="text"
                                value={buildSettings.buildCommand}
                                onChange={e => handleBuildSettingChange('buildCommand', e.target.value)}
                                placeholder="npm run build"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded focus:outline-none focus:border-cyan-400 bg-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">예: npm run build, yarn build</p>
                        </div>

                        {/* 출력 디렉토리 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">출력 디렉토리</label>
                            <input
                                type="text"
                                value={buildSettings.outputDirectory}
                                onChange={e => handleBuildSettingChange('outputDirectory', e.target.value)}
                                placeholder="dist"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded focus:outline-none focus:border-cyan-400 bg-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">예: dist, build, out</p>
                        </div>

                        {/* 설치 명령어 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">설치 명령어</label>
                            <input
                                type="text"
                                value={buildSettings.installCommand}
                                onChange={e => handleBuildSettingChange('installCommand', e.target.value)}
                                placeholder="npm install"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded focus:outline-none focus:border-cyan-400 bg-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">예: npm install, yarn, pnpm install</p>
                        </div>
                    </div>
                </div>

                {/* Lambda 런타임 섹션 */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-8">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold mb-1">Lambda 런타임 설정</h2>
                        <p className="text-sm text-gray-600">AWS Lambda 함수의 런타임 환경을 설정하세요</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 런타임 버전 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">런타임</label>
                            <select
                                value={buildSettings.runtime}
                                onChange={e => handleBuildSettingChange('runtime', e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded focus:outline-none focus:border-cyan-400 bg-white"
                            >
                                {runtimeOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 메모리 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">메모리 (MB)</label>
                            <select
                                value={buildSettings.memory}
                                onChange={e => handleBuildSettingChange('memory', e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded focus:outline-none focus:border-cyan-400 bg-white"
                            >
                                {memoryOptions.map(option => (
                                    <option key={option} value={option}>
                                        {option} MB
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 타임아웃 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">타임아웃 (초)</label>
                            <select
                                value={buildSettings.timeout}
                                onChange={e => handleBuildSettingChange('timeout', e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded focus:outline-none focus:border-cyan-400 bg-white"
                            >
                                {timeoutOptions.map(option => (
                                    <option key={option} value={option}>
                                        {option}초
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* 저장 버튼 */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                        className={`px-8 py-3 rounded-lg font-semibold text-white transition-all ${
                            isSaving
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 shadow-lg hover:shadow-xl'
                        }`}
                    >
                        {isSaving ? (
                            <span className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                저장 중...
                            </span>
                        ) : (
                            '설정 저장'
                        )}
                    </button>

                    {saveMessage && (
                        <div
                            className={`px-4 py-2 rounded-lg font-medium ${
                                saveMessage.includes('✅')
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : 'bg-red-100 text-red-700 border border-red-200'
                            }`}
                        >
                            {saveMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
