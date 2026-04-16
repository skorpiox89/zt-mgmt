import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (request.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('仅管理员可执行该操作');
    }

    return true;
  }
}
