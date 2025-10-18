import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import Settings from '../components/Settings';
import FileDetails from '../components/FileDetails';
import BuildLogs from '../components/BuildLogs';

type PageType = 'dashboard' | 'apikeys' | 'file' | 'buildlogs';

interface NavItem {
    id: PageType;
    label: string;
    icon?: string;
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
}

const NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'apikeys', label: 'Settings' },
    { id: 'file', label: 'FileDetails' },
    { id: 'buildlogs', label: 'BuildLogs' },
];

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [page, setPage] = useState<PageType>('dashboard');
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // location.state에서 프로젝트 데이터 가져오기
        if (location.state?.project) {
            setProject(location.state.project);
            setLoading(false);
        } else if (id) {
            // state가 없으면 localStorage에서 찾기
            const savedProjects = localStorage.getItem('deployedProjects');
            if (savedProjects) {
                try {
                    const projects: Project[] = JSON.parse(savedProjects);
                    const foundProject = projects.find(p => p.id === id);
                    if (foundProject) {
                        setProject(foundProject);
                    } else {
                        console.error('프로젝트를 찾을 수 없습니다.');
                        alert('프로젝트를 찾을 수 없습니다.');
                        navigate('/project');
                    }
                } catch (error) {
                    console.error('프로젝트 데이터 로드 실패:', error);
                }
            }
            setLoading(false);
        }
    }, [id, location.state, navigate]);

    const handleDelete = () => {
        if (!project) return;

        if (window.confirm(`"${project.name}" 프로젝트를 정말 삭제하시겠습니까?`)) {
            try {
                // localStorage에서 프로젝트 삭제
                const savedProjects = localStorage.getItem('deployedProjects');
                if (savedProjects) {
                    const projects: Project[] = JSON.parse(savedProjects);
                    const updatedProjects = projects.filter(p => p.id !== project.id);
                    localStorage.setItem('deployedProjects', JSON.stringify(updatedProjects));
                    
                    // 커스텀 이벤트 발생
                    window.dispatchEvent(new Event('projectsUpdated'));
                    
                    console.log('프로젝트 삭제 완료:', project.name);
                    alert('프로젝트가 삭제되었습니다.');
                    navigate('/project');
                }
            } catch (error) {
                console.error('프로젝트 삭제 실패:', error);
                alert('프로젝트 삭제 중 오류가 발생했습니다.');
            }
        }
    };

    const getStatusColor = (status?: string): string => {
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

    const PAGE_COMPONENTS: Record<PageType, React.ReactNode> = {
        dashboard: <Dashboard project={project} />,
        apikeys: <Settings project={project} />,
        file: <FileDetails project={project} />,
        buildlogs: <BuildLogs project={project} />,
    };

    if (loading) {
        return (
            <div className="pt-10 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">프로젝트 정보를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="pt-10 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <svg
                        className="w-16 h-16 text-gray-300 mx-auto mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <p className="text-gray-600 text-lg mb-4">프로젝트를 찾을 수 없습니다.</p>
                    <button
                        onClick={() => navigate('/project')}
                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                    >
                        프로젝트 목록으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-6 max-w-6xl mx-auto">
            {/* 프로젝트 헤더 */}
            <div className="bg-white p-8 mb-6 rounded-lg shadow-md">
                <div className="flex mb-4 justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl font-bold">{project.name}</h1>
                        <span className={`px-3 py-1 text-xs font-medium rounded ${getStatusColor(project.status)}`}>
                            {project.status}
                        </span>
                    </div>
                    <button
                        onClick={handleDelete}
                        className="px-4 py-2 rounded text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                    >
                        삭제
                    </button>
                </div>

                {/* 프로젝트 정보 */}
                <div className="space-y-3 text-md">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                            />
                        </svg>
                        <span className="font-semibold">배포된 URL:</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                        <span className="font-semibold">배포일:</span>
                        <span>{project.deployDate}</span>
                    </div>

                    {project.originalFileName && (
                        <div className="flex items-center gap-2 text-gray-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                            <span className="font-semibold">파일명:</span>
                            <span className="truncate">{project.originalFileName}</span>
                            {project.fileSize && (
                                <span className="text-sm text-gray-500">
                                    ({(project.fileSize / 1024 / 1024).toFixed(2)} MB)
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 네비게이션 탭 */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                {NAV_ITEMS.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setPage(item.id)}
                        className={`px-4 py-3 font-medium transition-colors rounded-t-lg ${
                            page === item.id
                                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {/* 페이지 콘텐츠 */}
            <div className="pb-32">{PAGE_COMPONENTS[page]}</div>
        </div>
    );
}