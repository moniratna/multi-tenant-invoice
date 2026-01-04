import { ApiProperty } from '@nestjs/swagger';
import { MatchResponseDto } from '../../match/dto/match-response.dto';

export class ReconciliationResponseDto {
  @ApiProperty({ type: [MatchResponseDto] })
  matches: MatchResponseDto[];

  @ApiProperty()
  totalCandidates: number;

  @ApiProperty()
  invoicesProcessed: number;

  @ApiProperty()
  transactionsProcessed: number;

  @ApiProperty()
  processingTimeMs: number;

  @ApiProperty()
  pythonScoringTimeMs?: number;
}
