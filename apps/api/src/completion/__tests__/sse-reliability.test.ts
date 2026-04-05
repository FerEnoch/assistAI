import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { EventEmitter } from 'events';
import type { SseMessageEvent } from '../completion.service';

/**
 * SSE reliability tests — heartbeat and abort cleanup (REQ-1, REQ-2, REQ-3).
 *
 * Tests the controller-level SSE patterns:
 * - Heartbeat pings every 15s
 * - Cleanup on client disconnect (abort + clearInterval + unsubscribe)
 * - Cleanup on stream complete/error
 */

function createMockReq() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    session: { workspaceId: 'ws-1', userId: 'u-1' },
  }) as unknown as import('express').Request;
}

function createMockRes() {
  const written: string[] = [];
  return {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => { written.push(chunk); return true; }),
    end: vi.fn(),
    writableEnded: false,
    _written: written,
  } as unknown as import('express').Response & { _written: string[] };
}

describe('CompletionController SSE heartbeat (REQ-1, REQ-2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes a ping comment after 15 seconds (REQ-1)', async () => {
    // Arrange: mock service returns a never-completing observable
    const subject = new Subject<SseMessageEvent>();
    const mockService = {
      streamCompletion: vi.fn().mockReturnValue(subject.asObservable()),
    };

    const { CompletionController } = await import('../completion.controller');
    const controller = new CompletionController(mockService as any);

    const req = createMockReq();
    const res = createMockRes();

    // Act
    controller.streamCompletion(
      { prefix: 'some text', sessionId: 'sess-1' } as any,
      req,
      res,
    );

    // Advance 15s
    vi.advanceTimersByTime(15_000);

    // Assert
    const pingWrites = (res as any)._written.filter((w: string) => w === ': ping\n\n');
    expect(pingWrites).toHaveLength(1);
  });

  it('writes multiple pings at 15s intervals (REQ-1)', async () => {
    const subject = new Subject<SseMessageEvent>();
    const mockService = {
      streamCompletion: vi.fn().mockReturnValue(subject.asObservable()),
    };

    const { CompletionController } = await import('../completion.controller');
    const controller = new CompletionController(mockService as any);

    const req = createMockReq();
    const res = createMockRes();

    controller.streamCompletion(
      { prefix: 'text', sessionId: 'sess-1' } as any,
      req,
      res,
    );

    // Advance 45s → should have 3 pings
    vi.advanceTimersByTime(45_000);

    const pingWrites = (res as any)._written.filter((w: string) => w === ': ping\n\n');
    expect(pingWrites).toHaveLength(3);
  });

  it('clears heartbeat interval on stream complete (REQ-2)', async () => {
    const subject = new Subject<SseMessageEvent>();
    const mockService = {
      streamCompletion: vi.fn().mockReturnValue(subject.asObservable()),
    };

    const { CompletionController } = await import('../completion.controller');
    const controller = new CompletionController(mockService as any);

    const req = createMockReq();
    const res = createMockRes();

    controller.streamCompletion(
      { prefix: 'text', sessionId: 'sess-1' } as any,
      req,
      res,
    );

    // Complete the stream
    subject.complete();

    // Advance past when heartbeat would fire
    vi.advanceTimersByTime(30_000);

    // Should have 0 pings — interval was cleared before any fired
    const pingWrites = (res as any)._written.filter((w: string) => w === ': ping\n\n');
    expect(pingWrites).toHaveLength(0);
  });

  it('clears heartbeat interval on stream error (REQ-2)', async () => {
    const subject = new Subject<SseMessageEvent>();
    const mockService = {
      streamCompletion: vi.fn().mockReturnValue(subject.asObservable()),
    };

    const { CompletionController } = await import('../completion.controller');
    const controller = new CompletionController(mockService as any);

    const req = createMockReq();
    const res = createMockRes();

    controller.streamCompletion(
      { prefix: 'text', sessionId: 'sess-1' } as any,
      req,
      res,
    );

    // Error the stream
    subject.error(new Error('provider error'));

    // Advance past heartbeat interval
    vi.advanceTimersByTime(30_000);

    // Should have 0 pings — interval was cleared before any fired
    const pingWrites = (res as any)._written.filter((w: string) => w === ': ping\n\n');
    expect(pingWrites).toHaveLength(0);
  });
});

describe('CompletionController client disconnect (REQ-3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes AbortSignal to streamCompletion (REQ-3)', async () => {
    const subject = new Subject<SseMessageEvent>();
    const mockService = {
      streamCompletion: vi.fn().mockReturnValue(subject.asObservable()),
    };

    const { CompletionController } = await import('../completion.controller');
    const controller = new CompletionController(mockService as any);

    const req = createMockReq();
    const res = createMockRes();

    controller.streamCompletion(
      { prefix: 'text', sessionId: 'sess-1' } as any,
      req,
      res,
    );

    // Verify the service was called with a 4th argument that is an AbortSignal
    expect(mockService.streamCompletion).toHaveBeenCalledTimes(1);
    const callArgs = mockService.streamCompletion.mock.calls[0];
    expect(callArgs).toHaveLength(4);
    expect(callArgs[3]).toBeInstanceOf(AbortSignal);
    expect(callArgs[3].aborted).toBe(false);
  });

  it('aborts signal on client disconnect (REQ-3)', async () => {
    const subject = new Subject<SseMessageEvent>();
    const mockService = {
      streamCompletion: vi.fn().mockReturnValue(subject.asObservable()),
    };

    const { CompletionController } = await import('../completion.controller');
    const controller = new CompletionController(mockService as any);

    const req = createMockReq();
    const res = createMockRes();

    controller.streamCompletion(
      { prefix: 'text', sessionId: 'sess-1' } as any,
      req,
      res,
    );

    const signal = mockService.streamCompletion.mock.calls[0][3] as AbortSignal;
    expect(signal.aborted).toBe(false);

    // Simulate client disconnect
    req.emit('close');

    expect(signal.aborted).toBe(true);
  });

  it('clears heartbeat and unsubscribes on client disconnect (REQ-2, REQ-3)', async () => {
    const subject = new Subject<SseMessageEvent>();
    const mockService = {
      streamCompletion: vi.fn().mockReturnValue(subject.asObservable()),
    };

    const { CompletionController } = await import('../completion.controller');
    const controller = new CompletionController(mockService as any);

    const req = createMockReq();
    const res = createMockRes();

    controller.streamCompletion(
      { prefix: 'text', sessionId: 'sess-1' } as any,
      req,
      res,
    );

    // Simulate client disconnect
    req.emit('close');

    // Advance time — no pings should fire after close
    vi.advanceTimersByTime(30_000);

    const pingWrites = (res as any)._written.filter((w: string) => w === ': ping\n\n');
    expect(pingWrites).toHaveLength(0);

    // Subject should be able to detect unsubscription
    expect(subject.observed).toBe(false);
  });
});
