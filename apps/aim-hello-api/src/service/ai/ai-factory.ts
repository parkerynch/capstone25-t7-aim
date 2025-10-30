import { AIService, AIServiceType } from './interface';
import { GeminiService } from './gemini-service';
import { ClaudeService } from './claude-service';

export class AIFactory {
    public static createService(type?: AIServiceType): AIService {
        const aiType = type || AIServiceType.CLAUDE;

        switch (aiType) {
            case AIServiceType.GEMINI:
                return new GeminiService();
            // case AIServiceType.OPENAI:
            //     return new OpenAIService();
            case AIServiceType.CLAUDE:
                return new ClaudeService();
            default:
                throw new Error(`Unsupported AI service type: ${aiType}`);
        }
    }
}
