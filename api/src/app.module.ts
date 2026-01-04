import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigurationModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { DatabaseService } from './database/database.service';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { BankTransactionModule } from './modules/bank-transaction/bank-transaction.module';
import { MatchModule } from './modules/match/match.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { AiExplanationModule } from './modules/ai-explanation/ai-explanation.module';
import { ServicesModule } from './common/services/services.module';
import { ClientsModule } from './common/clients/clients.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantAccessGuard } from './common/guards/tenant-access.guard';
import { RlsContextInterceptor } from './common/interceptors/rls-context.interceptor';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    ServicesModule,
    ClientsModule,
    AuthModule,
    TenantModule,
    InvoiceModule,
    BankTransactionModule,
    MatchModule,
    ReconciliationModule,
    AiExplanationModule,
  ],
  providers: [
    DatabaseService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantAccessGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RlsContextInterceptor,
    },
  ],
})
export class AppModule {}
