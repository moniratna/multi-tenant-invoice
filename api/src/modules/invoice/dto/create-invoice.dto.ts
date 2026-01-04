import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  INR = 'INR',
}

export enum InvoiceStatus {
  OPEN = 'open',
  MATCHED = 'matched',
  PAID = 'paid',
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'vendor-uuid', required: false })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiProperty({ example: 'INV-001', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @ApiProperty({ example: 1500.5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ enum: Currency, default: 'USD', required: false })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ example: '2024-01-15T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiProperty({ example: 'Office supplies invoice', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: InvoiceStatus, default: 'open', required: false })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
