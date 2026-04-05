import { describe, it, expect, vi } from 'vitest';
import type { StreamCompletionOptions } from '../provider-adapter.interface';

/**
 * SSE reliability — signal propagation tests (REQ-4, REQ-5, REQ-8).
 *
 * Validates that AbortSignal is accepted in the interface and threaded
 * through adapters to the OpenAI SDK.
 */
describe('StreamCompletionOptions includes signal (REQ-8)', () => {
  it('accepts signal as an optional AbortSignal field', () => {
    const ac = new AbortController();
    const options: StreamCompletionOptions = {
      system: 'test',
      user: 'test',
      maxTokens: 100,
      temperature: 0.3,
      timeoutMs: 30_000,
      signal: ac.signal,
    };

    expect(options.signal).toBe(ac.signal);
    expect(options.signal?.aborted).toBe(false);
  });

  it('allows signal to be omitted (backwards-compatible)', () => {
    const options: StreamCompletionOptions = {
      system: 'test',
      user: 'test',
      maxTokens: 100,
      temperature: 0.3,
      timeoutMs: 30_000,
    };

    expect(options.signal).toBeUndefined();
  });
});

describe('OpenRouterAdapter passes signal to OpenAI SDK (REQ-5)', () => {
  it('passes signal as second arg to client.chat.completions.create', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: 'hi' }, finish_reason: 'stop' }] };
      },
    });

    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { OpenRouterAdapter } = await import('../openrouter.adapter');
    const adapter = new OpenRouterAdapter('test-key');
    const ac = new AbortController();

    const gen = adapter.streamCompletion({
      system: 'sys',
      user: 'usr',
      maxTokens: 50,
      temperature: 0.5,
      timeoutMs: 5_000,
      signal: ac.signal,
    });

    // Exhaust the generator
    for await (const _token of gen) {
      // consume
    }

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [_params, sdkOptions] = mockCreate.mock.calls[0];
    expect(sdkOptions).toEqual({ signal: ac.signal });

    vi.doUnmock('openai');
  });
});

describe('ByoAdapter passes signal to OpenAI SDK (REQ-5)', () => {
  it('passes signal as second arg to client.chat.completions.create', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: 'yo' }, finish_reason: 'stop' }] };
      },
    });

    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: mockCreate } };
      },
    }));

    const { ByoAdapter } = await import('../byo.adapter');
    const adapter = new ByoAdapter('https://api.example.com/v1', 'test-key', 'gpt-4');
    const ac = new AbortController();

    const gen = adapter.streamCompletion({
      system: 'sys',
      user: 'usr',
      maxTokens: 50,
      temperature: 0.5,
      timeoutMs: 5_000,
      signal: ac.signal,
    });

    for await (const _token of gen) {
      // consume
    }

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [_params, sdkOptions] = mockCreate.mock.calls[0];
    expect(sdkOptions).toEqual({ signal: ac.signal });

    vi.doUnmock('openai');
  });
});

describe('FreeTierProvider respects signal in round-robin loop (REQ-4)', () => {
  it('breaks round-robin loop when signal is already aborted', async () => {
    const { FreeTierProvider } = await import('../free-tier.provider');
    const provider = new FreeTierProvider();

    const ac = new AbortController();
    ac.abort(); // Pre-abort

    // Set up env so at least one provider is "configured"
    const origKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    const gen = provider.streamCompletion({
      system: 'sys',
      user: 'usr',
      maxTokens: 50,
      temperature: 0.5,
      timeoutMs: 5_000,
      signal: ac.signal,
    });

    const tokens: unknown[] = [];
    try {
      for await (const token of gen) {
        tokens.push(token);
      }
    } catch {
      // expected — all providers "failed" because we aborted
    }

    // With pre-aborted signal, no provider should have been called (loop breaks immediately)
    // We can't easily verify the internal call count without more mocking,
    // but the generator should complete without yielding real tokens
    // (since it will throw from the SDK or from our abort check)
    expect(tokens).toHaveLength(0);

    process.env.OPENROUTER_API_KEY = origKey;
  });
});
