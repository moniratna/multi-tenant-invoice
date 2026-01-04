import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantResolver } from './tenant.resolver';
import { DatabaseModule } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TenantController],
  providers: [TenantService, TenantResolver, DatabaseService],
  exports: [TenantService],
})
export class TenantModule {}
