import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Currency } from '../../invoice/dto/create-invoice.dto';

export class CreateBankTransactionDto {
  @ApiProperty({ example: 'TXN-12345', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  @IsNotEmpty()
  @IsDateString()
  postedAt: string;

  @ApiProperty({ example: 1500.5 })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ enum: Currency, default: 'USD', required: false })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({
    example: 'Payment from Acme Corp for Invoice INV-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
