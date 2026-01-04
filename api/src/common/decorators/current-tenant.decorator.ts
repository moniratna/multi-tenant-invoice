import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // Priority: URL param > header > user context
    return (
      request.params?.tenant_id ||
      request.params?.tenantId ||
      request.headers['x-tenant-id'] ||
      request.user?.tenantId
    );
  },
);
