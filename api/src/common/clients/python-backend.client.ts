import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface MatchCandidate {
  invoiceId: string;
  transactionId: string;
  score: number;
  amountScore: number;
  dateScore: number;
  textScore: number;
  explanation: string;
}

export interface InvoiceInput {
  id: string;
  amount: string;
  currency: string;
  invoiceDate?: string;
  description?: string;
  invoiceNumber?: string;
  vendorName?: string;
}

export interface TransactionInput {
  id: string;
  amount: string;
  currency: string;
  postedAt: string;
  description?: string;
}

export interface ScoreCandidatesResponse {
  candidates: MatchCandidate[];
  totalProcessed: number;
  processingTimeMs: number;
}

@Injectable()
export class PythonBackendClient {
  private readonly logger = new Logger(PythonBackendClient.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'pythonBackend.url',
      'http://localhost:8000',
    );

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Python backend client initialized: ${this.baseUrl}`);
  }

  /**
   * Score match candidates using the Python reconciliation engine
   */
  async scoreCandidates(
    tenantId: string,
    invoices: InvoiceInput[],
    transactions: TransactionInput[],
    topN: number = 5,
  ): Promise<ScoreCandidatesResponse> {
    const query = `
      mutation ScoreCandidates($input: ScoreCandidatesInput!) {
        scoreCandidates(input: $input) {
          candidates {
            invoiceId
            transactionId
            score
            amountScore
            dateScore
            textScore
            explanation
          }
          totalProcessed
          processingTimeMs
        }
      }
    `;

    const variables = {
      input: {
        tenantId,
        invoices,
        transactions,
        topN,
      },
    };

    try {
      this.logger.debug(
        `Scoring candidates: ${invoices.length} invoices x ${transactions.length} transactions`,
      );

      const response = await this.client.post('/graphql', {
        query,
        variables,
      });

      if (response.data.errors) {
        throw new Error(
          `GraphQL errors: ${JSON.stringify(response.data.errors)}`,
        );
      }

      const result = response.data.data.scoreCandidates;

      this.logger.debug(
        `Scored ${result.candidates.length} candidates in ${result.processingTimeMs}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to score candidates: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Health check for Python backend
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      this.logger.warn(`Python backend health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get Python backend configuration
   */
  async getConfig(): Promise<any> {
    try {
      const response = await this.client.get('/config');
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get config: ${error.message}`);
      return null;
    }
  }
}
