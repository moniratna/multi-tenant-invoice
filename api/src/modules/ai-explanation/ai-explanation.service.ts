import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { invoices, bankTransactions, vendors } from '../../database/schema';
import { IAiProvider } from './providers/ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { MockAiProvider } from './providers/mock.provider';
import { AiExplanationResponseDto } from './dto/ai-explanation-response.dto';

@Injectable()
export class AiExplanationService {
  private readonly logger = new Logger(AiExplanationService.name);
  private readonly provider: IAiProvider;
  private readonly aiProvider: string;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly mockProvider: MockAiProvider,
  ) {
    this.aiProvider = this.configService.get<string>('ai.provider', 'mock');

    // Select provider based on configuration
    switch (this.aiProvider.toLowerCase()) {
      case 'openai':
        this.provider = this.openAiProvider;
        this.logger.log('Using OpenAI provider');
        break;
      case 'anthropic':
        this.provider = this.anthropicProvider;
        this.logger.log('Using Anthropic provider');
        break;
      case 'mock':
      default:
        this.provider = this.mockProvider;
        this.logger.log('Using Mock AI provider');
        break;
    }
  }

  /**
   * Generate AI explanation for an invoice-transaction pair
   */
  async generateExplanation(
    tenantId: string,
    invoiceId: string,
    transactionId: string,
    forceFallback: boolean = false,
  ): Promise<AiExplanationResponseDto> {
    const startTime = Date.now();

    // 1. Fetch invoice
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      throw new BadRequestException(`Invoice ${invoiceId} not found`);
    }

    // 2. Fetch transaction
    const [transaction] = await this.databaseService.db
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.id, transactionId),
          eq(bankTransactions.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!transaction) {
      throw new BadRequestException(`Transaction ${transactionId} not found`);
    }

    // 3. Fetch vendor name if exists
    let vendorName: string | undefined;
    if (invoice.vendorId) {
      const [vendor] = await this.databaseService.db
        .select()
        .from(vendors)
        .where(eq(vendors.id, invoice.vendorId))
        .limit(1);
      vendorName = vendor?.name;
    }

    // 4. Calculate heuristic score (simple version)
    const heuristicScore = this.calculateHeuristicScore(invoice, transaction);

    // 5. Generate explanation
    let explanation: string;
    let confidence: number;
    let source: 'ai' | 'fallback';

    if (!forceFallback) {
      try {
        // Check if AI provider is available
        const isAvailable = await this.provider.isAvailable();

        if (isAvailable) {
          const aiResult = await this.provider.generateExplanation({
            invoiceAmount: invoice.amount,
            invoiceDate: invoice.invoiceDate?.toISOString(),
            invoiceVendor: vendorName,
            invoiceDescription: invoice.description ?? undefined,
            invoiceNumber: invoice.invoiceNumber ?? undefined,
            transactionAmount: transaction.amount,
            transactionDate: transaction.postedAt.toISOString(),
            transactionDescription: transaction.description ?? undefined,
            heuristicScore,
          });

          explanation = aiResult.explanation;
          confidence = aiResult.confidence * 100;
          source = 'ai';

          this.logger.debug(
            `AI explanation generated for ${invoiceId} <-> ${transactionId}`,
          );
        } else {
          throw new Error('AI provider not available');
        }
      } catch (error) {
        this.logger.warn(
          `AI explanation failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );

        const fallback = this.generateFallbackExplanation(
          invoice,
          transaction,
          vendorName,
        );
        explanation = fallback.explanation;
        confidence = fallback.score;
        source = 'fallback';
      }
    } else {
      // Force fallback for testing
      const fallback = this.generateFallbackExplanation(
        invoice,
        transaction,
        vendorName,
      );
      explanation = fallback.explanation;
      confidence = fallback.score;
      source = 'fallback';
    }

    const processingTime = Date.now() - startTime;

    return {
      explanation,
      score: Math.round(confidence),
      confidenceLabel: this.getConfidenceLabel(confidence),
      source,
      invoiceDetails: {
        amount: invoice.amount,
        currency: invoice.currency,
        invoiceNumber: invoice.invoiceNumber ?? undefined,
        description: invoice.description ?? undefined,
        date: invoice.invoiceDate?.toISOString(),
        vendorName,
      },
      transactionDetails: {
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.description ?? undefined,
        date: transaction.postedAt.toISOString(),
      },
      processingTimeMs: processingTime,
    };
  }

  /**
   * Calculate simple heuristic score
   */
  private calculateHeuristicScore(
    invoice: typeof invoices.$inferSelect,
    transaction: typeof bankTransactions.$inferSelect,
  ): number {
    let score = 0;

    // Amount match (40 points)
    const invAmount = parseFloat(invoice.amount as string);
    const txnAmount = parseFloat(transaction.amount as string);

    if (invAmount === txnAmount) {
      score += 40;
    } else {
      const diff = Math.abs(invAmount - txnAmount);
      const percentDiff = (diff / invAmount) * 100;
      score += Math.max(0, 40 - percentDiff * 2);
    }

    // Currency match (10 points)
    if (invoice.currency === (transaction.currency as string)) {
      score += 10;
    }

    // Date proximity (30 points)
    if (invoice.invoiceDate instanceof Date) {
      const daysDiff = Math.abs(
        (invoice.invoiceDate.getTime() -
          new Date(transaction.postedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysDiff <= 3) {
        score += 30 - daysDiff * 5;
      } else {
        score += Math.max(0, 30 - daysDiff);
      }
    } else {
      score += 15; // Partial credit if no date
    }

    // Text match (20 points)
    if (
      invoice.invoiceNumber &&
      typeof invoice.invoiceNumber === 'string' &&
      transaction.description?.includes(invoice.invoiceNumber)
    ) {
      score += 20;
    } else if (
      invoice.description &&
      typeof invoice.description === 'string' &&
      transaction.description &&
      transaction.description
        .toLowerCase()
        .includes(invoice.description.toLowerCase().split(' ')[0] as string)
    ) {
      score += 10;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Generate deterministic fallback explanation
   */
  private generateFallbackExplanation(
    invoice: typeof invoices.$inferSelect,
    transaction: typeof bankTransactions.$inferSelect,
    vendorName?: string,
  ): { explanation: string; score: number } {
    const parts: string[] = [];
    let score = 0;

    // Amount comparison
    const invAmount = parseFloat(invoice.amount);
    const txnAmount = parseFloat(transaction.amount);

    if (invAmount === txnAmount) {
      parts.push('The amounts match exactly');
      score += 40;
    } else {
      const diff = Math.abs(invAmount - txnAmount);
      const percentDiff = (diff / invAmount) * 100;
      parts.push(
        `The amounts differ by ${percentDiff.toFixed(1)}% (${invoice.amount} vs ${transaction.amount})`,
      );
      score += Math.max(0, 40 - percentDiff * 2);
    }

    // Currency check
    if (invoice.currency !== transaction.currency) {
      parts.push('but they use different currencies');
      score -= 10;
    } else {
      score += 10;
    }

    // Date comparison
    if (invoice.invoiceDate) {
      const daysDiff = Math.abs(
        (invoice.invoiceDate.getTime() - transaction.postedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysDiff === 0) {
        parts.push('The transaction occurred on the same day as the invoice');
        score += 30;
      } else if (daysDiff <= 3) {
        parts.push(
          `The transaction is ${Math.round(daysDiff)} day${daysDiff > 1 ? 's' : ''} from the invoice date`,
        );
        score += 30 - daysDiff * 5;
      } else {
        parts.push(
          `The transaction is ${Math.round(daysDiff)} days from the invoice date`,
        );
        score += Math.max(0, 30 - daysDiff);
      }
    } else {
      parts.push('The invoice date is not specified');
      score += 15;
    }

    // Text similarity
    if (
      invoice.invoiceNumber &&
      transaction.description?.includes(invoice.invoiceNumber)
    ) {
      parts.push(
        `The invoice number "${invoice.invoiceNumber}" is referenced in the transaction description`,
      );
      score += 20;
    } else if (vendorName && transaction.description?.includes(vendorName)) {
      parts.push(
        `The vendor name "${vendorName}" appears in the transaction description`,
      );
      score += 15;
    } else if (
      invoice.description &&
      transaction.description &&
      transaction.description
        .toLowerCase()
        .includes(invoice.description.toLowerCase().split(' ')[0])
    ) {
      parts.push('There is some text similarity in the descriptions');
      score += 10;
    } else {
      parts.push('The descriptions do not show clear similarity');
    }

    // Build final explanation
    const explanation = parts.join('. ') + '.';

    return {
      explanation,
      score: Math.min(100, Math.round(score)),
    };
  }

  /**
   * Get confidence label from score
   */
  private getConfidenceLabel(score: number): string {
    if (score >= 90) return 'Very High';
    if (score >= 75) return 'High';
    if (score >= 50) return 'Medium';
    if (score >= 25) return 'Low';
    return 'Very Low';
  }
}
