import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Guard that requires an active session with a userId.
 * Apply to any route that requires authentication.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (!req.session?.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return true;
  }
}
