import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Tenant Access Guard
 *
 * Ensures users can only access resources within their own tenant
 * Super admins can access any tenant
 */
@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    console.log('user', user);
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super admins can access any tenant
    if (user.isSuperAdmin) {
      return true;
    }

    // Extract tenant ID from request
    const requestedTenantId =
      request.params?.tenant_id ||
      request.params?.tenantId ||
      request.headers['x-tenant-id'];
    console.log('requestedTenantId', requestedTenantId);
    console.log('user.tenantId', user.tenantId);
    // If no tenant ID in request, allow (might be a non-tenant-scoped endpoint)
    if (!requestedTenantId) {
      return true;
    }

    // Verify user belongs to the requested tenant
    if (user.tenantId !== requestedTenantId) {
      throw new ForbiddenException(
        "You do not have access to this tenant's resources",
      );
    }

    return true;
  }
}
