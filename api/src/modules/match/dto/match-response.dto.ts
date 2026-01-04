import { ApiProperty } from '@nestjs/swagger';

export enum MatchStatus {
  PROPOSED = 'proposed',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

export class MatchResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  invoiceId: string;

  @ApiProperty()
  bankTransactionId: string;

  @ApiProperty()
  score: string;

  @ApiProperty({ enum: MatchStatus })
  status: MatchStatus;

  @ApiProperty()
  explanation: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  confirmedAt?: Date;

  @ApiProperty({ required: false })
  confirmedBy?: string;
}
