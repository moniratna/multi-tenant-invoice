import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { MatchModule } from '../match/match.module';
import { ClientsModule } from '../../common/clients/clients.module';

@Module({
  imports: [DatabaseModule, MatchModule, ClientsModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, DatabaseService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
