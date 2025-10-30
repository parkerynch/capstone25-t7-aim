import { AIService } from './interface';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

export class GeminiService implements AIService {
    private genAI: GoogleGenerativeAI;
    private systemPrompt: string;
    private userPromptTemplate: string;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.loadPrompts();
    }

    private loadPrompts(): void {
        try {
            const promptsDir = path.join(process.cwd(), 'prompts');
            this.systemPrompt = fs.readFileSync(path.join(promptsDir, 'system.txt'), 'utf-8');
            this.userPromptTemplate = fs.readFileSync(path.join(promptsDir, 'user.txt'), 'utf-8');
            console.log('✅ Gemini prompts loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load Gemini prompt files:', error);
            throw new Error('Failed to load prompt templates. Ensure prompts/system.txt and prompts/user.txt exist.');
        }
    }

    public async refactorCode(fileStructure: Record<string, string>): Promise<string> {
        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = this.buildRefactoringPrompt(fileStructure);

        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    private buildRefactoringPrompt(fileStructure: Record<string, string>): string {
        const fileStructureText = Object.entries(fileStructure)
            .map(([filePath, content]) => {
                const lines = content.split('\n').slice(0, 50);
                const preview = lines.join('\n');
                const truncated = lines.length < content.split('\n').length ? '\n... (truncated)' : '';
                return `## File: ${filePath}\n\`\`\`\n${preview}${truncated}\n\`\`\`\n`;
            })
            .join('\n');

        const userPrompt = this.userPromptTemplate
            .replace('{FILE_STRUCTURE}', fileStructureText)
            .replace('{FILE_COUNT}', Object.keys(fileStructure).length.toString());

        return `${this.systemPrompt}\n\n---\n\n${userPrompt}`;
    }
}
