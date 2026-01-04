import { Module } from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MatchController],
  providers: [MatchService, DatabaseService],
  exports: [MatchService],
})
export class MatchModule {}
