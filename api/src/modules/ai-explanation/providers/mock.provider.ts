import { Injectable, Logger } from '@nestjs/common';
import {
  IAiProvider,
  AiExplanationInput,
  AiExplanationOutput,
} from './ai-provider.interface';

@Injectable()
export class MockAiProvider implements IAiProvider {
  private readonly logger = new Logger(MockAiProvider.name);

  async isAvailable(): Promise<boolean> {
    return true; // Always available for testing
  }

  async generateExplanation(
    input: AiExplanationInput,
  ): Promise<AiExplanationOutput> {
    this.logger.debug('Using mock AI provider');

    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const explanation = this.generateMockExplanation(input);
    const confidence = input.heuristicScore / 100;

    return {
      explanation,
      confidence,
    };
  }

  private generateMockExplanation(input: AiExplanationInput): string {
    const score = input.heuristicScore;
    const invAmount = parseFloat(input.invoiceAmount);
    const txnAmount = parseFloat(input.transactionAmount);
    const amountMatch = invAmount === txnAmount;

    if (score >= 85) {
      return `This appears to be a strong match. ${
        amountMatch
          ? 'The amounts match exactly'
          : `The amounts are very close (${input.invoiceAmount} vs ${input.transactionAmount})`
      }. ${
        input.invoiceNumber &&
        input.transactionDescription?.includes(input.invoiceNumber)
          ? `The invoice number "${input.invoiceNumber}" is referenced in the transaction description.`
          : 'The timing and descriptions align well.'
      } This transaction likely corresponds to the invoice payment.`;
    } else if (score >= 60) {
      return `This is a possible match worth reviewing. The amounts ${
        amountMatch ? 'match exactly' : 'are reasonably close'
      } and the dates are within a few days. However, ${
        input.invoiceNumber
          ? `the invoice number "${input.invoiceNumber}" is not clearly referenced in the transaction`
          : 'additional verification may be needed based on the transaction description'
      }. Manual review recommended.`;
    } else if (score >= 40) {
      return `This is a weak match that requires careful review. While there are some similarities between the invoice and transaction, ${
        !amountMatch
          ? `the amounts differ (${input.invoiceAmount} vs ${input.transactionAmount})`
          : "key details don't align well"
      }. The transaction description doesn't clearly indicate this is the corresponding payment. Consider looking for alternative matches.`;
    } else {
      return `This is unlikely to be a correct match. ${
        !amountMatch
          ? `The amounts don't match (${input.invoiceAmount} vs ${input.transactionAmount})`
          : 'The amounts match'
      }, but ${
        input.invoiceDate
          ? 'the dates are significantly different'
          : "other key details don't align"
      }. The transaction description doesn't reference this invoice. This pairing should probably be disregarded.`;
    }
  }
}
