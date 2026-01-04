import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MatchStatus } from './match-response.dto';

export class FilterMatchDto {
  @ApiProperty({ enum: MatchStatus, required: false })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiProperty({ example: 'invoice-uuid', required: false })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiProperty({ example: 'transaction-uuid', required: false })
  @IsOptional()
  @IsUUID()
  bankTransactionId?: string;
}
