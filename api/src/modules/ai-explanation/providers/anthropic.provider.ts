import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  IAiProvider,
  AiExplanationInput,
  AiExplanationOutput,
} from './ai-provider.interface';

@Injectable()
export class AnthropicProvider implements IAiProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly model: string = 'claude-3-haiku-20240307';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ai.anthropicApiKey', '');

    this.client = axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
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
      throw new Error('Anthropic API key not configured');
    }

    const prompt = this.buildPrompt(input);

    try {
      const response = await this.client.post('/messages', {
        model: this.model,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const explanation = response.data.content[0].text.trim();
      const confidence = this.calculateConfidence(input.heuristicScore);

      this.logger.debug(
        `Anthropic explanation generated: ${explanation.substring(0, 50)}...`,
      );

      return {
        explanation,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Anthropic API error: ${error.message}`);
      throw error;
    }
  }

  private buildPrompt(input: AiExplanationInput): string {
    return `You are a financial reconciliation assistant. Explain this invoice-transaction match in 2-6 clear sentences for an accountant.

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

Automated score: ${input.heuristicScore.toFixed(1)}%

Provide a concise explanation of why these do or don't match.`;
  }

  private calculateConfidence(score: number): number {
    return score / 100;
  }
}
