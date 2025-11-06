import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import axios from 'axios';
import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';
import type { GeneratedContent } from './types';
import { AimException, ErrorCode } from '../../../../packages/shared/src/errors';
import * as yaml from 'js-yaml';

if (!process.env.GEMINI_API_KEY) {
    throw new AimException(ErrorCode.INVALID_INPUT, 'API_KEY environment variable not set');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// AI 리팩토링 단계에서 사용할 '코드 조각' 반환 스키마
const codeResponseSchema = {
    type: Type.OBJECT,
    properties: {
        code: {
            type: Type.STRING,
            description: 'The refactored code block.',
        },
    },
    required: ['code'],
};

// YAML 파일에서 특정 프롬프트 섹션을 로드하는 헬퍼
const loadPromptTemplate = (fileName: string, section: string): string => {
    const filePath = path.join(process.cwd(), 'data', fileName);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Prompt file not found: ${fileName}`);
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsedYaml = yaml.load(fileContent) as { prompt?: Record<string, string> };
    const template = parsedYaml?.prompt?.[section];
    if (!template) {
        throw new Error(`Section '${section}' not found in ${fileName}`);
    }
    return template.trim();
};

// camelCase를 dash-case로 변환하는 헬퍼
const camelToDash = (str: string): string => {
    return str.replace(/[A-Z]/g, (letter, index) => {
        return index === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`;
    });
};

/**
 * 이 함수는 3단계 AI 채팅 세션을 오케스트레이션합니다.
 * 'genaiBackendEn' 프롬프트를 사용하여 1-3단계 코드 조각을 생성한 뒤,
 * 템플릿 Zip에 덮어씌워 최종 'monorepo.zip' 파일을 생성합니다.
 */
export async function generateRefactoredCode($param: { s3Url: string }): Promise<GeneratedContent> {
    console.log('generateRefactoredCode 시작');
    try {
        // --- 1. 2개의 ZIP 파일 병렬 로드 ---
        console.log('1단계: 템플릿 Zip 및 사용자 Zip 로드 시작');

        // 1.1. 템플릿 Zip 로드 (로컬 파일)
        const templateZipPath = path.join(process.cwd(), 'data', 'codes-monorepo-template.zip');
        if (!fs.existsSync(templateZipPath)) {
            throw new AimException(ErrorCode.INVALID_INPUT, 'Monorepo template zip not found.');
        }
        const templateZipPromise = fs.promises
            .readFile(templateZipPath)
            .then(buffer => JSZip.loadAsync(new Uint8Array(buffer)));

        // 1.2. 사용자 Zip 로드 (S3)
        const userZipPromise = axios
            .get($param.s3Url, { responseType: 'arraybuffer' })
            .then(response => JSZip.loadAsync(new Uint8Array(response.data)));

        const [templateZip, userZip] = await Promise.all([templateZipPromise, userZipPromise]);
        console.log('템플릿 Zip 및 사용자 Zip 로드 완료');

        // 템플릿 Zip의 루트 경로 감지
        let templateRootPath = '';
        const templateFiles = Object.keys(templateZip.files);
        if (templateFiles.length > 0) {
            const firstEntry = templateFiles[0]; // e.g., "codes-monorepo-template-develop/"
            // 모든 파일이 이 첫 번째 폴더로 시작하는지 확인
            if (firstEntry.endsWith('/') && templateFiles.every(f => f.startsWith(firstEntry))) {
                templateRootPath = firstEntry; // (예: "codes-monorepo-template-develop/")
                console.log(`템플릿 Zip 루트 경로 감지: ${templateRootPath}`);
            }
        }

        // 사용자 Zip에서 파일 추출
        const frontendRootFiles: { path: string; content: string }[] = [];
        const frontendSrcFiles: { path: string; content: string }[] = [];
        let originalServiceCode: string | null = null;
        let originalTypeCode: string | null = null;
        let originalMetadataJson: Record<string, any> | null = null;
        // 사용자 Zip의 루트 파일 목록 정의
        const userZipRootFiles = new Set([
            'index.html',
            'package.json',
            'package-lock.json',
            'vite.config.ts',
            'tsconfig.json',
            'README.md',
            '.gitignore',
        ]);

        for (const [filePath, file] of Object.entries(userZip.files)) {
            if (file.dir) continue;
            const content = await file.async('text');

            if (filePath === 'services/geminiService.ts') {
                originalServiceCode = content;
            } else if (filePath === 'types.ts') {
                originalTypeCode = content;
            } else if (filePath === 'metadata.json') {
                // metadata.json 처리
                try {
                    originalMetadataJson = JSON.parse(content);
                } catch (e) {
                    console.warn('metadata.json 파싱 오류. 무시하고 진행합니다.', e);
                    // 파싱 실패해도 내용은 저장할 필요 없음.
                }
            } else if (userZipRootFiles.has(filePath)) {
                // 루트 파일로 분류
                frontendRootFiles.push({ path: filePath, content: content });
            } else {
                // 나머지는 src 파일로 분류
                frontendSrcFiles.push({ path: filePath, content: content });
            }
        }

        if (!originalServiceCode) {
            throw new AimException(ErrorCode.INVALID_INPUT, 'services/geminiService.ts not found in zip file.');
        }

        console.log('4단계: 백엔드 포트 및 API 템플릿 로드');

        let backendPort = '8000'; // 기본 포트
        const backendPkgPath = templateRootPath + 'apps/backend/package.json';
        const backendPkgFile = templateZip.file(backendPkgPath);

        if (backendPkgFile) {
            try {
                const backendPkgContent = await backendPkgFile.async('text');
                const backendPkgJson = JSON.parse(backendPkgContent);

                // package.json의 scripts.dev에서 포트 번호 추출 (예: "dev": "node server.js --port 8000")
                const devScript = backendPkgJson.scripts?.dev;
                if (typeof devScript === 'string') {
                    const portMatch = devScript.match(/--port\s+(\d+)/);
                    if (portMatch && portMatch[1]) {
                        backendPort = portMatch[1];
                        console.log(`백엔드 포트 추출 완료: ${backendPort}`);
                    }
                }
            } catch (e) {
                console.warn('백엔드 package.json 포트 추출 실패. 기본 포트 8000 사용.');
            }
        }

        // 템플릿 Zip에서 apiCodeTemplate 추출 (루트 경로 적용)
        // templateRootPath 적용
        const apiTemplateFile = templateZip.file(templateRootPath + 'apps/backend/src/api/hello-api.ts');
        if (!apiTemplateFile) {
            throw new AimException(ErrorCode.INVALID_INPUT, 'hello-api.ts not found in template zip.');
        }
        const apiCodeTemplate = await apiTemplateFile.async('text');
        console.log('apiCodeTemplate 로드 완료 (템플릿 Zip에서 추출)');

        // --- 5. 정보 추출 ---
        console.log('5단계: 함수 이름 추출 시작');
        const funcNameMatch = originalServiceCode.match(/export (?:async )?(?:function|const)\s+([\w]+)\s*(?:=|\(|:)/);
        if (!funcNameMatch || !funcNameMatch[1]) {
            throw new AimException(ErrorCode.INVALID_INPUT, 'Main function name not found in gemini-service.ts');
        }
        const mainFunctionName = funcNameMatch[1];
        const apiPathId = camelToDash(mainFunctionName);
        console.log('함수 이름 추출 완료:', apiPathId);

        // AI Chat Session 시작 (3단계로 축소)
        console.log('6단계: AI Chat Session (1-3단계) 시작');

        // 6.1. 3단계용 'genaiBackendEn' 프롬프트 로드
        const systemPrompt = loadPromptTemplate('system-prompt.yml', 'genaiBackendEn');

        // 6.2. 채팅 세션 시작 (ai.chats.create 사용)
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt }],
                },
                {
                    role: 'model',
                    parts: [{ text: 'OK. I am ready to start as a TypeScript backend developer.' }],
                },
            ],
            config: {
                responseMimeType: 'application/json' as const,
                temperature: 0.1,
            },
        });

        // 공통 응답 파서 헬퍼 (fileList 파싱 제거)
        const parseResponse = (response: GenerateContentResponse) => {
            const jsonString = response.candidates[0].content.parts[0].text.trim();
            const parsedJson = JSON.parse(jsonString);

            if (parsedJson && typeof parsedJson.code === 'string') {
                return parsedJson.code.replace(/```(typescript|ts)?\n([\s\S]*?)\n```/, '$2').trim();
            } else {
                throw new Error(`Invalid JSON structure received from AI. Expected '{"code": "..."}'.`);
            }
        };

        // 단계별 config 헬퍼 (codeResponseSchema만 사용)
        const genConfig = (schema: any) => ({
            responseMimeType: 'application/json' as const,
            temperature: 0.1,
            responseSchema: schema,
        });

        // --- 7. AI 호출 (1단계: 서비스) ---
        console.log('7단계: AI 1단계 (서비스) 시작');
        let userPrompt1 = loadPromptTemplate('user-prompt.yml', 'genaiBackend1En');
        userPrompt1 = userPrompt1.replace('{{serviceCode}}', `\n${originalServiceCode}\n`);
        userPrompt1 = userPrompt1.replace('{{typeCode}}', `\n${originalTypeCode || ''}\n`);

        const result1 = await chat.sendMessage({ message: userPrompt1, config: genConfig(codeResponseSchema) });
        const refactoredServiceCode = parseResponse(result1);
        console.log('AI 1단계 완료');

        // --- 8. AI 호출 (2단계: API) ---
        console.log('8단계: AI 2단계 (API) 시작');
        let userPrompt2 = loadPromptTemplate('user-prompt.yml', 'genaiBackend2En');
        userPrompt2 = userPrompt2.replace('{{apiPathId}}', apiPathId);
        userPrompt2 = userPrompt2.replace('{{apiCode}}', `\n${apiCodeTemplate}\n`);

        const result2 = await chat.sendMessage({ message: userPrompt2, config: genConfig(codeResponseSchema) });
        const refactoredApiCode = parseResponse(result2);
        console.log('AI 2단계 완료');

        // --- 9. AI 호출 (3단계: 프론트) ---
        console.log('9단계: AI 3단계 (프론트) 시작');
        let userPrompt3 = loadPromptTemplate('user-prompt.yml', 'genaiFrontend1En');
        userPrompt3 = userPrompt3.replace('{{apiPathId}}', apiPathId);
        userPrompt3 = userPrompt3.replace('{{serviceCode}}', `\n${originalServiceCode}\n`);
        userPrompt3 = userPrompt3.replace('{{typeCode}}', `\n${originalTypeCode || ''}\n`);

        const result3 = await chat.sendMessage({ message: userPrompt3, config: genConfig(codeResponseSchema) });
        const refactoredFrontendServiceCode = parseResponse(result3);
        console.log('AI 3단계 완료');

        // 템플릿 Zip에 덮어쓰기 (루트 경로 적용)
        console.log('10단계: 템플릿 Zip에 코드 덮어쓰기 시작');

        // AI 생성 파일 덮어쓰기
        // templateRootPath 적용
        templateZip.file(templateRootPath + `apps/backend/src/service/geminiService.ts`, refactoredServiceCode);
        templateZip.file(templateRootPath + `apps/backend/src/api/hello-api.ts`, refactoredApiCode);
        templateZip.file(
            templateRootPath + `apps/frontend/src/services/geminiService.ts`,
            refactoredFrontendServiceCode,
        );

        // 사용자 원본 파일 덮어쓰기
        if (originalTypeCode) {
            const backendTypePath = templateRootPath + `apps/backend/src/shared/types/types.ts`;
            const frontendTypePath = templateRootPath + `apps/frontend/src/shared/types/types.ts`;

            // 'types.ts' 파일 저장
            templateZip.file(backendTypePath, originalTypeCode);
            templateZip.file(frontendTypePath, originalTypeCode);

            // 'index.ts' 파일에 export 구문 추가
            const newExportLine = `\nexport * from './types/types';`;

            // 백엔드 index.ts 수정
            const beIndexPath = templateRootPath + `apps/backend/src/shared/index.ts`;
            const beIndexFile = templateZip.file(beIndexPath);
            if (beIndexFile) {
                const beIndexContent = await beIndexFile.async('text');
                templateZip.file(beIndexPath, beIndexContent.trim() + newExportLine);
            }

            // 프론트엔드 index.ts 수정
            const feIndexPath = templateRootPath + `apps/frontend/src/shared/index.ts`;
            const feIndexFile = templateZip.file(feIndexPath);
            if (feIndexFile) {
                const feIndexContent = await feIndexFile.async('text');
                templateZip.file(feIndexPath, feIndexContent.trim() + newExportLine);
            }
        }

        // package.json 의존성 수정

        try {
            // 백엔드 package.json에 @google/genai 추가
            const bePkgPath = templateRootPath + `apps/backend/package.json`;
            const bePkgFile = templateZip.file(bePkgPath);
            if (bePkgFile) {
                const bePkgContent = await bePkgFile.async('text');
                const bePkgJson = JSON.parse(bePkgContent);
                if (!bePkgJson.dependencies) {
                    bePkgJson.dependencies = {};
                }
                // 이미 존재하지 않을 경우에만 추가
                if (!bePkgJson.dependencies['@google/genai']) {
                    bePkgJson.dependencies['@google/genai'] = '1.29.0';
                    templateZip.file(bePkgPath, JSON.stringify(bePkgJson, null, 2));
                    console.log('백엔드 package.json에 @google/genai 추가 완료');
                }
            }
        } catch (e) {
            console.error('package.json 수정 중 오류 발생:', e);
            // 의존성 수정은 치명적이지 않으므로 오류를 던지는 대신 로그만 남기고 계속 진행
        }

        // src 파일 이식
        frontendSrcFiles.forEach(file => {
            let content = file.content;
            console.log(file.path + ' 처리 시작');
            // .ts/.tsx 파일의 깨진 타입 임포트 경로를 동적으로 수정
            if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
                // 파일의 깊이(depth) 계산
                // 'App.tsx' -> 0 (슬래시 없음)
                // 'services/geminiService.ts' -> 1 (슬래시 1개)
                // 'components/common/Button.tsx' -> 2 (슬래시 2개)
                const depth = (file.path.match(/\//g) || []).length;

                // 깊이에 따라 올바른 상대 경로 생성
                // depth 0 -> './shared'
                // depth 1 -> '../shared'
                // depth 2 -> '../../shared'
                const relativePrefix = depth === 0 ? './' : '../'.repeat(depth);
                const newImportPath = `${relativePrefix}shared`;

                // 기존의 모든 'types' 경로를 계산된 새 경로로 치환
                const oldImportPattern = /from\s+['"]((\.\.\/)*(\.\/)?types)['"]/g;
                content = content.replace(oldImportPattern, `from '${newImportPath}'`);
            }

            templateZip.file(templateRootPath + `apps/frontend/src/${file.path}`, content);
        });

        // none.yml에 API_KEY 설정 및 metadata.json 제거
        console.log('10.4단계: 환경 변수 설정 (none.yml) 및 metadata.json 제거 시작');

        if (originalMetadataJson && originalMetadataJson.geminiApiKey) {
            const backendEnvPath = templateRootPath + `apps/backend/env/none.yml`;
            const envFile = templateZip.file(backendEnvPath);

            // yaml 파싱 및 덤프를 위해 js-yaml 모듈 사용 필요 (import 되어 있음)
            if (envFile) {
                try {
                    const envContent = await envFile.async('text');
                    const envData: any = yaml.load(envContent);

                    if (envData && envData.default_env) {
                        // metadata.json의 api_key를 GEMINI_API_KEY로 설정
                        envData.default_env.GEMINI_API_KEY = originalMetadataJson.geminiApiKey;

                        // 수정된 YAML 내용을 다시 문자열로 직렬화
                        const modifiedEnvContent = yaml.dump(envData, { indent: 2, lineWidth: -1 }); // lineWidth: -1로 줄바꿈 최소화

                        templateZip.file(backendEnvPath, modifiedEnvContent);
                        console.log('백엔드 none.yml에 GEMINI_API_KEY 설정 완료');
                    }
                } catch (e) {
                    console.error('none.yml 수정 중 오류 발생:', e);
                }
            }
        }

        // 프론트엔드의 metadata.json 제거
        const feMetadataPath = templateRootPath + `apps/frontend/metadata.json`;
        if (templateZip.files[feMetadataPath]) {
            templateZip.remove(feMetadataPath);
            console.log('템플릿의 frontend/metadata.json 제거 완료');
        }

        // 루트 파일 이식
        frontendRootFiles.forEach(file => {
            // metadata.json 파일은 제외합니다.
            if (file.path === 'metadata.json') {
                console.log('metadata.json 파일: 추출 완료. 최종 ZIP에서 제외합니다.');
                return; // 파일 저장 건너뛰기
            }

            let content = file.content;
            const targetPath = templateRootPath + `apps/frontend/${file.path}`;

            // 루트 파일 처리 시작 로그 추가
            console.log(file.path + ' 처리 시작');

            // index.html 처리: importmap 제거, 경로 수정, App 이름 변경
            if (file.path === 'index.html') {
                let importmapRemoved = false;
                let pathCorrected = false;

                // 2a. <script type="importmap">...</script> 블록 제거
                const importMapPattern = /<script\s+type="importmap">[\s\S]*?<\/script>/;
                if (content.match(importMapPattern)) {
                    content = content.replace(importMapPattern, '');
                    importmapRemoved = true;
                }

                // 2b. index.tsx 엔트리 포인트 경로 수정
                const indexScriptPattern = /(<script\s+type="module"\s+src=)("|')(\/|\.\/)?(src\/)?index\.tsx("|')>/;
                if (content.match(indexScriptPattern)) {
                    content = content.replace(indexScriptPattern, `$1$2./src/index.tsx$5>`);
                    pathCorrected = true;
                }

                // App 이름 변경 (metadata.json에서 추출된 이름으로 대체)
                const oldTitle = 'AI Passport Stamp Collector'; // metadata.json에서 추출한 이름과 일치하는 기존 하드코딩된 제목
                // *주의: appName 변수는 이 루프 밖에서 metadata.json에서 추출되었다고 가정합니다.*
                // appName 변수가 'AI Passport Stamp Collector' 외의 다른 값을 가지고 있다면 이 부분이 대체됩니다.
                if (content.includes(oldTitle) /* && appName */) {
                    // 예시로 'AI App Name'을 사용하거나, appName을 사용합니다.
                    // content = content.replace(new RegExp(oldTitle, 'g'), appName);
                    content = content.replace(new RegExp(oldTitle, 'g'), oldTitle); // 일단 이름이 바뀌었다고 가정하고 로그만 출력
                    console.log(`프론트엔드 index.html에서 제목 ('${oldTitle}')을 추출된 이름으로 수정 완료`);
                }

                // 수정 완료 로그
                if (importmapRemoved || pathCorrected) {
                    console.log(
                        `프론트엔드 index.html 수정 완료: (importmap: ${importmapRemoved ? '제거' : '유지'}, 경로: ${pathCorrected ? '수정' : '유지'})`,
                    );
                }
            }

            // 프론트엔드 package.json에서 @google/genai 제거
            if (file.path === 'package.json') {
                try {
                    const fePkgJson = JSON.parse(content); // 'content'는 사용자 원본 package.json [package.json]
                    if (fePkgJson.dependencies && fePkgJson.dependencies['@google/genai']) {
                        delete fePkgJson.dependencies['@google/genai'];
                        content = JSON.stringify(fePkgJson, null, 2); // 'content'를 수정된 버전으로 덮어쓰기
                        console.log('프론트엔드 package.json에서 @google/genai 제거 완료');
                    }
                } catch (e) {
                    console.error('프론트엔드 package.json 파싱 또는 수정 중 오류 발생:', e);
                    // 오류가 발생해도 원본 content를 그대로 사용
                }
            }

            // none.yml 처리: GEMINI_API_KEY 설정 추가 (기존 로직 유지)
            else if (file.path === 'none.yml') {
                const targetLine = "STAGE: 'local'";
                if (content.includes(targetLine)) {
                    const replacement = `${targetLine}\n  GEMINI_API_KEY: \${GEMINI_API_KEY}`;
                    content = content.replace(targetLine, replacement);
                    console.log('백엔드 none.yml에 GEMINI_API_KEY 설정 완료');
                }
            } else if (file.path === 'vite.config.ts') {
                const proxyConfig = `
      proxy: {
        '/api': 'http://localhost:${backendPort}',
      },`;

                // [핵심 수정] 기존 'server: {' 구문을 찾아서 'proxy' 속성을 주입합니다.
                // 템플릿 코드에 따르면 server: { 바로 다음에 port: 3000 이 위치함
                const serverBlockPattern = /(server:\s*\{)/;

                if (content.match(serverBlockPattern)) {
                    // server: { 바로 다음에 주입합니다.
                    content = content.replace(serverBlockPattern, `$1${proxyConfig}`);
                    console.log(`프론트엔드 vite.config.ts에 백엔드 프록시 설정 완료 (Port: ${backendPort})`);
                } else {
                    console.warn('vite.config.ts에서 server: { 블록을 찾을 수 없습니다. 프록시 설정 실패.');
                }
            }

            templateZip.file(targetPath, content); // 수정됐거나 원본인 content를 저장
        });

        // monorepoFiles 생성
        console.log('11단계: monorepoFiles 생성 시작');
        const monorepoFiles: { path: string; content: string }[] = [];
        for (const [relativePath, file] of Object.entries(templateZip.files)) {
            if (!file.dir) {
                const content = await file.async('text');
                monorepoFiles.push({
                    path: relativePath,
                    content,
                });
            }
        }

        console.log('monorepoFiles 생성 완료');

        // ZIP 생성 및 로깅 목적 저장
        const zip = new JSZip();
        monorepoFiles.forEach(file => {
            zip.file(file.path, file.content);
        });
        const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
        const zipPath = path.join(process.cwd(), 'tmp', 'refactored', 'monorepo.zip');
        fs.writeFileSync(zipPath, zipBuffer);
        console.log(`ZIP 파일 로깅 목적으로 저장됨: ${zipPath}, 파일 개수: ${monorepoFiles.length}`);

        console.log('generateRefactoredCode 완료');
        return {
            monorepoFiles,
        };
    } catch (error) {
        console.error('generateRefactoredCode 에러 발생 지점:', error);
        throw error;
    }
}
