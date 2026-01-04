import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Super Admin Guard
 *
 * Restricts access to super admin users only
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.isSuperAdmin) {
      throw new ForbiddenException(
        'This action requires super admin privileges',
      );
    }

    return true;
  }
}
