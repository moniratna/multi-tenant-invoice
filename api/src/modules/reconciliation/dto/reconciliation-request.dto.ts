import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ReconciliationRequestDto {
  @ApiProperty({ example: 5, default: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  topN?: number;

  @ApiProperty({
    example: ['invoice-uuid-1', 'invoice-uuid-2'],
    required: false,
    description:
      'Specific invoice IDs to reconcile. If not provided, reconciles all open invoices.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  invoiceIds?: string[];

  @ApiProperty({
    example: ['transaction-uuid-1', 'transaction-uuid-2'],
    required: false,
    description:
      'Specific transaction IDs to consider. If not provided, considers all transactions.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  transactionIds?: string[];
}
