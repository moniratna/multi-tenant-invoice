import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateBankTransactionDto } from './create-bank-transaction.dto';

export class ImportBankTransactionsDto {
  @ApiProperty({ type: [CreateBankTransactionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBankTransactionDto)
  transactions: CreateBankTransactionDto[];
}
