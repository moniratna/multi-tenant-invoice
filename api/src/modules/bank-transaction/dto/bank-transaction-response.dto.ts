import { ApiProperty } from '@nestjs/swagger';

export class BankTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty({ required: false })
  externalId?: string;

  @ApiProperty()
  postedAt: Date;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  currency: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
