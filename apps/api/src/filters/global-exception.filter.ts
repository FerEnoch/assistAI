import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';
import { mapToErrorCode, getErrorMessage } from '../errors';

/**
 * Global exception filter that catches all unhandled errors
 * and returns user-friendly messages.
 *
 * In development: shows full error details for debugging
 * In production: shows sanitized messages, logs full error server-side
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine HTTP status
    const httpStatus = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Resolve user-friendly message from centralized taxonomy
    const error = exception instanceof Error ? exception : new Error(String(exception));
    const userMessage = getErrorMessage(mapToErrorCode(error.message));

    // Log full error server-side
    if (exception instanceof Error) {
      this.logger.error(
        `[${request.method} ${request.url}] ${exception.message}`,
        exception.stack,
      );
    }

    // Build response
    const responseBody = {
      error: {
        message: userMessage,
        statusCode: httpStatus,
        ...(process.env.NODE_ENV !== 'production' && {
          // Include debug info only in development
          details: exception instanceof Error ? exception.message : undefined,
          path: httpAdapter.getRequestUrl(request),
          timestamp: new Date().toISOString(),
        }),
      },
    };

    // Send response
    httpAdapter.reply(response, responseBody, httpStatus);
  }
}
