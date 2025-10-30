import { AIFactory, AIService } from './ai';
import axios from 'axios';
import JSZip from 'jszip';
import { RefactoredStructure, RefactorResult } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class RefactoringService {
    private aiService: AIService;

    constructor(aiService?: AIService) {
        this.aiService = aiService || AIFactory.createService();
    }

    public async refactorCode(s3Url: string): Promise<RefactorResult> {
        // 1. Download ZIP from S3
        const response = await axios.get(s3Url, { responseType: 'arraybuffer' });
        const zipBuffer = response.data as ArrayBuffer;

        // 2. Extract and analyze structure
        const zip = await JSZip.loadAsync(zipBuffer);
        const fileStructure: Record<string, string> = {};

        for (const [path, file] of Object.entries(zip.files)) {
            if (!file.dir) {
                const content = await file.async('text');
                fileStructure[path] = content;
            }
        }

        // 3. Check if already structured
        const hasAppsFolder = Object.keys(fileStructure).some(path => path.startsWith('apps/'));

        if (hasAppsFolder) {
            return {
                analysis: {
                    needsRefactoring: false,
                    appType: 'fullstack',
                    frameworks: ['React', 'Express'],
                    refactoringPlan: 'Already structured',
                },
                refactoredStructure: { apps: {} },
                status: 'no_refactoring_needed',
                message: 'Project already has apps/ structure',
            };
        }

        // 4. Use AI to analyze and plan refactoring
        const aiResponse = await this.aiService.refactorCode(fileStructure);

        // 5. Parse AI response and create refactored structure
        const refactoredStructure = this.createRefactoredStructure(fileStructure, aiResponse);

        // 6. Create new ZIP with refactored structure
        const newZip = new JSZip();
        for (const [path, content] of Object.entries(refactoredStructure.apps.frontend?.files || {})) {
            newZip.file(`apps/frontend/${path}`, content);
        }
        for (const [path, content] of Object.entries(refactoredStructure.apps.backend?.files || {})) {
            newZip.file(`apps/backend/${path}`, content);
        }

        const newZipBuffer = await newZip.generateAsync({ type: 'nodebuffer' });

        // 7. Save refactored ZIP to local filesystem for logging
        const timestamp = Date.now();
        const localFileName = `refactored-${timestamp}.zip`;
        const localDir = path.join(process.cwd(), 'tmp', 'refactored');
        const localFilePath = path.join(localDir, localFileName);

        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        fs.writeFileSync(localFilePath, new Uint8Array(newZipBuffer));
        console.log(`✅ Refactored ZIP saved locally: ${localFilePath}`);

        return {
            analysis: {
                needsRefactoring: true,
                appType: 'fullstack',
                frameworks: ['React', 'Express'],
                refactoringPlan: aiResponse,
            },
            refactoredStructure,
            status: 'refactoring_completed',
            message: 'AI refactoring completed successfully',
            localFilePath: localFilePath,
        };
    }

    private createRefactoredStructure(originalFiles: Record<string, string>, aiPlan: string): RefactoredStructure {
        // Parse AI response and create refactored structure based on AI recommendations
        const frontendFiles: Record<string, string> = {};
        const backendFiles: Record<string, string> = {};

        try {
            // Try to parse AI response as JSON first
            const aiResponse = JSON.parse(aiPlan);

            // If AI provided structured response with file mappings
            if (aiResponse.fileMappings) {
                for (const [filePath, targetApp] of Object.entries(aiResponse.fileMappings)) {
                    if (originalFiles[filePath]) {
                        if (targetApp === 'frontend') {
                            frontendFiles[filePath] = originalFiles[filePath];
                        } else if (targetApp === 'backend') {
                            backendFiles[filePath] = originalFiles[filePath];
                        }
                    }
                }
            } else {
                // Fallback to content-based classification
                this.classifyFilesByContent(originalFiles, frontendFiles, backendFiles);
            }

            // Generate package.json files based on AI recommendations or defaults
            this.generatePackageJsonFiles(frontendFiles, backendFiles, aiResponse);
        } catch (error) {
            console.warn('Failed to parse AI response as JSON, attempting text parsing:', error);

            // Extract framework information from AI text response
            const frameworkInfo = this.extractFrameworkInfoFromText(aiPlan);

            // Use content-based classification as fallback
            this.classifyFilesByContent(originalFiles, frontendFiles, backendFiles);

            // Generate package.json files with extracted framework info
            this.generatePackageJsonFiles(frontendFiles, backendFiles, frameworkInfo);
        }

        return {
            apps: {
                frontend: { files: frontendFiles },
                backend: { files: backendFiles },
            },
        };
    }

    private extractFrameworkInfoFromText(aiText: string): Record<string, unknown> {
        const lowerText = aiText.toLowerCase();

        // Extract framework information from AI text response
        const frameworkInfo: Record<string, unknown> = {};

        // Frontend framework detection
        if (lowerText.includes('react')) {
            frameworkInfo.frontend = { framework: 'React', language: 'TypeScript' };
        } else if (lowerText.includes('vue')) {
            frameworkInfo.frontend = { framework: 'Vue.js', language: 'TypeScript' };
        } else if (lowerText.includes('angular')) {
            frameworkInfo.frontend = { framework: 'Angular', language: 'TypeScript' };
        }

        // Backend framework detection
        if (lowerText.includes('express')) {
            frameworkInfo.backend = { framework: 'Express.js', language: 'TypeScript' };
        } else if (lowerText.includes('fastify')) {
            frameworkInfo.backend = { framework: 'Fastify', language: 'TypeScript' };
        } else if (lowerText.includes('nestjs')) {
            frameworkInfo.backend = { framework: 'NestJS', language: 'TypeScript' };
        } else if (lowerText.includes('spring boot') || lowerText.includes('springboot')) {
            frameworkInfo.backend = { framework: 'Spring Boot', language: 'Java' };
        }

        return frameworkInfo;
    }

    private classifyFilesByContent(
        originalFiles: Record<string, string>,
        frontendFiles: Record<string, string>,
        backendFiles: Record<string, string>,
    ): void {
        console.warn('Using enhanced content-based classification as fallback - improved accuracy');

        for (const [path, content] of Object.entries(originalFiles)) {
            const fileName = path.toLowerCase();

            // Skip package.json files as they will be generated separately
            if (fileName.endsWith('package.json')) {
                continue;
            }

            // Path-based classification (strong indicators)
            if (this.isFrontendPath(path)) {
                frontendFiles[path] = content;
                continue;
            } else if (this.isBackendPath(path)) {
                backendFiles[path] = content;
                continue;
            }

            // Content-based classification with scoring
            const frontendScore = this.getFrontendScore(path, content);
            const backendScore = this.getBackendScore(path, content);

            if (frontendScore > backendScore) {
                frontendFiles[path] = content;
            } else if (backendScore > frontendScore) {
                backendFiles[path] = content;
            } else {
                // If scores are equal, use file extension as tiebreaker
                if (this.isFrontendExtension(fileName)) {
                    frontendFiles[path] = content;
                } else {
                    backendFiles[path] = content;
                }
            }
        }
    }

    private isFrontendPath(filePath: string): boolean {
        const path = filePath.toLowerCase();
        const frontendPaths = [
            'src/components/',
            'src/pages/',
            'src/assets/',
            'src/hooks/',
            'public/',
            'src/app/',
            'src/views/',
            'client/',
            'frontend/',
            'ui/',
            'components/',
        ];
        return frontendPaths.some(prefix => path.includes(prefix));
    }

    private isBackendPath(filePath: string): boolean {
        const path = filePath.toLowerCase();
        const backendPaths = [
            'src/server/',
            'src/api/',
            'src/routes/',
            'src/controllers/',
            'src/models/',
            'src/services/',
            'src/middleware/',
            'server/',
            'backend/',
            'api/',
            'config/',
            'database/',
        ];
        return backendPaths.some(prefix => path.includes(prefix));
    }

    private getFrontendScore(filePath: string, content: string): number {
        let score = 0;
        const fileName = filePath.toLowerCase();

        // File extension scores
        if (this.isFrontendExtension(fileName)) {
            score += 10;
        }

        // Content pattern scores
        const frontendPatterns = [
            /import React/i,
            /from ['"]react['"]/i,
            /from ['"]vue['"]/i,
            /from ['"]angular['"]/i,
            /useState|useEffect|useContext|useReducer/i,
            /<div|<span|<button|<input|<form/i,
            /component|Component/i,
            /\.module\.css|\.scss|\.less/i,
            /styled-components/i,
            /render\(|jsx/i,
            /props|state/i,
            /onClick|onChange|onSubmit/i,
            /className|style=/i,
        ];

        frontendPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                score += 2;
            }
        });

        return score;
    }

    private getBackendScore(filePath: string, content: string): number {
        let score = 0;
        const fileName = filePath.toLowerCase();

        // File extension scores
        const backendExtensions = ['.py', '.java', '.php', '.rb', '.go', '.cs'];
        if (backendExtensions.some(ext => fileName.endsWith(ext))) {
            score += 10;
        }

        // Content pattern scores
        const backendPatterns = [
            /express|fastify|koa|nestjs/i,
            /app\.listen|server\.listen/i,
            /router|route|middleware/i,
            /database|db|mongoose|sequelize|prisma/i,
            /api|endpoint|controller/i,
            /model|schema|entity/i,
            /service|repository/i,
            /config|configuration/i,
            /auth|authentication|authorization/i,
            /cors|helmet|security/i,
            /process\.env/i,
            /require\(|import.*from.*express/i,
            /export.*class|export.*function/i,
        ];

        backendPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                score += 2;
            }
        });

        return score;
    }

    private isFrontendExtension(fileName: string): boolean {
        const frontendExtensions = ['.tsx', '.jsx', '.vue', '.svelte', '.html', '.css', '.scss', '.less'];
        return frontendExtensions.some(ext => fileName.endsWith(ext));
    }

    private generatePackageJsonFiles(
        frontendFiles: Record<string, string>,
        backendFiles: Record<string, string>,
        _aiResponse?: Record<string, unknown>,
    ): void {
        // Generate frontend package.json
        const hasReact = Object.values(frontendFiles).some(
            content => content.includes('React') || content.includes('import React'),
        );
        const hasVue = Object.values(frontendFiles).some(
            content => content.includes('Vue') || content.includes('import Vue'),
        );

        if (hasReact) {
            frontendFiles['package.json'] = JSON.stringify(
                {
                    name: 'frontend',
                    version: '1.0.0',
                    scripts: {
                        start: 'react-scripts start',
                        build: 'react-scripts build',
                        test: 'react-scripts test',
                    },
                    dependencies: {
                        react: '^18.0.0',
                        'react-dom': '^18.0.0',
                        'react-scripts': '5.0.1',
                    },
                    devDependencies: {
                        '@types/react': '^18.0.0',
                        '@types/react-dom': '^18.0.0',
                        typescript: '^4.9.0',
                    },
                },
                null,
                2,
            );
        } else if (hasVue) {
            frontendFiles['package.json'] = JSON.stringify(
                {
                    name: 'frontend',
                    version: '1.0.0',
                    scripts: {
                        serve: 'vue-cli-service serve',
                        build: 'vue-cli-service build',
                    },
                    dependencies: {
                        vue: '^3.0.0',
                        '@vue/cli-service': '~5.0.0',
                    },
                },
                null,
                2,
            );
        } else {
            // Generic frontend setup
            frontendFiles['package.json'] = JSON.stringify(
                {
                    name: 'frontend',
                    version: '1.0.0',
                    scripts: {
                        start: 'npm run serve',
                        serve: 'live-server --port=3000',
                        build: 'echo "No build step configured"',
                    },
                    dependencies: {
                        'live-server': '^1.2.0',
                    },
                },
                null,
                2,
            );
        }

        // Generate backend package.json
        const hasExpress = Object.values(backendFiles).some(
            content => content.includes('express') || content.includes('app.listen'),
        );
        const hasFastify = Object.values(backendFiles).some(content => content.includes('fastify'));

        if (hasExpress) {
            backendFiles['package.json'] = JSON.stringify(
                {
                    name: 'backend',
                    version: '1.0.0',
                    scripts: {
                        start: 'node src/server.js',
                        dev: 'nodemon src/server.js',
                    },
                    dependencies: {
                        express: '^4.18.0',
                        cors: '^2.8.5',
                        helmet: '^6.0.0',
                    },
                    devDependencies: {
                        nodemon: '^2.0.0',
                    },
                },
                null,
                2,
            );
        } else if (hasFastify) {
            backendFiles['package.json'] = JSON.stringify(
                {
                    name: 'backend',
                    version: '1.0.0',
                    scripts: {
                        start: 'node src/server.js',
                        dev: 'nodemon src/server.js',
                    },
                    dependencies: {
                        fastify: '^4.0.0',
                    },
                    devDependencies: {
                        nodemon: '^2.0.0',
                    },
                },
                null,
                2,
            );
        } else {
            // Generic backend setup
            backendFiles['package.json'] = JSON.stringify(
                {
                    name: 'backend',
                    version: '1.0.0',
                    scripts: {
                        start: 'node src/server.js',
                    },
                    dependencies: {
                        express: '^4.18.0',
                    },
                },
                null,
                2,
            );
        }
    }
}
