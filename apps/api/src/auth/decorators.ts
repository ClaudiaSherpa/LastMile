import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role, JwtPayload } from '@sherpa/shared';

export const ROLES_KEY = 'roles';
/** Restrict a route to one or more roles. RBAC is enforced by the global RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PUBLIC_KEY = 'isPublic';
/** Mark a route as not requiring authentication. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Inject the authenticated user (JwtPayload) into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
