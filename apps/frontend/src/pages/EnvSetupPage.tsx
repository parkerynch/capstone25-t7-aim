import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface EnvVar {
    key: string;
    value: string;
}

interface LocationState {
    projectName: string;
    s3Url: string;
    s3Key: string;
    fileName: string;
    fileSize: number;
    originalName?: string;
    envVars?: EnvVar[];
    envContent?: string;
    envFilePaths?: string[];
}

export default function EnvSetupPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as LocationState;

    const [envVars, setEnvVars] = useState<EnvVar[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // state가 없으면 세션 스토리지에서 복구
        let currentState = state;
        if (!currentState) {
            const savedData = sessionStorage.getItem('deploymentData');
            if (savedData) {
                currentState = JSON.parse(savedData);
            }
        }

        if (!currentState?.projectName) {
            alert('잘못된 접근입니다.');
            navigate('/');
            return;
        }

        // envVars가 이미 파싱되어 있으면 사용
        if (currentState.envVars && currentState.envVars.length > 0) {
            setEnvVars(currentState.envVars);
        }
        // 없으면 envContent 파싱
        else if (currentState.envContent) {
            const parsed = parseEnvContent(currentState.envContent);
            setEnvVars(parsed);
        }
        // 둘 다 없으면 기본값
        else {
            setEnvVars([
                { key: 'NODE_ENV', value: 'production' },
                { key: 'PORT', value: '3000' },
            ]);
        }
    }, []);

    const parseEnvContent = (content: string): EnvVar[] => {
        const lines = content.split('\n');
        const vars: EnvVar[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
            if (match) {
                const key = match[1];
                let value = match[2].trim();
                value = value.replace(/^["']|["']$/g, '');
                vars.push({ key, value });
            }
        }

        return vars;
    };

    const handleKeyChange = (index: number, newKey: string) => {
        const updated = [...envVars];
        updated[index].key = newKey;
        setEnvVars(updated);
    };

    const handleValueChange = (index: number, newValue: string) => {
        const updated = [...envVars];
        updated[index].value = newValue;
        setEnvVars(updated);
    };

    const handleDelete = (index: number) => {
        setEnvVars(envVars.filter((_, i) => i !== index));
    };

    const handleAddEnv = () => {
        setEnvVars([...envVars, { key: 'NEW_KEY', value: '' }]);
    };

    const handleNext = () => {
        // 검증: 빈 키가 있는지 확인
        const emptyKeys = envVars.filter(env => !env.key.trim());
        if (emptyKeys.length > 0) {
            alert('빈 키가 있습니다. 모든 환경변수에 키를 입력해주세요.');
            return;
        }

        // 중복 키 확인
        const keys = envVars.map(env => env.key);
        const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
        if (duplicates.length > 0) {
            alert(`중복된 키가 있습니다: ${duplicates.join(', ')}`);
            return;
        }

        setIsLoading(true);

        // 배포 페이지로 이동
        const deployData = {
            ...state,
            envVars,
        };

        sessionStorage.setItem('deploymentData', JSON.stringify(deployData));
        window.scrollTo(0, 0);
        navigate('/deploy', { state: deployData });
    };

    const handleBack = () => {
        navigate(-1);
    };

    if (!state?.projectName && !sessionStorage.getItem('deploymentData')) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">잘못된 접근입니다</h2>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg"
                    >
                        홈으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br py-6 px-4">
            <div className="max-w-4xl mx-auto">
                {/* 헤더 */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                />
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                                Environment Variable Setting
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Project Name : <span className="font-semibold">{state?.projectName}</span>
                            </p>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                        <svg
                            className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <div className="text-sm text-blue-800">
                            {state?.envFilePaths && state.envFilePaths.length > 0 ? (
                                <>
                                    <strong>{state.envFilePaths.length}개</strong>의 환경변수 파일에서{' '}
                                    <strong>{envVars.length}개</strong>의 변수를 찾았습니다.
                                    <div className="mt-1 text-xs text-blue-600">
                                        {state.envFilePaths.map((path, i) => (
                                            <div key={i}>• {path}</div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>환경변수를 확인하고 필요한 값을 입력해주세요.</>
                            )}
                        </div>
                    </div>
                </div>

                {/* 환경변수 입력 */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-800">Env List ({envVars.length})</h2>
                        <button
                            onClick={handleAddEnv}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all hover:scale-105"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Variable
                        </button>
                    </div>

                    {envVars.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <svg
                                className="w-16 h-16 mx-auto mb-4 text-gray-300"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                                />
                            </svg>
                            <p>환경변수가 없습니다.</p>
                            <p className="text-sm mt-2">위의 "변수 추가" 버튼을 눌러 추가해주세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {envVars.map((env, index) => (
                                <div
                                    key={index}
                                    className="flex items-center rounded-lg hover:bg-gray-100 transition-colors group"
                                >
                                    <div className="flex-1 grid grid-cols-5 gap-3">
                                        <input
                                            type="text"
                                            value={env.key}
                                            onChange={e => handleKeyChange(index, e.target.value)}
                                            placeholder="KEY"
                                            className="px-4 py-2 col-span-2 border-2 bg-gray-100 border-gray-300 rounded-lg focus:outline-none focus:border-cyan-500 font-mono text-md"
                                        />
                                        <input
                                            type="text"
                                            value={env.value}
                                            onChange={e => handleValueChange(index, e.target.value)}
                                            placeholder="VALUE"
                                            className="px-4 py-2 col-span-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-cyan-500 font-mono text-md"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleDelete(index)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all  group-hover:opacity-100"
                                        title="삭제"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                {/* 버튼 */}
                <div className="flex justify-between mt-8">
                    <button
                        onClick={handleBack}
                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2"
                        disabled={isLoading}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Before
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={isLoading || envVars.length === 0}
                        className={`px-8 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                            isLoading || envVars.length === 0
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:scale-105'
                        }`}
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    ></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                Proceeding ...
                            </>
                        ) : (
                            <>
                                Next Step
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
