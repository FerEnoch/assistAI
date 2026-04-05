import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { GlobalExceptionFilter } from '../global-exception.filter';
import { getErrorMessage, mapToErrorCode, ErrorCode } from '../../errors';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockReply: ReturnType<typeof vi.fn>;
  let mockHost: ArgumentsHost;
  let mockRequest: Record<string, unknown>;

  beforeEach(() => {
    mockReply = vi.fn();
    mockRequest = { method: 'GET', url: '/test' };

    const mockHttpAdapterHost = {
      httpAdapter: {
        reply: mockReply,
        getRequestUrl: vi.fn().mockReturnValue('/test'),
      },
    } as unknown as HttpAdapterHost;

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({}),
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    filter = new GlobalExceptionFilter(mockHttpAdapterHost);
  });

  it('preserves HttpException status code', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    const [, responseBody, status] = mockReply.mock.calls[0];
    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(responseBody.error.statusCode).toBe(HttpStatus.NOT_FOUND);
  });

  it('returns 500 for unknown non-HttpException errors', () => {
    const exception = new Error('totally unexpected failure');

    filter.catch(exception, mockHost);

    const [, responseBody, status] = mockReply.mock.calls[0];
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseBody.error.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseBody.error.message).toBe(getErrorMessage(ErrorCode.GENERIC_ERROR));
  });

  it('maps ETIMEDOUT to INFRA_TIMEOUT message (Scenario 6)', () => {
    const exception = new Error('ETIMEDOUT: connection timed out');

    filter.catch(exception, mockHost);

    const [, responseBody, status] = mockReply.mock.calls[0];
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseBody.error.message).toBe(
      getErrorMessage(ErrorCode.INFRA_TIMEOUT),
    );
  });

  it('maps connection refused to INFRA_CONNECTION_REFUSED message', () => {
    const exception = new Error('ECONNREFUSED: connect to 127.0.0.1:6379 failed');

    filter.catch(exception, mockHost);

    const [, responseBody] = mockReply.mock.calls[0];
    expect(responseBody.error.message).toBe(
      getErrorMessage(ErrorCode.INFRA_CONNECTION_REFUSED),
    );
  });

  it('returns { error: { message, statusCode } } response shape (REQ-8)', () => {
    const exception = new Error('some random error');

    filter.catch(exception, mockHost);

    const [, responseBody] = mockReply.mock.calls[0];
    expect(responseBody).toHaveProperty('error');
    expect(responseBody.error).toHaveProperty('message');
    expect(responseBody.error).toHaveProperty('statusCode');
    expect(typeof responseBody.error.message).toBe('string');
    expect(typeof responseBody.error.statusCode).toBe('number');
  });
});
