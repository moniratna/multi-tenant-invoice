import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DatabaseService } from '../../database/database.service';

/**
 * RLS Context Interceptor
 *
 * Automatically sets PostgreSQL session variables for Row Level Security
 * before each request and clears them after the request completes.
 *
 * Context variables set:
 * - app.current_user_id: ID of the authenticated user
 * - app.current_org_id: ID of the tenant/organization
 * - app.is_super_admin: Whether the user is a super admin
 */
@Injectable()
export class RlsContextInterceptor implements NestInterceptor {
  constructor(private readonly databaseService: DatabaseService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Extract context from request
    // These would typically come from JWT token or session
    const userId = request.user?.id || request.user?.sub;
    const tenantId = this.extractTenantId(request);
    const isSuperAdmin = request.user?.isSuperAdmin || false;

    // Set RLS context variables
    await this.databaseService.setContext(userId, tenantId, isSuperAdmin);

    // Continue with request and clear context after completion
    return next.handle().pipe(
      tap({
        finalize: async () => {
          // Clear context after request completes
          try {
            await this.databaseService.clearContext();
          } catch (error) {
            // Log but don't throw - cleanup errors shouldn't affect response
            console.error('Failed to clear RLS context:', error);
          }
        },
      }),
    );
  }

  /**
   * Extract tenant ID from request
   * Priority: URL param > header > user context
   */
  private extractTenantId(request: any): string | undefined {
    // 1. Check URL parameters (e.g., /tenants/:tenant_id/invoices)
    if (request.params?.tenant_id) {
      return request.params.tenant_id;
    }

    if (request.params?.tenantId) {
      return request.params.tenantId;
    }

    // 2. Check custom header
    if (request.headers['x-tenant-id']) {
      return request.headers['x-tenant-id'];
    }

    // 3. Check authenticated user's tenant
    if (request.user?.tenantId) {
      return request.user.tenantId;
    }

    return undefined;
  }
}
