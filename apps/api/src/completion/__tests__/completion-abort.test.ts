import { describe, it, expect, vi } from 'vitest';
import type { SseMessageEvent } from '../completion.service';

/**
 * Returns an AsyncIterable that immediately throws when iterated.
 * Uses a plain object (not a generator function) to avoid the ESLint require-yield rule.
 */
function throwingIterable(err: Error): AsyncIterable<never> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<never>> {
          return Promise.reject(err);
        },
      };
    },
  };
}

/**
 * SSE reliability — service-level abort tests (REQ-6, REQ-7, REQ-9).
 *
 * Tests that:
 * - Pre-aborted signal causes silent return (no error event)
 * - AbortError in catch block causes silent return (no error event)
 * - Non-abort errors still emit error event (regression guard)
 */
describe('CompletionService abort handling (REQ-6, REQ-7)', () => {
  /**
   * We test the streamCompletion method with a signal parameter.
   * The service signature should accept (wsId, userId, payload, signal?).
   */

  it('accepts signal as optional 4th param and threads to pipeline', async () => {
    // This test verifies the service accepts the signal parameter
    // without erroring. We mock all dependencies.
    const { CompletionService } = await import('../completion.service');

    const mockSessionRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
    const mockCompletionRepo = {
      create: vi.fn().mockReturnValue({ id: 'comp-1' }),
      save: vi.fn().mockResolvedValue({ id: 'comp-1' }),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const mockHitRepo = { create: vi.fn(), save: vi.fn() };
    const mockDataSource = {};
    const mockRetrieval = { findSimilarChunks: vi.fn().mockResolvedValue([]) };
    const mockEmbedding = { embed: vi.fn().mockResolvedValue(null) };
    const mockAssembler = {
      shouldSkipRetrieval: vi.fn().mockReturnValue(true),
      assemblePrompt: vi.fn().mockReturnValue({ system: 'sys', user: 'usr' }),
      detectDocumentType: vi.fn().mockReturnValue(null),
    };

    // Mock adapter that yields one token then done
    const mockAdapter = {
      streamCompletion: vi.fn().mockReturnValue(
        (async function* () {
          yield { text: 'hello', done: false };
          yield { text: '', done: true };
        })(),
      ),
    };
    const mockRouter = {
      getProvider: vi.fn().mockResolvedValue({
        adapter: mockAdapter,
        endpointId: 'ep-1',
        providerType: 'free_tier',
      }),
    };

    const mockStructuralMatch = {
      findMatch: vi.fn().mockResolvedValue(null),
      streamTokens: vi.fn(),
    };

    const service = new CompletionService(
      mockSessionRepo as any,
      mockCompletionRepo as any,
      mockHitRepo as any,
      mockDataSource as any,
      mockRetrieval as any,
      mockEmbedding as any,
      mockAssembler as any,
      mockRouter as any,
      mockStructuralMatch as any,
    );

    const ac = new AbortController();
    const observable = service.streamCompletion('ws-1', 'u-1', {
      prefix: 'test',
      sessionId: 'sess-1',
    } as any, ac.signal);

    const events: SseMessageEvent[] = [];
    await new Promise<void>((resolve) => {
      observable.subscribe({
        next: (e) => events.push(e),
        complete: () => resolve(),
        error: () => resolve(),
      });
    });

    // Should have received meta, token, done events (normal flow)
    const types = events.map((e) => e.type);
    expect(types).toContain('meta');
    expect(types).toContain('token');
    expect(types).toContain('done');
    // Should NOT have error events
    expect(types).not.toContain('error');
  });

  it('emits no error event when signal is pre-aborted (REQ-6)', async () => {
    const { CompletionService } = await import('../completion.service');

    const mockCompletionRepo = {
      create: vi.fn().mockReturnValue({ id: 'comp-1' }),
      save: vi.fn().mockResolvedValue({ id: 'comp-1' }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    const mockRouter = {
      getProvider: vi.fn().mockResolvedValue({
        adapter: {
          streamCompletion: vi.fn().mockReturnValue(
            (async function* () {
              yield { text: 'never', done: false };
            })(),
          ),
        },
        endpointId: null,
        providerType: 'free_tier',
      }),
    };

    const service = new CompletionService(
      { findOne: vi.fn(), create: vi.fn(), save: vi.fn() } as any,
      mockCompletionRepo as any,
      { create: vi.fn(), save: vi.fn() } as any,
      {} as any,
      { findSimilarChunks: vi.fn().mockResolvedValue([]) } as any,
      { embed: vi.fn().mockResolvedValue(null) } as any,
      {
        shouldSkipRetrieval: vi.fn().mockReturnValue(true),
        assemblePrompt: vi.fn().mockReturnValue({ system: 's', user: 'u' }),
        detectDocumentType: vi.fn().mockReturnValue(null),
      } as any,
      mockRouter as any,
      { findMatch: vi.fn().mockResolvedValue(null), streamTokens: vi.fn() } as any,
    );

    const ac = new AbortController();
    ac.abort(); // Pre-abort!

    const observable = service.streamCompletion('ws-1', 'u-1', {
      prefix: 'test',
      sessionId: 'sess-1',
    } as any, ac.signal);

    const events: SseMessageEvent[] = [];
    await new Promise<void>((resolve) => {
      observable.subscribe({
        next: (e) => events.push(e),
        complete: () => resolve(),
        error: () => resolve(),
      });
    });

    // Should NOT have any error events (REQ-6)
    const errorEvents = events.filter((e) => e.type === 'error');
    expect(errorEvents).toHaveLength(0);

    // Should NOT have token events (pipeline exited early)
    const tokenEvents = events.filter((e) => e.type === 'token');
    expect(tokenEvents).toHaveLength(0);
  });

  it('emits no error event when provider throws AbortError (REQ-6, REQ-7)', async () => {
    const { CompletionService } = await import('../completion.service');

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const mockAdapter = {
      streamCompletion: vi.fn().mockReturnValue(throwingIterable(abortError)),
    };

    const mockCompletionRepo = {
      create: vi.fn().mockReturnValue({ id: 'comp-1' }),
      save: vi.fn().mockResolvedValue({ id: 'comp-1' }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    const service = new CompletionService(
      { findOne: vi.fn(), create: vi.fn(), save: vi.fn() } as any,
      mockCompletionRepo as any,
      { create: vi.fn(), save: vi.fn() } as any,
      {} as any,
      { findSimilarChunks: vi.fn().mockResolvedValue([]) } as any,
      { embed: vi.fn().mockResolvedValue(null) } as any,
      {
        shouldSkipRetrieval: vi.fn().mockReturnValue(true),
        assemblePrompt: vi.fn().mockReturnValue({ system: 's', user: 'u' }),
        detectDocumentType: vi.fn().mockReturnValue(null),
      } as any,
      {
        getProvider: vi.fn().mockResolvedValue({
          adapter: mockAdapter,
          endpointId: null,
          providerType: 'free_tier',
        }),
      } as any,
      { findMatch: vi.fn().mockResolvedValue(null), streamTokens: vi.fn() } as any,
    );

    const ac = new AbortController();
    ac.abort(); // Signal is aborted when error is caught

    const observable = service.streamCompletion('ws-1', 'u-1', {
      prefix: 'test',
      sessionId: 'sess-1',
    } as any, ac.signal);

    const events: SseMessageEvent[] = [];
    await new Promise<void>((resolve) => {
      observable.subscribe({
        next: (e) => events.push(e),
        complete: () => resolve(),
        error: () => resolve(),
      });
    });

    // Should have NO error events — abort is silent (REQ-6)
    const errorEvents = events.filter((e) => e.type === 'error');
    expect(errorEvents).toHaveLength(0);
  });

  it('still emits error event on non-abort errors (REQ-9 regression guard)', async () => {
    const { CompletionService } = await import('../completion.service');

    const normalError = new Error('PROVIDER_ERROR: something went wrong');

    const mockAdapter = {
      streamCompletion: vi.fn().mockReturnValue(throwingIterable(normalError)),
    };

    const mockCompletionRepo = {
      create: vi.fn().mockReturnValue({ id: 'comp-1' }),
      save: vi.fn().mockResolvedValue({ id: 'comp-1' }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    const service = new CompletionService(
      { findOne: vi.fn(), create: vi.fn(), save: vi.fn() } as any,
      mockCompletionRepo as any,
      { create: vi.fn(), save: vi.fn() } as any,
      {} as any,
      { findSimilarChunks: vi.fn().mockResolvedValue([]) } as any,
      { embed: vi.fn().mockResolvedValue(null) } as any,
      {
        shouldSkipRetrieval: vi.fn().mockReturnValue(true),
        assemblePrompt: vi.fn().mockReturnValue({ system: 's', user: 'u' }),
        detectDocumentType: vi.fn().mockReturnValue(null),
      } as any,
      {
        getProvider: vi.fn().mockResolvedValue({
          adapter: mockAdapter,
          endpointId: null,
          providerType: 'free_tier',
        }),
      } as any,
      { findMatch: vi.fn().mockResolvedValue(null), streamTokens: vi.fn() } as any,
    );

    // No signal — normal flow
    const observable = service.streamCompletion('ws-1', 'u-1', {
      prefix: 'test',
      sessionId: 'sess-1',
    } as any);

    const events: SseMessageEvent[] = [];
    await new Promise<void>((resolve) => {
      observable.subscribe({
        next: (e) => events.push(e),
        complete: () => resolve(),
        error: () => resolve(),
      });
    });

    // SHOULD have an error event (existing behavior preserved — REQ-9)
    const errorEvents = events.filter((e) => e.type === 'error');
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].data).toContain('error');
  });
});
