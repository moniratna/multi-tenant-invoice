import { Module } from '@nestjs/common';
import { BankTransactionService } from './bank-transaction.service';
import { BankTransactionController } from './bank-transaction.controller';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { IdempotencyService } from '../../common/services/idempotency.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BankTransactionController],
  providers: [BankTransactionService, DatabaseService, IdempotencyService],
  exports: [BankTransactionService],
})
export class BankTransactionModule {}
