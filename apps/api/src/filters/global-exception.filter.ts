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

/**
 * User-friendly error messages for common technical errors.
 * These are shown to users in production.
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Redis errors
  ECONNREFUSED: 'El servicio temporalmente no está disponible. Intenta de nuevo en unos minutos.',
  ETIMEDOUT: 'La conexión tardó demasiado. Verifica tu conexión a internet.',
  ENOTFOUND: 'No se pudo conectar al servidor. Intenta de nuevo.',
  'ERR syntax error': 'Error de configuración del servidor. Contacta soporte.',

  // Database errors
  'connection refused': 'Error de base de datos. Intenta más tarde.',
  'duplicate key': 'Ya existe un registro con esos datos.',
  'null value': 'Falta información requerida. Completa todos los campos.',

  // Validation errors
  'invalid credentials': 'Credenciales incorrectas. Verifica tu email y contraseña.',
  unauthorized: 'Sesión expirada o inválida. Inicia sesión nuevamente.',
  forbidden: 'No tienes permiso para realizar esta acción.',

  // Generic fallbacks
  'internal server error': 'Algo salió mal. Intenta de nuevo.',
};

/**
 * Maps technical error messages to user-friendly messages.
 */
function getUserMessage(error: unknown, isProduction: boolean): string {
  if (!isProduction) {
    // In development, return the actual error for debugging
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // In production, map to user-friendly message
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for exact matches first
    for (const [key, userMsg] of Object.entries(ERROR_MESSAGES)) {
      if (message.includes(key.toLowerCase())) {
        return userMsg;
      }
    }

    // Check for partial matches
    if (message.includes('redis')) {
      return 'Error de conexión con el servidor. Intenta más tarde.';
    }
    if (message.includes('database') || message.includes('postgres')) {
      return 'Error de base de datos. Intenta más tarde.';
    }
  }

  return 'Algo salió mal. Intenta de nuevo.';
}

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
    let httpStatus: number;
    let errorMessage: string;
    let errorCode: string | undefined;

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle custom error responses from NestJS
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        errorMessage = (resp.message as string) || exception.message;
        errorCode = resp.error as string | undefined;
      } else {
        errorMessage = exception.message;
      }
    } else {
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = 'Internal server error';
    }

    // Get user-friendly message
    const userMessage = getUserMessage(exception, process.env.NODE_ENV !== 'production');

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
          code: errorCode,
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
