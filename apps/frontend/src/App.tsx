import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import UploadPage from './pages/UploadPage';
import ProjectPage from './pages/ProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import DeployPage from './pages/DeployPage';
import { Footer } from './components/Footer';
import EnvSetupPage from './pages/EnvSetupPage';

function App() {
    return (
        <Router>
            <TopBar />
            <div className="flex-1 container mx-auto min-h-screen max-w-7xl">
                <Routes>
                    <Route path="/" element={<UploadPage />} />
                    <Route path="/project" element={<ProjectPage />} />
                    <Route path="/project/:id" element={<ProjectDetailPage />} />
                    <Route path="/deploy" element={<DeployPage />} />
                    <Route path="/:id" element={<EnvSetupPage />} />
                </Routes>
            </div>
            <Footer />
        </Router>
    );
}

export default App;
