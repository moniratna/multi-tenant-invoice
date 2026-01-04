import { Module, Global } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [IdempotencyService, DatabaseService],
  exports: [IdempotencyService],
})
export class ServicesModule {}
