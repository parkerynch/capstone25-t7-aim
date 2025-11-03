import { GoogleGenAI, Type } from '@google/genai';
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
    const parsedYaml = yaml.load(fileContent) as any;

    // 'prompt' 키 내부의 'genaiBackend' 등을 찾음
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

// AI 모델을 호출하는 헬퍼 함수
const callAiRefactor = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: codeResponseSchema, // 코드 조각 스키마 사용
                temperature: 0.1, // 리팩토링은 창의성보다 정확성이 중요
            },
        });
        console.log('AI Response Text:', response.text); // 디버그용 전체 응답 출력
        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);

        if (parsedJson && typeof parsedJson.code === 'string') {
            // 코드 블록(```typescript ... ```)을 제거하고 순수 코드만 반환
            return parsedJson.code.replace(/```(typescript|ts)?\n([\s\S]*?)\n```/, '$2').trim();
        } else {
            throw new Error('Invalid JSON structure (code) received from AI.');
        }
    } catch (error) {
        console.error('Error in callAiRefactor:', error);
        throw new AimException(ErrorCode.AI_REFACTORING_FAILED, 'AI code refactoring step failed.');
    }
};

/**
 * [수정됨]
 * 이 함수는 이제 3단계 AI 봇 오케스트레이터 역할을 합니다.
 * .yml 파일에서 1, 2, 3단계 프롬프트를 모두 로드하여 순차적으로 실행합니다.
 */
export async function generateBlogContent($param: { s3Url: string; keyword: string }): Promise<GeneratedContent> {
    console.log('generateBlogContent 시작');
    try {
        // --- 1. ZIP 파일 다운로드 및 분석 ---
        console.log('1단계: ZIP 다운로드 시작');
        const response = await axios.get($param.s3Url, { responseType: 'arraybuffer' });
        console.log('ZIP 다운로드 완료, 크기:', response.data.byteLength);
        const zipBuffer = response.data as ArrayBuffer;
        const zip = await JSZip.loadAsync(zipBuffer);
        console.log('ZIP 로드 완료, 파일 목록:', Object.keys(zip.files));

        // [수정됨] 변수명 변경 (frontendFiles -> otherFrontendFiles)
        const otherFrontendFiles: { path: string; content: string }[] = [];
        let originalServiceCode: string | null = null;
        let originalTypeCode: string | null = null;

        console.log('프롬프트 템플릿 로드 시작');
        const apiCodeTemplate = loadPromptTemplate('api-template.yml', 'apiTemplate');
        console.log('apiCodeTemplate 로드 완료');

        for (const [filePath, file] of Object.entries(zip.files)) {
            if (file.dir) continue;
            const content = await file.async('text');
            console.log(`파일 처리: ${filePath}`);

            if (filePath === 'services/geminiService.ts') {
                originalServiceCode = content;
            } else if (filePath === 'types.ts') {
                originalTypeCode = content;
            } else {
                otherFrontendFiles.push({ path: filePath, content: content });
            }
        }

        if (!originalServiceCode) {
            throw new AimException(ErrorCode.INVALID_INPUT, 'services/geminiService.ts not found in zip file.');
        }
        console.log('ZIP 분석 완료');

        // --- 2. 3단계를 위한 정보 추출 ---
        console.log('2단계: 함수 이름 추출 시작');
        const funcNameMatch = originalServiceCode.match(
            /export (?:async )?(?:function|const) ([\w]+)(?:\(| = async \()/,
        );
        console.log('funcNameMatch 결과:', funcNameMatch);
        if (!funcNameMatch || !funcNameMatch[1]) {
            // [수정] [2] -> [1]
            throw new AimException(ErrorCode.INVALID_INPUT, 'Main function name not found in geminiService.ts');
        }
        const mainFunctionName = funcNameMatch[1]; // [수정] [2] -> [1]
        const apiPathId = camelToDash(mainFunctionName);
        console.log('함수 이름 추출 완료:', mainFunctionName);

        // --- 3. AI 호출 (1단계: 백엔드 서비스 리팩토링) ---
        console.log('3단계: AI 1단계 시작');
        const systemPrompt = loadPromptTemplate('system-prompt.yml', 'genaiBackend');
        let userPrompt1 = loadPromptTemplate('user-prompt.yml', 'genaiBackend1');
        userPrompt1 = userPrompt1.replace('{{serviceCode}}', `\n${originalServiceCode}\n`);
        userPrompt1 = userPrompt1.replace('{{typeCode}}', `\n${originalTypeCode || ''}\n`);
        const finalPrompt1 = `${systemPrompt}\n\n${userPrompt1}`;
        const refactoredServiceCode = await callAiRefactor(finalPrompt1);
        console.log('AI 1단계 완료');

        // --- 4. AI 호출 (2단계: 백엔드 API 작성) ---
        console.log('4단계: AI 2단계 시작');
        let userPrompt2 = loadPromptTemplate('user-prompt.yml', 'genaiBackend2');
        userPrompt2 = userPrompt2.replace('{{apiCode}}', `\n${apiCodeTemplate}\n`);
        userPrompt2 = userPrompt2.replace('{{serviceCode}}', `\n${refactoredServiceCode}\n`);
        const finalPrompt2 = `${systemPrompt}\n\n${userPrompt2}`;
        const refactoredApiCode = await callAiRefactor(finalPrompt2);
        console.log('AI 2단계 완료');

        // --- 5. AI 호출 (3단계: 프론트엔드 서비스 수정) ---
        console.log('5단계: AI 3단계 시작');
        let userPrompt3 = loadPromptTemplate('user-prompt.yml', 'genaiBackend3');
        userPrompt3 = userPrompt3.replace('{{apiPathId}}', apiPathId);
        userPrompt3 = userPrompt3.replace('{{serviceCode}}', `\n${originalServiceCode}\n`);
        userPrompt3 = userPrompt3.replace('{{typeCode}}', `\n${originalTypeCode || ''}\n`);
        const finalPrompt3 = `${systemPrompt}\n\n${userPrompt3}`;
        const refactoredFrontendServiceCode = await callAiRefactor(finalPrompt3);
        console.log('AI 3단계 완료');

        // --- 6. 최종 결과물 조립 ---
        console.log('6단계: 결과 조립 시작');
        const backendFiles = [
            { path: 'apps/backend/src/services/geminiService.ts', content: refactoredServiceCode },
            { path: 'apps/backend/src/api/hello-api.ts', content: refactoredApiCode },
        ];
        if (originalTypeCode) {
            backendFiles.push({ path: 'apps/backend/src/services/types.ts', content: originalTypeCode });
        }

        const frontendFiles = [
            ...otherFrontendFiles,
            { path: 'services/geminiService.ts', content: refactoredFrontendServiceCode },
        ];
        if (originalTypeCode) {
            frontendFiles.push({ path: 'types.ts', content: originalTypeCode });
        }

        const result: GeneratedContent = {
            frontendFiles: frontendFiles,
            backendFiles: backendFiles,
        };
        console.log('결과 조립 완료');

        // --- 7. 로깅 ---
        console.log('7단계: 파일 쓰기 시작');
        const tmpDir = path.join(process.cwd(), 'tmp', 'refactored');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const frontendZip = new JSZip();
        result.frontendFiles.forEach(file => frontendZip.file(file.path, file.content));
        const backendZip = new JSZip();
        result.backendFiles.forEach(file => backendZip.file(file.path, file.content));

        fs.writeFileSync(path.join(tmpDir, 'frontend.zip'), await frontendZip.generateAsync({ type: 'uint8array' }));
        fs.writeFileSync(path.join(tmpDir, 'backend.zip'), await backendZip.generateAsync({ type: 'uint8array' }));
        fs.writeFileSync(path.join(tmpDir, 'response.json'), JSON.stringify(result, null, 2));
        console.log('파일 쓰기 완료');

        console.log('generateBlogContent 완료');
        return result;
    } catch (error) {
        console.error('generateBlogContent 에러 발생 지점:', error);
        throw error;
    }
}
