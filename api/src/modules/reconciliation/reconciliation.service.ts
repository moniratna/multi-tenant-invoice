import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { invoices, bankTransactions, vendors } from '../../database/schema';
import { MatchService } from '../match/match.service';
import { PythonBackendClient } from '../../common/clients/python-backend.client';
import { ReconciliationRequestDto } from './dto/reconciliation-request.dto';
import { ReconciliationResponseDto } from './dto/reconciliation-response.dto';
import { MatchResponseDto, MatchStatus } from '../match/dto/match-response.dto';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly matchService: MatchService,
    private readonly pythonBackend: PythonBackendClient,
  ) {}

  /**
   * Run reconciliation process for a tenant
   *
   * Process:
   * 1. Fetch open invoices and unmatched transactions
   * 2. Send to Python backend for scoring
   * 3. Store top N matches as proposed candidates
   * 4. Return match candidates
   */
  async reconcile(
    tenantId: string,
    requestDto: ReconciliationRequestDto = {},
  ): Promise<ReconciliationResponseDto> {
    const startTime = Date.now();
    const topN = requestDto.topN || 5;

    this.logger.log(`Starting reconciliation for tenant ${tenantId}`);

    // 1. Fetch invoices
    const invoiceConditions = [
      eq(invoices.tenantId, tenantId),
      eq(invoices.status, 'open'),
    ];

    if (requestDto.invoiceIds && requestDto.invoiceIds.length > 0) {
      invoiceConditions.push(inArray(invoices.id, requestDto.invoiceIds));
    }

    const invoiceRecords = await this.databaseService.db
      .select({
        id: invoices.id,
        amount: invoices.amount,
        currency: invoices.currency,
        invoiceDate: invoices.invoiceDate,
        description: invoices.description,
        invoiceNumber: invoices.invoiceNumber,
        vendorId: invoices.vendorId,
      })
      .from(invoices)
      .where(and(...invoiceConditions));

    if (invoiceRecords.length === 0) {
      this.logger.warn('No open invoices found for reconciliation');
      return {
        matches: [],
        totalCandidates: 0,
        invoicesProcessed: 0,
        transactionsProcessed: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 2. Fetch bank transactions
    const transactionConditions = [eq(bankTransactions.tenantId, tenantId)];

    if (requestDto.transactionIds && requestDto.transactionIds.length > 0) {
      transactionConditions.push(
        inArray(bankTransactions.id, requestDto.transactionIds),
      );
    }

    const transactionRecords = await this.databaseService.db
      .select()
      .from(bankTransactions)
      .where(and(...transactionConditions));

    if (transactionRecords.length === 0) {
      this.logger.warn('No transactions found for reconciliation');
      return {
        matches: [],
        totalCandidates: 0,
        invoicesProcessed: invoiceRecords.length,
        transactionsProcessed: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 3. Fetch vendor names for invoices that have vendors
    const vendorIds = invoiceRecords
      .map((inv) => inv.vendorId)
      .filter((id): id is string => id !== null && id !== undefined);

    const vendorMap = new Map<string, string>();

    if (vendorIds.length > 0) {
      const vendorRecords = await this.databaseService.db
        .select()
        .from(vendors)
        .where(inArray(vendors.id, vendorIds));

      vendorRecords.forEach((vendor) => {
        vendorMap.set(vendor.id, vendor.name);
      });
    }

    // 4. Prepare data for Python backend
    const invoicesInput = invoiceRecords.map((inv) => ({
      id: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      invoiceDate: inv.invoiceDate?.toISOString(),
      description: inv.description ?? undefined,
      invoiceNumber: inv.invoiceNumber ?? undefined,
      vendorName: inv.vendorId ? vendorMap.get(inv.vendorId) : undefined,
    }));

    const transactionsInput = transactionRecords.map((txn) => ({
      id: txn.id,
      amount: txn.amount,
      currency: txn.currency,
      postedAt: txn.postedAt.toISOString(),
      description: txn.description ?? undefined,
    }));

    this.logger.debug(
      `Sending ${invoicesInput.length} invoices and ${transactionsInput.length} transactions to Python backend`,
    );

    // 5. Call Python backend for scoring
    let scoringResult;
    try {
      scoringResult = await this.pythonBackend.scoreCandidates(
        tenantId,
        invoicesInput,
        transactionsInput,
        topN,
      );
    } catch (error) {
      this.logger.error('Failed to call Python backend:', error);
      throw new BadRequestException(
        'Reconciliation service temporarily unavailable',
      );
    }

    this.logger.debug(
      `Python backend returned ${scoringResult.candidates.length} candidates in ${scoringResult.processingTimeMs}ms`,
    );

    // 6. Store match candidates in database
    const storedMatches: Awaited<
      ReturnType<typeof this.matchService.create>
    >[] = [];

    for (const candidate of scoringResult.candidates) {
      try {
        const match = await this.matchService.create(
          tenantId,
          candidate.invoiceId,
          candidate.transactionId,
          candidate.score,
          typeof candidate.explanation === 'string'
            ? candidate.explanation
            : null,
        );
        storedMatches.push(match);
      } catch (error: any) {
        this.logger.error(
          `Failed to store match candidate: ${error && error.message ? error.message : error}`,
        );
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.log(
      `Reconciliation complete: ${storedMatches.length} matches created in ${processingTime}ms`,
    );

    // Map stored matches to DTO format
    const matchesDto: MatchResponseDto[] = storedMatches.map((match) => ({
      id: match.id,
      tenantId: match.tenantId,
      invoiceId: match.invoiceId,
      bankTransactionId: match.bankTransactionId,
      score: match.score,
      status: match.status as MatchStatus,
      explanation: match.explanation ?? '',
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      confirmedAt: match.confirmedAt ?? undefined,
      confirmedBy: match.confirmedBy ?? undefined,
    }));

    return {
      matches: matchesDto,
      totalCandidates: scoringResult.candidates.length,
      invoicesProcessed: invoiceRecords.length,
      transactionsProcessed: transactionRecords.length,
      processingTimeMs: processingTime,
      pythonScoringTimeMs: scoringResult.processingTimeMs,
    };
  }

  /**
   * Get explanation for a specific invoice-transaction pair
   * This can be used even if a match doesn't exist yet
   */
  async explainMatch(
    tenantId: string,
    invoiceId: string,
    transactionId: string,
  ): Promise<{ explanation: string; score: number }> {
    // Fetch invoice
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    // Fetch transaction
    const [transaction] = await this.databaseService.db
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.id, transactionId),
          eq(bankTransactions.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    // Get vendor name if exists
    let vendorName: string | undefined;
    if (invoice.vendorId) {
      const [vendor] = await this.databaseService.db
        .select()
        .from(vendors)
        .where(eq(vendors.id, invoice.vendorId))
        .limit(1);
      vendorName = vendor?.name;
    }

    // Call Python backend with just this pair
    try {
      const result = await this.pythonBackend.scoreCandidates(
        tenantId,
        [
          {
            id: invoice.id,
            amount: invoice.amount,
            currency: invoice.currency,
            invoiceDate: invoice.invoiceDate?.toISOString(),
            description: invoice.description ?? undefined,
            invoiceNumber: invoice.invoiceNumber ?? undefined,
            vendorName,
          },
        ],
        [
          {
            id: transaction.id,
            amount: transaction.amount,
            currency: transaction.currency,
            postedAt: transaction.postedAt.toISOString(),
            description: transaction.description ?? undefined,
          },
        ],
        1,
      );

      if (result.candidates.length > 0) {
        const candidate = result.candidates[0];
        return {
          explanation: candidate.explanation,
          score: candidate.score,
        };
      }

      return {
        explanation: 'No match found - currencies may differ',
        score: 0,
      };
    } catch (error) {
      this.logger.error(
        'Failed to get explanation from Python backend:',
        error,
      );

      // Fallback deterministic explanation
      return this.generateFallbackExplanation(invoice, transaction);
    }
  }

  /**
   * Generate fallback explanation when Python backend is unavailable
   */
  private generateFallbackExplanation(
    invoice: any,
    transaction: any,
  ): { explanation: string; score: number } {
    const parts: string[] = [];
    let score = 0;

    // Amount comparison
    const invAmount = parseFloat(invoice.amount);
    const txnAmount = parseFloat(transaction.amount);

    if (invAmount === txnAmount) {
      parts.push('✓ Exact amount match');
      score += 40;
    } else {
      const diff = Math.abs(invAmount - txnAmount);
      const percentDiff = (diff / invAmount) * 100;
      parts.push(`✗ Amount differs by ${percentDiff.toFixed(1)}%`);
      score += Math.max(0, 40 - percentDiff * 2);
    }

    // Currency check
    if (invoice.currency !== transaction.currency) {
      parts.push('✗ Different currencies');
    } else {
      parts.push('✓ Same currency');
      score += 10;
    }

    // Date comparison
    if (invoice.invoiceDate) {
      const daysDiff = Math.abs(
        (invoice.invoiceDate.getTime() - transaction.postedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysDiff <= 3) {
        parts.push(`✓ Within ${Math.round(daysDiff)} days`);
        score += 30;
      } else {
        parts.push(`✗ ${Math.round(daysDiff)} days apart`);
        score += Math.max(0, 30 - daysDiff);
      }
    } else {
      parts.push('? Invoice date not available');
      score += 15;
    }

    // Text similarity (basic check)
    if (
      invoice.invoiceNumber &&
      transaction.description?.includes(invoice.invoiceNumber)
    ) {
      parts.push('✓ Invoice number found in description');
      score += 20;
    } else if (
      invoice.description &&
      transaction.description &&
      transaction.description
        .toLowerCase()
        .includes(invoice.description.toLowerCase().split(' ')[0])
    ) {
      parts.push('~ Partial text match');
      score += 10;
    } else {
      parts.push('✗ No text similarity');
    }

    return {
      explanation: parts.join(' | '),
      score: Math.min(100, Math.round(score)),
    };
  }
}
