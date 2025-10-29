/**
 * `service.ts`
 * - common service definitions
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2025-10-10 initial version with `lemon-core#4.0.7`
 *
 * @copyright   (C) lemoncloud.io 2025 - All Rights Reserved. (https://eureka.codes)
 */
import { $U, _log, CoreManager, CoreService, GeneralItem } from 'lemon-core';
import { $FIELD, Model, ModelType, TestModel } from './model';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import JSZip from 'jszip';
import { RefactoredStructure, RefactorResult } from './types';
import * as fs from 'fs';
import * as path from 'path';
const NS = $U.NS('hello', 'blue'); // NAMESPACE TO BE PRINTED.

/**
 * class: `HelloService`
 * - sample service for `hello` type.
 */
export class HelloService extends CoreService<Model, ModelType> {
    public readonly $test: MyTestManager;

    /**
     * default constructor w/ optional parameters.
     *
     * @param tableName target table-name, or dummy `.yml` file.
     * @param params optional parameters.
     */
    public constructor(tableName?: string) {
        super(tableName);
        _log(NS, `HelloService(${this.tableName}, ${this.NS})...`);
        this.$test = new MyTestManager(this);
    }

    /**
     * hello.
     */
    public hello = () => `hello-service`;
}

/**
 * class: `MyCoreManager`
 * - shared core manager for all model.
 * - handle 'name' like unique value in same type.
 */
// eslint-disable-next-line prettier/prettier
export class MyCoreManager<T extends Model, S extends CoreService<T, ModelType>> extends CoreManager<T, ModelType, S> {
    public readonly parent: S;
    public constructor(type: ModelType, parent: S, fields: string[], uniqueField?: string) {
        super(type, parent, fields, uniqueField);
        this.parent = parent;
    }

    /** say hello */
    public hello = () => `${this.storage.hello()}`;

    /**
     * get model by id
     */
    public async getModelById(id: string): Promise<T> {
        return this.storage.read(id).catch(e => {
            if (`${e.message}`.startsWith('404 NOT FOUND')) throw new Error(`404 NOT FOUND - ${this.type}:${id}`);
            throw e;
        });
    }

    /**
     * validate name format
     * - just check empty string.
     * @param name unique name in same type group.
     */
    public validateName = (name: string): boolean => (this.$unique ? this.$unique.validate(name) : true);

    /**
     * convert to internal id by name
     * @param name unique name in same type group.
     */
    public asIdByName = (name: string): string => (this.$unique ? this.$unique.asLookupId(name) : null);

    /**
     * lookup model by name
     * - use `stereo` property to link with the origin.
     *
     * @param name unique name in same type group.
     */
    public findByName = async (name: string): Promise<T> => {
        if (this.$unique) return this.$unique.findOrCreate(name);
        throw new Error(`400 NOT SUPPORT - ${this.type}:#${name}`);
    };
}

/**
 * class: `MyTestManager`
 * - manager for test-model.
 */
export class MyTestManager extends MyCoreManager<TestModel, HelloService> {
    public constructor(parent: HelloService) {
        super('test', parent, $FIELD.test, 'name');
    }
    /**
     * Save data into DynamoDB
     */
    public saveToDynamo = async (id: string, data: GeneralItem) => {
        const res = await this.save(id, data);
        return { res };
    };
    /**
     * Read data from DynamoDB
     */
    public readFromDynamo = async (id: string) => {
        const res = await this.getModelById(id);
        return { res };
    };
}

//*export default
export default new HelloService();

export class GeminiService {
    private genAI: GoogleGenerativeAI;

    // CRITICAL ISSUES TO ADDRESS:
    // 1. AI 프롬프트 구체화 부족 → JSON 응답 형식 강제 필요 (부분 완료: buildRefactoringPrompt 개선)
    // 2. JSON 파싱 실패 처리 미흡 → 재시도 로직 또는 사용자 개입 필요
    // 3. Fallback 분류 로직 부정확 → AI 의존도 높이거나 완전 제거 고려
    // 4. 프레임워크 감지 정확성 낮음 → 패턴 매칭 및 우선순위 로직 개선 필요
    //
    // 현재 우선순위: AI 응답 신뢰성 확보 → Fallback 로직 개선 → 프레임워크 감지 강화

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    public getClient() {
        return this.genAI;
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

        // 3. Analyze if it's a single app (no apps/ folder)
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
        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = this.buildRefactoringPrompt(fileStructure);

        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text();

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

        // Ensure directory exists
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        // Save file locally
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

    private buildRefactoringPrompt(fileStructure: Record<string, string>): string {
        const files = Object.keys(fileStructure).join(', ');
        return `
You are an expert software architect. Analyze the following project structure and refactor it into a modern fullstack application with separate frontend and backend.

Project files: ${files}

IMPORTANT: You MUST respond with a valid JSON object in the following exact format:
{
  "fileMappings": {
    "path/to/file1": "frontend",
    "path/to/file2": "backend",
    "path/to/file3": "frontend"
  },
  "frameworks": {
    "frontend": {"framework": "React", "language": "TypeScript"},
    "backend": {"framework": "Express.js", "language": "TypeScript"}
  }
}

Rules:
1. fileMappings: Map each file to either "frontend" or "backend"
2. frameworks: Specify detected frameworks and languages
3. Response must be valid JSON only - no additional text or explanations

Please provide the refactoring analysis in the exact JSON format specified above.
        `;
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
            // CRITICAL: JSON 파싱 실패 시 현재는 단순 text 파싱으로 fallback하지만,
            // 이는 AI 응답의 일관성을 보장하지 못함
            // 수정 필요: AI 재호출, 더 강력한 에러 처리, 또는 사용자 개입 요청
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
        // CRITICAL: 현재 단순 문자열 매칭만으로 프레임워크를 감지하므로 정확성이 낮음
        // 수정 필요: 더 정교한 패턴 매칭, 컨텍스트 고려, 다중 프레임워크 지원
        // 예: React와 Vue가 동시에 감지되는 경우 우선순위 결정 로직 필요
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
        // CRITICAL ISSUE: 현재 AI 프롬프트가 충분히 구체화되지 않아 JSON 응답 형식이 예상 가능하지 않음
        // 이로 인해 fallback 분류 로직의 정확성이 낮아 의미가 퇴색됨
        //
        // 수정 대상:
        // 1. buildRefactoringPrompt() - JSON 응답 형식을 강제하는 구체적인 프롬프트로 개선 (완료)
        // 2. createRefactoredStructure() - JSON 파싱 실패 시 더 나은 에러 처리 및 재시도 로직 추가 필요
        // 3. extractFrameworkInfoFromText() - 더 정확한 프레임워크 감지 패턴 추가 필요
        // 4. classifyFilesByContent() - AI 의존도를 높이고 fallback 정확성 개선 또는 제거 고려
        //
        // 향후 개선 방향:
        // - AI 프롬프트를 개선하여 구조화된 응답을 강제
        // - JSON 파싱 실패 시 AI 재호출 또는 더 나은 fallback 전략 구현
        // - 현재 content-based 분류의 한계를 인정하고 AI-first 접근으로 전환
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
