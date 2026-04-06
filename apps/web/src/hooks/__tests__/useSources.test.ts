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
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // T-2.2: loading / call pattern
  it('calls GET /sources with credentials: include', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSources,
    } as Response);

    await fetchSourcesFromApi('http://api');

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('http://api/sources', { credentials: 'include' });
  });

  // T-2.3: retorna sources correctamente
  it('returns the sources array from the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSources,
    } as Response);

    const result = await fetchSourcesFromApi('http://api');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('src-1');
    expect(result[0].status).toBe('connected');
    expect(result[0].rootLocator).toBe('user@example.com');
  });

  // T-2.4: error handling — respuesta no-ok
  it('throws with Spanish error message on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    await expect(fetchSourcesFromApi('http://api')).rejects.toThrow(
      'Error al cargar las fuentes de datos',
    );
  });

  // T-2.5: error handling — network failure
  it('propagates network errors', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network Error'));

    await expect(fetchSourcesFromApi('http://api')).rejects.toThrow('Network Error');
  });

  // Bonus: empty array is valid (no source connected yet)
  it('returns empty array when no sources are connected', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await fetchSourcesFromApi('http://api');
    expect(result).toEqual([]);
  });
});
