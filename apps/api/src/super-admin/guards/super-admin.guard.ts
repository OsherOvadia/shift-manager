import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user has SUPER_ADMIN role
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }

    return true;
  }
}
