import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiProperty({ example: 'Updated Acme Corporation', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;
}
