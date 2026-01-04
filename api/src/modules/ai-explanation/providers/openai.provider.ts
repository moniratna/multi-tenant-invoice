import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  IAiProvider,
  AiExplanationInput,
  AiExplanationOutput,
} from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements IAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly model: string = 'gpt-4o-mini';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ai.openaiApiKey', '');

    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async generateExplanation(
    input: AiExplanationInput,
  ): Promise<AiExplanationOutput> {
    if (!(await this.isAvailable())) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.buildPrompt(input);

    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a financial reconciliation assistant. Explain matches between invoices and bank transactions in 2-6 sentences. Be concise and clear.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const explanation = response.data.choices[0].message.content.trim();
      const confidence = this.calculateConfidence(input.heuristicScore);

      this.logger.debug(
        `OpenAI explanation generated: ${explanation.substring(0, 50)}...`,
      );

      return {
        explanation,
        confidence,
      };
    } catch (error) {
      this.logger.error(`OpenAI API error: ${error.message}`);
      throw error;
    }
  }

  private buildPrompt(input: AiExplanationInput): string {
    return `
Explain why this invoice and bank transaction might match (or not match):

Invoice:
- Amount: ${input.invoiceAmount}
- Date: ${input.invoiceDate || 'Not specified'}
- Invoice Number: ${input.invoiceNumber || 'Not specified'}
- Vendor: ${input.invoiceVendor || 'Not specified'}
- Description: ${input.invoiceDescription || 'Not specified'}

Bank Transaction:
- Amount: ${input.transactionAmount}
- Date: ${input.transactionDate}
- Description: ${input.transactionDescription || 'Not specified'}

Our automated scoring system rated this match at ${input.heuristicScore.toFixed(1)}%.

Provide a brief, natural language explanation of this match suitable for an accountant.
`.trim();
  }

  private calculateConfidence(score: number): number {
    // Convert 0-100 score to 0-1 confidence
    return score / 100;
  }
}
