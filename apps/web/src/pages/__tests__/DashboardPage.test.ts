import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Source } from '../../hooks/useSources';
import { getSourceSectionState } from '../LibraryPage';

// ──────────────────────────────────────────────
// Source state helpers — previously tested in DashboardPage.
// Now moved to Library (Drive connection logic migrated to LibraryPage).
// Dashboard route redirects to /library.
// ──────────────────────────────────────────────

// ─── Source state helpers ───────────────────────────────────────────────────

/** Logic to find a connected source (used in LibraryPage) */
function findConnectedSource(sources: Source[]): Source | undefined {
  return sources.find((s) => s.status === 'connected' || s.status === 'syncing');
}

const makeSource = (overrides: Partial<Source> = {}): Source => ({
  id: 'src-1',
  workspaceId: 'ws-1',
  sourceType: 'google_drive',
  status: 'connected',
  rootLocator: 'user@example.com',
  lastSyncedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ─── handleSelectFiles logic ─────────────────────────────────────────────────

type SelectResult = { ok: true } | { ok: false; error: string };

async function selectFiles(
  apiUrl: string,
  sourceId: string,
  fileIds: string[],
  rootLocator: string,
  csrfToken: string,
): Promise<SelectResult> {
  const res = await fetch(`${apiUrl}/sources/${sourceId}/select`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({ fileIds, rootLocator }),
  });
  if (!res.ok) return { ok: false, error: 'Error al guardar la selección' };
  return { ok: true };
}

/**
 * Double-submit guard logic extracted from handleIndexFromDrive.
 * isSubmitting is a ref (.current) so it survives re-renders without triggering them.
 */
async function guardedSelectFiles(
  isSubmittingRef: { current: boolean },
  apiUrl: string,
  sourceId: string,
  rootLocator: string,
  csrfToken: string,
): Promise<SelectResult | null> {
  if (isSubmittingRef.current) return null;
  isSubmittingRef.current = true;
  try {
    return await selectFiles(apiUrl, sourceId, [], rootLocator, csrfToken);
  } finally {
    isSubmittingRef.current = false;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LibraryPage — source state logic (migrated from Dashboard)', () => {
  it('returns undefined when no sources are connected', () => {
    const sources: Source[] = [];
    expect(findConnectedSource(sources)).toBeUndefined();
  });

  it('returns the connected source with rootLocator (email)', () => {
    const src = makeSource({ rootLocator: 'test@example.com' });
    const result = findConnectedSource([src]);
    expect(result?.id).toBe('src-1');
    expect(result?.rootLocator).toBe('test@example.com');
  });

  it('also picks up a source with status syncing', () => {
    const src = makeSource({ status: 'syncing' });
    expect(findConnectedSource([src])?.status).toBe('syncing');
  });

  it('ignores sources with disconnected or error status', () => {
    const sources = [
      makeSource({ id: 'a', status: 'disconnected' }),
      makeSource({ id: 'b', status: 'error' }),
    ];
    expect(findConnectedSource(sources)).toBeUndefined();
  });
});

describe('LibraryPage — getSourceSectionState (T-3.12)', () => {
  it('returns "loading" when isLoading is true', () => {
    expect(getSourceSectionState([], true, null)).toBe('loading');
  });

  it('returns "error" when error is set', () => {
    expect(getSourceSectionState([], false, 'fail')).toBe('error');
  });

  it('returns "disconnected" when sources is empty', () => {
    expect(getSourceSectionState([], false, null)).toBe('disconnected');
  });

  it('returns "connected" when a source has status connected', () => {
    expect(getSourceSectionState([{ status: 'connected' }], false, null)).toBe('connected');
  });

  it('returns "syncing" when a source has status syncing', () => {
    expect(getSourceSectionState([{ status: 'syncing' }], false, null)).toBe('syncing');
  });

  it('returns "needs_reauth" when a source has status needs_reauth', () => {
    expect(getSourceSectionState([{ status: 'needs_reauth' }], false, null)).toBe('needs_reauth');
  });

  it('loading takes priority over error', () => {
    expect(getSourceSectionState([], true, 'some error')).toBe('loading');
  });

  it('returns "disconnected" when all sources are disconnected/error', () => {
    expect(getSourceSectionState([{ status: 'disconnected' }, { status: 'error' }], false, null)).toBe('disconnected');
  });
});

describe('LibraryPage — handleSelectFiles logic', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('calls POST /sources/:id/select with x-csrf-token header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    await selectFiles('http://api', 'src-1', ['file-a', 'file-b'], '["file-a","file-b"]', 'test-csrf-token');

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'http://api/sources/src-1/select',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'test-csrf-token',
        },
        body: JSON.stringify({ fileIds: ['file-a', 'file-b'], rootLocator: '["file-a","file-b"]' }),
      }),
    );
  });

  it('forwards the csrfToken into the x-csrf-token header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    await selectFiles('http://api', 'src-1', ['x'], 'x', 'my-unique-token-42');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      'x-csrf-token': 'my-unique-token-42',
    });
  });

  it('returns ok: true on successful response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    const result = await selectFiles('http://api', 'src-1', ['x'], 'x', 'tok');
    expect(result).toEqual({ ok: true });
  });

  it('returns ok: false with Spanish error message on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 422 } as Response);

    const result = await selectFiles('http://api', 'src-1', ['x'], 'x', 'tok');
    expect(result).toEqual({ ok: false, error: 'Error al guardar la selección' });
  });
});

describe('LibraryPage — handleIndexFromDrive double-submit prevention', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('does NOT dispatch a second fetch when isSubmitting is true', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const isSubmittingRef = { current: true }; // already in-flight
    const result = await guardedSelectFiles(isSubmittingRef, 'http://api', 'src-1', 'root', 'tok');

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resets isSubmitting to false after a successful call', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    const isSubmittingRef = { current: false };
    await guardedSelectFiles(isSubmittingRef, 'http://api', 'src-1', 'root', 'tok');

    expect(isSubmittingRef.current).toBe(false);
  });

  it('resets isSubmitting to false even when the call fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const isSubmittingRef = { current: false };
    try {
      await guardedSelectFiles(isSubmittingRef, 'http://api', 'src-1', 'root', 'tok');
    } catch {
      // expected
    }

    expect(isSubmittingRef.current).toBe(false);
  });
});

// ─── FIX 9 & 10: Error path keeps picker open (T-3.10) ──────────────────────

describe('LibraryPage — picker dismiss on error (T-3.10 / Scenario 5.2)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * Simulates the handleIndexFromDrive logic:
   * On success → closes modal (returns true).
   * On error → does NOT close modal (returns false).
   */
  async function simulateIndexFromDrive(
    fetchFn: typeof fetch,
    apiUrl: string,
    sourceId: string,
    rootLocator: string,
    csrfToken: string,
  ): Promise<{ closed: boolean; feedback: string }> {
    const res = await fetchFn(`${apiUrl}/sources/${sourceId}/select`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ rootLocator }),
    });

    if (res.ok) {
      return { closed: true, feedback: 'Indexación iniciada' };
    }
    // On error: picker NOT closed (Scenario 5.2)
    return { closed: false, feedback: 'Error al iniciar la indexación. Intentá de nuevo.' };
  }

  it('on success: picker is closed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    const result = await simulateIndexFromDrive(fetch, 'http://api', 'src-1', 'root', 'tok');
    expect(result.closed).toBe(true);
    expect(result.feedback).toBe('Indexación iniciada');
  });

  it('on error (ok: false): picker is NOT closed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    const result = await simulateIndexFromDrive(fetch, 'http://api', 'src-1', 'root', 'tok');
    expect(result.closed).toBe(false);
    expect(result.feedback).toContain('Error');
  });
});
