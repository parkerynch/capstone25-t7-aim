import DeploymentPipeline from '../components/DeploymentPipeline';

export default function DeployPage() {
    return (
        <div className="flex flex-col items-center justify-center w-full pt-10">
            <div className="flex flex-col items-center justify-center">
                <div className="font-semibold text-3xl">Deployment Pipeline Status</div>
            </div>
            <div className="w-full">
                <DeploymentPipeline />
            </div>
        </div>
    );
}
