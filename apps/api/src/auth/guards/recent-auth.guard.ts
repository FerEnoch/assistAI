import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';

/** 15 minutes in milliseconds */
const RECENT_AUTH_WINDOW_MS = 15 * 60 * 1000;

/**
 * Guard that requires the user to have authenticated within the last 15 minutes.
 * Used for sensitive actions like credential updates, account deletion, etc.
 *
 * Returns 403 with code RECENT_AUTH_REQUIRED and redirectTo /auth/reconfirm
 * when the authentication is stale.
 *
 * Prerequisites: Must be used AFTER SessionGuard — requires an active session.
 */
@Injectable()
export class RecentAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (!req.session?.userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'RECENT_AUTH_REQUIRED',
        message: 'Authentication required',
        redirectTo: '/auth/reconfirm',
      });
    }

    const authenticatedAt = req.session.authenticatedAt;
    if (!authenticatedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'RECENT_AUTH_REQUIRED',
        message: 'Recent authentication is required for this action',
        redirectTo: '/auth/reconfirm',
      });
    }

    const elapsed = Date.now() - authenticatedAt;
    if (elapsed > RECENT_AUTH_WINDOW_MS) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'RECENT_AUTH_REQUIRED',
        message: 'Recent authentication is required for this action',
        redirectTo: '/auth/reconfirm',
      });
    }

    return true;
  }
}
