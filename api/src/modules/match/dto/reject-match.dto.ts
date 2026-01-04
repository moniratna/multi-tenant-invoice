import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectMatchDto {
  @ApiProperty({ example: 'Incorrect match', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
