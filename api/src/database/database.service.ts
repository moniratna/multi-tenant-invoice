import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { DATABASE_CONNECTION } from './database.module';

@Injectable()
export class DatabaseService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    public readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Execute a transaction with automatic rollback on error
   */
  async transaction<T>(
    callback: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(callback);
  }

  /**
   * Set context variables for RLS (Row Level Security)
   * Call this at the beginning of each request
   */
  async setContext(
    userId?: string,
    orgId?: string,
    isSuperAdmin: boolean = false,
  ) {
    await this.db.execute(`
      SELECT 
        set_config('app.current_user_id', '${userId || ''}', false),
        set_config('app.current_org_id', '${orgId || ''}', false),
        set_config('app.is_super_admin', '${isSuperAdmin ? '1' : '0'}', false)
    `);
  }

  /**
   * Clear context variables
   */
  async clearContext() {
    await this.db.execute(`
      SELECT 
        set_config('app.current_user_id', '', false),
        set_config('app.current_org_id', '', false),
        set_config('app.is_super_admin', '0', false)
    `);
  }
}
