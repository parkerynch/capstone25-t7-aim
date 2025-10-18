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

interface BuildLogsProps {
    project: Project | null;
}

export default function BuildLogs({ project }: BuildLogsProps) {
    return <div></div>;
}
