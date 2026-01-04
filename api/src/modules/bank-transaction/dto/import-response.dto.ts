import { ApiProperty } from '@nestjs/swagger';

export class ImportResponseDto {
  @ApiProperty()
  imported: number;

  @ApiProperty()
  duplicates: number;

  @ApiProperty()
  errors: number;

  @ApiProperty({ type: [String] })
  errorMessages: string[];

  @ApiProperty()
  idempotencyKey?: string;
}
