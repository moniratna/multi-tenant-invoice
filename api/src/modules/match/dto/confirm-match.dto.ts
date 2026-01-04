import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmMatchDto {
  @ApiProperty({ example: 'user-id-123', required: false })
  @IsOptional()
  @IsString()
  confirmedBy?: string;
}
