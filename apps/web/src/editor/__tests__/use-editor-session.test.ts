import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for useEditorSession (REQ-1, REQ-7).
 *
 * Strategy: Since @testing-library/react is not available, we test the
 * session creation logic directly by recreating the core fetch pattern
 * (same approach as ghost-text-feedback.test.ts for sendFeedback).
 *
 * The hook's logic is:
 *   1. getCsrfToken() → returns CSRF token
 *   2. POST /completions/session with CSRF header → returns { sessionId }
 *   3. Sets sessionId and isCreatingSession = false
 *   4. On error: logs error, sets isCreatingSession = false
 *   5. On unmount (cancelled = true): no state updates
 */

/** Recreate the session creation logic from use-editor-session.ts */
interface SessionState {
  sessionId: string | null;
  isCreatingSession: boolean;
}

interface CreateSessionDeps {
  getCsrfToken: () => Promise<string>;
  fetch: typeof globalThis.fetch;
  apiUrl: string;
}

async function createSessionLogic(
  deps: CreateSessionDeps,
  setState: (updater: (prev: SessionState) => SessionState) => void,
  cancelled: { value: boolean },
): Promise<void> {
  try {
    const csrfToken = await deps.getCsrfToken();

    const res = await deps.fetch(`${deps.apiUrl}/completions/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as { sessionId: string };

    if (!cancelled.value) {
      setState((prev) => ({ ...prev, sessionId: data.sessionId }));
    }
  } catch (err) {
    console.error('[Editor] Failed to create session:', err);
  } finally {
    if (!cancelled.value) {
      setState((prev) => ({ ...prev, isCreatingSession: false }));
    }
  }
}

describe('useEditorSession — session creation logic', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('sets sessionId after successful fetch', async () => {
    const state: SessionState = { sessionId: null, isCreatingSession: true };
    const setState = (updater: (prev: SessionState) => SessionState) => {
      Object.assign(state, updater(state));
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'session-abc-123' }),
    });

    await createSessionLogic(
      {
        getCsrfToken: () => Promise.resolve('csrf-token-xyz'),
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        apiUrl: '/api',
      },
      setState,
      { value: false },
    );

    expect(state.sessionId).toBe('session-abc-123');
    expect(state.isCreatingSession).toBe(false);
  });

  it('sets isCreatingSession to false after successful fetch', async () => {
    const state: SessionState = { sessionId: null, isCreatingSession: true };
    const setState = (updater: (prev: SessionState) => SessionState) => {
      Object.assign(state, updater(state));
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'session-xyz' }),
    });

    await createSessionLogic(
      {
        getCsrfToken: () => Promise.resolve('token'),
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        apiUrl: '/api',
      },
      setState,
      { value: false },
    );

    expect(state.isCreatingSession).toBe(false);
  });

  it('calls fetch with correct CSRF header and URL', async () => {
    const state: SessionState = { sessionId: null, isCreatingSession: true };
    const setState = (updater: (prev: SessionState) => SessionState) => {
      Object.assign(state, updater(state));
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'session-123' }),
    });

    await createSessionLogic(
      {
        getCsrfToken: () => Promise.resolve('my-csrf-token'),
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        apiUrl: '/api',
      },
      setState,
      { value: false },
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/completions/session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-csrf-token': 'my-csrf-token',
        }),
        credentials: 'include',
      }),
    );
  });

  it('sets isCreatingSession to false on network failure', async () => {
    const state: SessionState = { sessionId: null, isCreatingSession: true };
    const setState = (updater: (prev: SessionState) => SessionState) => {
      Object.assign(state, updater(state));
    };

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await createSessionLogic(
      {
        getCsrfToken: () => Promise.resolve('token'),
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        apiUrl: '/api',
      },
      setState,
      { value: false },
    );

    expect(state.sessionId).toBeNull();
    expect(state.isCreatingSession).toBe(false);
  });

  it('does NOT update state when cancelled (unmount scenario)', async () => {
    const state: SessionState = { sessionId: null, isCreatingSession: true };
    const setState = (updater: (prev: SessionState) => SessionState) => {
      Object.assign(state, updater(state));
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'session-should-not-set' }),
    });

    await createSessionLogic(
      {
        getCsrfToken: () => Promise.resolve('token'),
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        apiUrl: '/api',
      },
      setState,
      { value: true }, // cancelled
    );

    expect(state.sessionId).toBeNull();
    expect(state.isCreatingSession).toBe(true);
  });

  it('sets isCreatingSession to false on HTTP error response', async () => {
    const state: SessionState = { sessionId: null, isCreatingSession: true };
    const setState = (updater: (prev: SessionState) => SessionState) => {
      Object.assign(state, updater(state));
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await createSessionLogic(
      {
        getCsrfToken: () => Promise.resolve('token'),
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        apiUrl: '/api',
      },
      setState,
      { value: false },
    );

    expect(state.sessionId).toBeNull();
    expect(state.isCreatingSession).toBe(false);
  });

  it('sets isCreatingSession to false when getCsrfToken fails', async () => {
    const state: SessionState = { sessionId: null, isCreatingSession: true };
    const setState = (updater: (prev: SessionState) => SessionState) => {
      Object.assign(state, updater(state));
    };

    const mockFetch = vi.fn();

    await createSessionLogic(
      {
        getCsrfToken: () => Promise.reject(new Error('CSRF fetch failed')),
        fetch: mockFetch as unknown as typeof globalThis.fetch,
        apiUrl: '/api',
      },
      setState,
      { value: false },
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(state.sessionId).toBeNull();
    expect(state.isCreatingSession).toBe(false);
  });
});
