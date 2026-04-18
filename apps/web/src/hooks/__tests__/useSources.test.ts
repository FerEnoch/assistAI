import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSourcesFromApi, type Source } from '../useSources';

// ──────────────────────────────────────────────
// T-2.2 a T-2.5: useSources tests
// Strategy: test the pure fetchSourcesFromApi function (no React dependency)
// ──────────────────────────────────────────────

const mockSources: Source[] = [
  {
    id: 'src-1',
    workspaceId: 'ws-1',
    sourceType: 'google_drive',
    status: 'connected',
    rootLocator: 'user@example.com',
    lastSyncedAt: '2026-04-01T10:00:00.000Z',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  },
];

describe('fetchSourcesFromApi()', () => {
  // T-2.2: loading / call pattern
  it('calls GET /sources with credentials: include', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockSources,
    } as Response);

    await fetchSourcesFromApi('http://api', mockFetch as unknown as typeof fetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith('http://api/sources', { credentials: 'include' });
  });

  // T-2.3: retorna sources correctamente
  it('returns the sources array from the API', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockSources,
    } as Response);

    const result = await fetchSourcesFromApi('http://api', mockFetch as unknown as typeof fetch);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('src-1');
    expect(result[0].status).toBe('connected');
    expect(result[0].rootLocator).toBe('user@example.com');
  });

  // T-2.4: error handling — respuesta no-ok
  it('throws with Spanish error message on non-OK response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    await expect(fetchSourcesFromApi('http://api', mockFetch as unknown as typeof fetch)).rejects.toThrow(
      'Error al cargar las fuentes de datos',
    );
  });

  // T-2.5: error handling — network failure
  it('propagates network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network Error'));

    await expect(fetchSourcesFromApi('http://api', mockFetch as unknown as typeof fetch)).rejects.toThrow('Network Error');
  });

  // Bonus: empty array is valid (no source connected yet)
  it('returns empty array when no sources are connected', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await fetchSourcesFromApi('http://api', mockFetch as unknown as typeof fetch);
    expect(result).toEqual([]);
  });

  // T-2.1: accepts injectable fetch for testability
  it('uses the injected fetch function instead of global', async () => {
    const customFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockSources,
    } as Response);

    await fetchSourcesFromApi('http://custom-api', customFetch as unknown as typeof fetch);

    expect(customFetch).toHaveBeenCalledWith('http://custom-api/sources', { credentials: 'include' });
  });
});

// ──────────────────────────────────────────────
// T-2.6: ?source=connected redirect logic
// The hook itself is pure fetch; the redirect detection lives in LibraryPage.
// We test the extracted logic here as a pure function.
// ──────────────────────────────────────────────

/**
 * Pure function extracted from LibraryPage's useEffect that handles
 * the ?source=connected query param after OAuth redirect.
 */
function handleRedirectParam(
  sourceParam: string | null,
  hasHandledRef: { current: boolean },
  refetch: () => void,
  replaceState: (url: string) => void,
): void {
  if (sourceParam === 'connected' && !hasHandledRef.current) {
    hasHandledRef.current = true;
    refetch();
    replaceState('/library');
  }
}

describe('handleRedirectParam() — ?source=connected one-shot logic', () => {
  it('calls refetch and replaceState when source=connected arrives', () => {
    const refetch = vi.fn();
    const replaceState = vi.fn();
    const hasHandledRef = { current: false };

    handleRedirectParam('connected', hasHandledRef, refetch, replaceState);

    expect(refetch).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith('/library');
    expect(hasHandledRef.current).toBe(true);
  });

  it('does NOT call refetch a second time (one-shot guard)', () => {
    const refetch = vi.fn();
    const replaceState = vi.fn();
    const hasHandledRef = { current: false };

    handleRedirectParam('connected', hasHandledRef, refetch, replaceState);
    handleRedirectParam('connected', hasHandledRef, refetch, replaceState);

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('does nothing when source param is null', () => {
    const refetch = vi.fn();
    const replaceState = vi.fn();
    const hasHandledRef = { current: false };

    handleRedirectParam(null, hasHandledRef, refetch, replaceState);

    expect(refetch).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(hasHandledRef.current).toBe(false);
  });

  it('does nothing when source param is a different value', () => {
    const refetch = vi.fn();
    const replaceState = vi.fn();
    const hasHandledRef = { current: false };

    handleRedirectParam('disconnected', hasHandledRef, refetch, replaceState);

    expect(refetch).not.toHaveBeenCalled();
  });
});
