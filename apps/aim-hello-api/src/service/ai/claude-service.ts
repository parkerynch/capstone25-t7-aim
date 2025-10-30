import Anthropic from '@anthropic-ai/sdk';
import { AIService } from './interface';
import * as fs from 'fs';
import * as path from 'path';

export class ClaudeService implements AIService {
    private client: Anthropic;
    private systemPrompt: string;
    private userPromptTemplate: string;

    constructor() {
        const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY or CLAUDE_API_KEY is not set');
        }
        this.client = new Anthropic({
            apiKey: apiKey,
        });
        this.loadPrompts();
    }

    private loadPrompts(): void {
        try {
            const promptsDir = path.join(process.cwd(), 'prompts');
            this.systemPrompt = fs.readFileSync(path.join(promptsDir, 'system.txt'), 'utf-8');
            this.userPromptTemplate = fs.readFileSync(path.join(promptsDir, 'user.txt'), 'utf-8');
            console.log('✅ Claude prompts loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load Claude prompt files:', error);
            throw new Error('Failed to load prompt templates. Ensure prompts/system.txt and prompts/user.txt exist.');
        }
    }

    public async refactorCode(fileStructure: Record<string, string>): Promise<string> {
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

        try {
            const response = await this.client.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4096,
                system: this.systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            });

            const content = response.content[0];
            if (content.type === 'text') {
                return content.text;
            } else {
                throw new Error('Unexpected response format from Claude API');
            }
        } catch (error) {
            console.error('❌ Claude API call failed:', error);
            throw new Error(`Claude API call failed: ${error}`);
        }
    }
}
