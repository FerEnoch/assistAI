import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { magicLinkRequestSchema, verifyTokenSchema } from './auth.dto';
import { AuthThrottlerGuard } from '../security/throttler.guards';

@Controller('auth')
@SkipThrottle() // Skip global throttle — use specific guards per endpoint
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/dev-login
   * Dev mode: create user + session without email verification.
   * Only works when DEV_AUTH_BYPASS=true and NODE_ENV=development.
   */
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) _res: Response,
  ): Promise<{ user: { id: string; email: string; locale: string }; workspace: { id: string; name: string } }> {
    const parsed = magicLinkRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    }

    const { user, workspace } = await this.authService.devLogin(parsed.data.email);

    // Regenerate session to prevent fixation attacks
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    // Populate session data
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.workspaceId = workspace.id;
    req.session.authenticatedAt = Date.now();

    // Save session explicitly
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        locale: user.locale,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
    };
  }

  /**
   * POST /auth/magic-link
   * Send a magic link email for passwordless login.
   * Always returns 202 to prevent email enumeration.
   *
   * Rate limited: 5 req/15min per IP (A-095).
   */
  @Post('magic-link')
  @UseGuards(AuthThrottlerGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async sendMagicLink(@Body() body: unknown): Promise<{ message: string }> {
    const parsed = magicLinkRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    }

    // Fire-and-forget to prevent timing-based email enumeration
    this.authService.sendMagicLink(parsed.data.email).catch((err) => {
      // Log but don't expose to caller
      console.error('Failed to send magic link:', err);
    });

    return { message: 'If this email is registered or valid, you will receive a login link.' };
  }

  /**
   * GET /auth/verify?token=xxx
   * Verify a magic-link JWT token.
   * Creates a server-side session and sets the session cookie.
   *
   * Security note: This endpoint is intentionally exempt from CSRF protection.
   * It's a GET request (safe method), uses a single-use JWT token with 15min expiry,
   * and regenerates the session ID to prevent fixation attacks.
   * The token itself acts as the authentication proof — no session exists yet.
   */
  @Get('verify')
  async verifyToken(
    @Query() query: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) _res: Response,
  ): Promise<{ user: { id: string; email: string; locale: string }; workspace: { id: string; name: string } }> {
    const parsed = verifyTokenSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException('Token is required');
    }

    const { user, workspace } = await this.authService.verifyMagicLink(parsed.data.token);

    // Regenerate session to prevent fixation attacks
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

    // Populate session data
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.workspaceId = workspace.id;
    req.session.authenticatedAt = Date.now();

    // Save session explicitly
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        locale: user.locale,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
    };
  }

  /**
   * DELETE /auth/session
   * Destroy the current session and clear the cookie.
   */
  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  async destroySession(@Req() req: Request): Promise<void> {
    if (!req.session?.userId) {
      throw new UnauthorizedException('No active session');
    }

    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
  }

  /**
   * GET /auth/csrf-token
   * Return a CSRF token for the current session.
   * Client must send this in x-csrf-token header on state-changing requests.
   */
  @Get('csrf-token')
  getCsrfToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): { token: string } {
    const generateToken = (req.app.get('csrfGenerateToken') as (req: Request, res: Response) => string);
    const token = generateToken(req, res);
    // const token = req.app.get('csrfGenerateToken');
    return { token };
  }
}
