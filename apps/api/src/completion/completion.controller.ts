import {
  Controller,
  Post,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SessionGuard } from '../auth/guards';
import { CompletionThrottlerGuard } from '../security/throttler.guards';
import { CompletionService } from './completion.service';
import type { CompletionRequestPayload } from '@assistai/shared';

function getWorkspaceId(req: Request): string {
  const wsId = req.session?.workspaceId;
  if (!wsId) throw new BadRequestException('No workspace in session');
  return wsId;
}

function getUserId(req: Request): string {
  const userId = req.session?.userId;
  if (!userId) throw new BadRequestException('Not authenticated');
  return userId;
}

/**
 * Completion controller — SSE streaming endpoint for inline completions (A-070).
 *
 * Uses POST + manual SSE headers (not @Sse()) because the client sends a JSON body
 * with prefix/sessionId/cursorPosition. Native EventSource only supports GET,
 * so the client uses fetch + ReadableStream to consume the SSE stream.
 *
 * Events emitted:
 * - type: 'meta'  — retrieval metadata (chunkCount, latency, isGrounded)
 * - type: 'token' — individual completion tokens
 * - type: 'done'  — stream complete with final metrics + evidence hits
 * - type: 'error' — error during generation
 *
 * Rate limited: 60 req/min + 1000/day per user (A-095).
 */
@Controller('completions')
@SkipThrottle() // Skip global throttle — use specific guard per endpoint
export class CompletionController {
  constructor(private readonly completionService: CompletionService) {}

  /**
   * POST /completions/stream
   * Stream a completion response via SSE over POST.
   *
   * We manually set SSE headers and pipe the Observable to the response
   * because @Sse() is designed for GET endpoints only.
   *
   * Rate limited: 60/min + 1000/day per user (A-095).
   */
  @Post('stream')
  @UseGuards(SessionGuard, CompletionThrottlerGuard)
  streamCompletion(
    @Body() body: CompletionRequestPayload,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    const wsId = getWorkspaceId(req);
    const userId = getUserId(req);

    if (!body.prefix || typeof body.prefix !== 'string') {
      throw new BadRequestException('prefix is required and must be a string');
    }

    if (!body.sessionId || typeof body.sessionId !== 'string') {
      throw new BadRequestException('sessionId is required');
    }

    // Set SSE headers manually
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // AbortController for cancellation on client disconnect (REQ-3)
    const abort = new AbortController();

    // Heartbeat to keep connection alive through proxies (REQ-1)
    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, 15_000);

    const observable = this.completionService.streamCompletion(
      wsId,
      userId,
      body,
      abort.signal,
    );

    const subscription = observable.subscribe({
      next(event) {
        if (!res.writableEnded) {
          const eventType = event.type ?? 'message';
          res.write(`event: ${eventType}\ndata: ${event.data}\n\n`);
        }
      },
      error(err) {
        clearInterval(heartbeatInterval);
        if (!res.writableEnded) {
          const message = err instanceof Error ? err.message : String(err);
          res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
          res.end();
        }
      },
      complete() {
        clearInterval(heartbeatInterval);
        if (!res.writableEnded) res.end();
      },
    });

    // Clean up if client disconnects (REQ-2, REQ-3)
    req.on('close', () => {
      abort.abort();
      clearInterval(heartbeatInterval);
      subscription.unsubscribe();
    });
  }

  /**
   * POST /completions/:id/feedback
   * Record whether the user accepted or dismissed a completion.
   */
  @Post(':id/feedback')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordFeedback(
    @Param('id') id: string,
    @Body() body: { accepted: boolean },
    @Req() req: Request,
  ): Promise<void> {
    const wsId = getWorkspaceId(req);

    if (typeof body.accepted !== 'boolean') {
      throw new BadRequestException('accepted must be a boolean');
    }

    await this.completionService.recordFeedback(id, wsId, body.accepted);
  }

  /**
   * POST /completions/session
   * Create or refresh an editor session (A-061).
   */
  @Post('session')
  @UseGuards(SessionGuard)
  async createSession(
    @Body() body: { sessionId?: string },
    @Req() req: Request,
  ) {
    const wsId = getWorkspaceId(req);
    const userId = getUserId(req);

    const session = await this.completionService.ensureSession(
      wsId,
      userId,
      body.sessionId,
    );

    return { sessionId: session.id };
  }
}
