import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { bankTransactions } from '../../database/schema';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';
import { ImportBankTransactionsDto } from './dto/import-bank-transactions.dto';
import { ImportResponseDto } from './dto/import-response.dto';
import { IdempotencyService } from '../../common/services/idempotency.service';

@Injectable()
export class BankTransactionService {
  private readonly logger = new Logger(BankTransactionService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async create(tenantId: string, createDto: CreateBankTransactionDto) {
    const [transaction] = await this.databaseService.db
      .insert(bankTransactions)
      .values({
        tenantId,
        externalId: createDto.externalId,
        postedAt: new Date(createDto.postedAt),
        amount: createDto.amount.toString(),
        currency: createDto.currency || 'USD',
        description: createDto.description,
      })
      .returning();

    return transaction;
  }

  async findAll(tenantId: string) {
    return this.databaseService.db
      .select()
      .from(bankTransactions)
      .where(eq(bankTransactions.tenantId, tenantId));
  }

  async findOne(tenantId: string, id: string) {
    const [transaction] = await this.databaseService.db
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.id, id),
          eq(bankTransactions.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!transaction) {
      throw new NotFoundException(`Bank transaction with ID ${id} not found`);
    }

    return transaction;
  }

  /**
   * Import bank transactions in bulk with idempotency support
   */
  async import(
    tenantId: string,
    importDto: ImportBankTransactionsDto,
    idempotencyKey?: string,
  ): Promise<ImportResponseDto> {
    // Check idempotency if key provided
    if (idempotencyKey) {
      const idempotencyResult = await this.idempotencyService.checkIdempotency(
        idempotencyKey,
        tenantId,
        importDto,
      );

      if (!idempotencyResult.isNew) {
        this.logger.log(
          `Returning cached response for idempotency key: ${idempotencyKey}`,
        );
        if (!idempotencyResult.cachedResponse) {
          throw new Error(
            'Cached response is missing for the given idempotency key.',
          );
        }
        return idempotencyResult.cachedResponse.body as ImportResponseDto;
      }
    }

    const result = await this.processImport(tenantId, importDto);

    // Store idempotency result if key provided
    if (idempotencyKey) {
      await this.idempotencyService.storeIdempotency(
        idempotencyKey,
        tenantId,
        importDto,
        200,
        result,
      );
    }

    return result;
  }

  /**
   * Process the actual import logic
   */
  private async processImport(
    tenantId: string,
    importDto: ImportBankTransactionsDto,
  ): Promise<ImportResponseDto> {
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    // Use transaction for atomicity
    await this.databaseService.transaction(async (tx) => {
      for (const transactionDto of importDto.transactions) {
        try {
          // Check if external_id already exists (if provided)
          if (transactionDto.externalId) {
            const [existing] = await tx
              .select()
              .from(bankTransactions)
              .where(
                and(
                  eq(bankTransactions.tenantId, tenantId),
                  eq(bankTransactions.externalId, transactionDto.externalId),
                ),
              )
              .limit(1);

            if (existing) {
              duplicates++;
              this.logger.debug(
                `Skipping duplicate transaction: ${transactionDto.externalId}`,
              );
              continue;
            }
          }

          // Insert transaction
          await tx.insert(bankTransactions).values({
            tenantId,
            externalId: transactionDto.externalId,
            postedAt: new Date(transactionDto.postedAt),
            amount: transactionDto.amount.toString(),
            currency: transactionDto.currency || 'USD',
            description: transactionDto.description,
          });

          imported++;
        } catch (error) {
          errors++;
          const errorMsg = `Failed to import transaction: ${error.message}`;
          errorMessages.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }
    });

    this.logger.log(
      `Import completed - Imported: ${imported}, Duplicates: ${duplicates}, Errors: ${errors}`,
    );

    return {
      imported,
      duplicates,
      errors,
      errorMessages,
    };
  }

  async remove(tenantId: string, id: string) {
    // Verify transaction exists and belongs to tenant
    await this.findOne(tenantId, id);

    await this.databaseService.db
      .delete(bankTransactions)
      .where(
        and(
          eq(bankTransactions.id, id),
          eq(bankTransactions.tenantId, tenantId),
        ),
      );

    return { message: `Bank transaction ${id} deleted successfully` };
  }
}
