import { Injectable, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, gt, sql, lt } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { idempotencyKeys } from '../../database/schema';
import * as crypto from 'crypto';

export interface IdempotencyResult {
  isNew: boolean;
  cachedResponse?: {
    status: number;
    body: any;
  };
}

@Injectable()
export class IdempotencyService {
  private readonly ttlHours: number;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.ttlHours = this.configService.get<number>('idempotency.ttlHours', 24);
  }

  /**
   * Generate SHA-256 hash of the request payload
   */
  private hashPayload(payload: any): string {
    const payloadString = JSON.stringify(payload);
    return crypto.createHash('sha256').update(payloadString).digest('hex');
  }

  /**
   * Check if idempotency key exists and validate payload
   * Returns cached response if key exists, or marks as new request
   */
  async checkIdempotency(
    key: string,
    tenantId: string,
    payload: any,
  ): Promise<IdempotencyResult> {
    const requestHash = this.hashPayload(payload);

    // Check if key exists and is not expired
    const [existing] = await this.databaseService.db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.key, key),
          eq(idempotencyKeys.tenantId, tenantId),
          gt(idempotencyKeys.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!existing) {
      // Key doesn't exist or is expired - this is a new request
      return { isNew: true };
    }

    // Key exists - check if payload matches
    if (existing.requestHash !== requestHash) {
      throw new ConflictException(
        'Idempotency key used with different payload',
      );
    }

    // Key exists with same payload - return cached response
    return {
      isNew: false,
      cachedResponse:
        existing.responseStatus !== null
          ? {
              status: existing.responseStatus as number,
              body: existing.responseBody
                ? JSON.parse(existing.responseBody)
                : null,
            }
          : undefined,
    };
  }
  /**
   * Store idempotency key with response
   */
  async storeIdempotency(
    key: string,
    tenantId: string,
    payload: any,
    responseStatus: number,
    responseBody: any,
  ): Promise<void> {
    const requestHash = this.hashPayload(payload);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.ttlHours);

    try {
      await this.databaseService.db.insert(idempotencyKeys).values({
        key,
        tenantId,
        requestHash,
        responseStatus,
        responseBody: JSON.stringify(responseBody),
        expiresAt,
      });
    } catch (error) {
      // If insert fails due to duplicate key, it means another request
      // completed first - this is acceptable in a race condition
      if (error.code !== '23505') {
        throw error;
      }
    }
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.databaseService.db
      .delete(idempotencyKeys)
      .where(
        lt(
          idempotencyKeys.expiresAt,
          sql`CURRENT_TIMESTAMP` as unknown as Date,
        ),
      );

    return result.rowCount || 0;
  }
}
