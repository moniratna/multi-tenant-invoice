import { ApiProperty } from '@nestjs/swagger';

export class AiExplanationResponseDto {
  @ApiProperty({ description: 'Natural language explanation of the match' })
  explanation: string;

  @ApiProperty({ description: 'Confidence score (0-100)' })
  score: number;

  @ApiProperty({
    description: 'Confidence label',
    example: 'High confidence',
    enum: ['Very High', 'High', 'Medium', 'Low', 'Very Low'],
  })
  confidenceLabel: string;

  @ApiProperty({ description: 'Whether AI was used or fallback' })
  source: 'ai' | 'fallback';

  @ApiProperty({ description: 'Invoice details used in explanation' })
  invoiceDetails: {
    amount: string;
    currency: string;
    invoiceNumber?: string;
    description?: string;
    date?: string;
    vendorName?: string;
  };

  @ApiProperty({ description: 'Transaction details used in explanation' })
  transactionDetails: {
    amount: string;
    currency: string;
    description?: string;
    date: string;
  };

  @ApiProperty({ description: 'Processing time in milliseconds' })
  processingTimeMs: number;
}
