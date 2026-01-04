import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { matches, invoices } from '../../database/schema';
import { ConfirmMatchDto } from './dto/confirm-match.dto';
import { RejectMatchDto } from './dto/reject-match.dto';
import { FilterMatchDto } from './dto/filter-match.dto';

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create a match candidate (proposed match)
   */
  async create(
    tenantId: string,
    invoiceId: string,
    bankTransactionId: string,
    score: number,
    explanation: string,
  ) {
    // Check if match already exists
    const [existing] = await this.databaseService.db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.tenantId, tenantId),
          eq(matches.invoiceId, invoiceId),
          eq(matches.bankTransactionId, bankTransactionId),
        ),
      )
      .limit(1);

    if (existing) {
      // Update existing match with new score
      const [updated] = await this.databaseService.db
        .update(matches)
        .set({
          score: score.toString(),
          explanation,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, existing.id))
        .returning();

      this.logger.debug(`Updated existing match: ${updated.id}`);
      return updated;
    }

    // Create new match
    const [match] = await this.databaseService.db
      .insert(matches)
      .values({
        tenantId,
        invoiceId,
        bankTransactionId,
        score: score.toString(),
        status: 'proposed',
        explanation,
      })
      .returning();

    this.logger.debug(`Created new match: ${match.id}`);
    return match;
  }

  /**
   * Find all matches for a tenant with optional filters
   */
  async findAll(tenantId: string, filters?: FilterMatchDto) {
    const conditions = [eq(matches.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(matches.status, filters.status));
    }

    if (filters?.invoiceId) {
      conditions.push(eq(matches.invoiceId, filters.invoiceId));
    }

    if (filters?.bankTransactionId) {
      conditions.push(eq(matches.bankTransactionId, filters.bankTransactionId));
    }

    return this.databaseService.db
      .select()
      .from(matches)
      .where(and(...conditions));
  }

  /**
   * Find a specific match by ID
   */
  async findOne(tenantId: string, id: string) {
    const [match] = await this.databaseService.db
      .select()
      .from(matches)
      .where(and(eq(matches.id, id), eq(matches.tenantId, tenantId)))
      .limit(1);

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    return match;
  }

  /**
   * Confirm a match (finalize it)
   * Updates invoice status to 'matched'
   */
  async confirm(
    tenantId: string,
    matchId: string,
    confirmDto: ConfirmMatchDto,
  ) {
    // Use transaction to ensure atomicity
    return this.databaseService.transaction(async (tx) => {
      // Get the match
      const [match] = await tx
        .select()
        .from(matches)
        .where(and(eq(matches.id, matchId), eq(matches.tenantId, tenantId)))
        .limit(1);

      if (!match) {
        throw new NotFoundException(`Match with ID ${matchId} not found`);
      }

      // Check if already confirmed
      if (match.status === 'confirmed') {
        throw new ConflictException('Match is already confirmed');
      }

      // Update match status
      const [updatedMatch] = await tx
        .update(matches)
        .set({
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: confirmDto.confirmedBy || 'system',
          updatedAt: new Date(),
        })
        .where(eq(matches.id, matchId))
        .returning();

      // Update invoice status to 'matched'
      await tx
        .update(invoices)
        .set({
          status: 'matched',
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, match.invoiceId));

      this.logger.log(
        `Match ${matchId} confirmed by ${confirmDto.confirmedBy || 'system'}`,
      );

      return updatedMatch;
    });
  }

  /**
   * Reject a match
   */
  async reject(tenantId: string, matchId: string, rejectDto: RejectMatchDto) {
    const match = await this.findOne(tenantId, matchId);

    if (match.status === 'confirmed') {
      throw new ConflictException('Cannot reject a confirmed match');
    }

    const [updated] = await this.databaseService.db
      .update(matches)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
        // Optionally store rejection reason in explanation
        explanation: rejectDto.reason
          ? `${match.explanation} | Rejected: ${rejectDto.reason}`
          : match.explanation,
      })
      .where(and(eq(matches.id, matchId), eq(matches.tenantId, tenantId)))
      .returning();

    this.logger.log(`Match ${matchId} rejected`);

    return updated;
  }

  /**
   * Delete a match
   */
  async remove(tenantId: string, matchId: string) {
    const match = await this.findOne(tenantId, matchId);

    if (match.status === 'confirmed') {
      throw new ConflictException('Cannot delete a confirmed match');
    }

    await this.databaseService.db
      .delete(matches)
      .where(and(eq(matches.id, matchId), eq(matches.tenantId, tenantId)));

    this.logger.log(`Match ${matchId} deleted`);

    return { message: `Match ${matchId} deleted successfully` };
  }

  /**
   * Get matches for a specific invoice
   */
  async getMatchesForInvoice(tenantId: string, invoiceId: string) {
    return this.databaseService.db
      .select()
      .from(matches)
      .where(
        and(eq(matches.tenantId, tenantId), eq(matches.invoiceId, invoiceId)),
      );
  }

  /**
   * Get matches for a specific transaction
   */
  async getMatchesForTransaction(tenantId: string, transactionId: string) {
    return this.databaseService.db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.tenantId, tenantId),
          eq(matches.bankTransactionId, transactionId),
        ),
      );
  }
}
