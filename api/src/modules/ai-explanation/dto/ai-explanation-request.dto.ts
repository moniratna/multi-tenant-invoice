import { IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiExplanationRequestDto {
  @ApiProperty({ example: 'invoice-uuid' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ example: 'transaction-uuid' })
  @IsUUID()
  transactionId: string;

  @ApiProperty({
    example: false,
    default: false,
    required: false,
    description: 'Force use of fallback explanation (for testing)',
  })
  @IsOptional()
  @IsBoolean()
  forceFallback?: boolean;
}
