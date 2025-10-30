export interface AIService {
    refactorCode(fileStructure: Record<string, string>): Promise<string>;
}

export enum AIServiceType {
    GEMINI = 'gemini',
    OPENAI = 'openai',
    CLAUDE = 'claude',
}
