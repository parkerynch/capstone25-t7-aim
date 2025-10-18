import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface Project {
    id: string;
    name: string;
    status: '실행 중' | '중지됨' | '배포 중';
    deployDate: string;
    url: string;
    originalFileName?: string;
    fileSize?: number;
    s3Url?: string;
    envVars?: EnvVar[]; // 추가
}

interface EnvVar {
    key: string;
    value: string;
}

export function ProjectCard() {
    const [projects, setProjects] = useState<Project[]>([]);

    // localStorage에서 프로젝트 목록 불러오기
    useEffect(() => {
        const loadProjects = () => {
            const savedProjects = localStorage.getItem('deployedProjects');
            if (savedProjects) {
                try {
                    const parsed = JSON.parse(savedProjects) as Project[];
                    setProjects(parsed);
                } catch (error) {
                    console.error('프로젝트 데이터 로드 실패:', error);
                    setProjects([]);
                }
            }
        };

        loadProjects();

        // storage 이벤트 리스너 (다른 탭에서 변경 감지)
        window.addEventListener('storage', loadProjects);

        // 커스텀 이벤트 리스너 (같은 탭에서 변경 감지)
        window.addEventListener('projectsUpdated', loadProjects);

        return () => {
            window.removeEventListener('storage', loadProjects);
            window.removeEventListener('projectsUpdated', loadProjects);
        };
    }, []);

    const handleDelete = (e: React.MouseEvent<HTMLButtonElement>, projectId: string): void => {
        e.preventDefault();
        e.stopPropagation();

        if (window.confirm('정말 이 프로젝트를 삭제하시겠습니까?')) {
            const updatedProjects = projects.filter(project => project.id !== projectId);
            setProjects(updatedProjects);
            localStorage.setItem('deployedProjects', JSON.stringify(updatedProjects));

            // 커스텀 이벤트 발생
            window.dispatchEvent(new Event('projectsUpdated'));
        }
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case '실행 중':
                return 'bg-green-500';
            case '중지됨':
                return 'bg-gray-400';
            case '배포 중':
                return 'bg-blue-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusBadgeColor = (status: string): string => {
        switch (status) {
            case '실행 중':
                return 'bg-green-100 text-green-700';
            case '중지됨':
                return 'bg-gray-200 text-gray-700';
            case '배포 중':
                return 'bg-blue-100 text-blue-700';
            default:
                return 'bg-gray-200 text-gray-700';
        }
    };

    const formatFileSize = (bytes?: number): string => {
        if (!bytes) return 'N/A';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };

    

    return (
        <div className="rounded-2xl grid grid-cols-2 gap-6">
            {projects.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-gray-500 bg-white rounded-lg border shadow-sm">
                    <div className="flex flex-col items-center gap-4">
                        <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                            />
                        </svg>
                        <div>
                            <p className="text-lg font-semibold">배포된 프로젝트가 없습니다</p>
                            <p className="text-sm mt-2">새로운 프로젝트를 배포해보세요!</p>
                        </div>
                    </div>
                </div>
            ) : (
                projects.map(project => (
                    <Link
                        key={project.id}
                        to={`/project/${project.id}`}
                        state={{ project }}
                        className="p-6 shadow-md rounded-lg border hover:shadow-lg transition-all bg-white hover:border-cyan-200"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full mt-1.5 ${getStatusColor(project.status)}`} />
                                <div className="flex flex-row gap-4 items-center">
                                    <h4 className="mb-1 font-semibold text-2xl">{project.name}</h4>
                                    <span
                                        className={`px-2 h-fit text-xs rounded font-medium ${getStatusBadgeColor(project.status)}`}
                                    >
                                        {project.status}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={e => handleDelete(e, project.id)}
                                    className="p-2 rounded hover:bg-red-50 hover:text-red-600 text-sm transition-colors font-medium"
                                >
                                    삭제
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                </svg>
                                <span>배포일: {project.deployDate}</span>
                            </div>

                            {project.originalFileName && (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                    <span className="truncate">
                                        {project.originalFileName} ({formatFileSize(project.fileSize)})
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center gap-2 text-sm">
                                <svg
                                    className="w-4 h-4 text-blue-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                    />
                                </svg>
                                <div className="text-gray-600">배포된 URL:</div>
                            </div>
                        </div>
                    </Link>
                ))
            )}
        </div>
    );
}
