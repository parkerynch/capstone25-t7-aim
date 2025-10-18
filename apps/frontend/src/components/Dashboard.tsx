interface StatCard {
    icon: string;
    title: string;
    value: string | number;
    change: string;
    changeColor: 'green' | 'red';
}

interface SystemStat {
    label: string;
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
}

interface DashboardProps {
    project: Project | null;
}

const Dashboard = ({ }: DashboardProps): JSX.Element => {
    const statCards: StatCard[] = [
        {
            icon: '📈',
            title: '활성 Agent',
            value: 12,
            change: '+3',
            changeColor: 'green',
        },
        {
            icon: '✓',
            title: '성공 배포',
            value: 156,
            change: '+12%',
            changeColor: 'green',
        },
        {
            icon: '⏱',
            title: '평균 응답시간',
            value: '124ms',
            change: '-8%',
            changeColor: 'green',
        },
        {
            icon: '⚠',
            title: '오류 발생',
            value: 3,
            change: '-2',
            changeColor: 'red',
        },
    ];

    const systemStats: SystemStat[] = [
        { label: 'Lambda 실행 시간', value: '2,340,567 ms' },
        { label: '총 API 호출', value: '27,610' },
        { label: '데이터 전송량', value: '15.8 GB' },
    ];

    return (
        <div className="rounded-md shadow-md bg-white p-8">
            <div className="w-full mx-auto">
                {/* 헤더 */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">실시간 모니터링</h1>
                    <p className="text-gray-600">배포된 AI Agent의 성능 및 상태 지표</p>
                </div>

                {/* 통계 카드 그리드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {statCards.map((card: StatCard, index: number) => (
                        <div
                            key={index}
                            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                        >
                            {/* 아이콘 */}
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4 text-2xl">
                                {card.icon}
                            </div>

                            {/* 제목 */}
                            <h3 className="text-sm font-medium text-gray-600 mb-2">{card.title}</h3>

                            {/* 값과 변화 */}
                            <div className="flex items-end justify-between">
                                <span className="text-3xl font-bold text-gray-900">{card.value}</span>
                                <span
                                    className={`text-sm font-semibold ${
                                        card.changeColor === 'green' ? 'text-green-500' : 'text-red-400'
                                    }`}
                                >
                                    {card.change}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 시스템 상태 섹션 */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">시스템 상태</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                        {systemStats.map((stat: SystemStat, index: number) => (
                            <div key={index}>
                                <p className="text-sm text-gray-600 mb-2">{stat.label}</p>
                                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
