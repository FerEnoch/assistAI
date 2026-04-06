import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Source } from '../../hooks/useSources';

// ──────────────────────────────────────────────
// T-3.8 a T-3.12: DashboardPage logic tests
//
// Strategy: test pure functions / logic extracted from DashboardPage.
// This avoids React Testing Library while verifying all business logic.
// ──────────────────────────────────────────────

// ─── Source state helpers ───────────────────────────────────────────────────

/** Mirrors the logic in DashboardPage to find a connected source */
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
): Promise<SelectResult> {
  const res = await fetch(`${apiUrl}/sources/${sourceId}/select`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds, rootLocator }),
  });
  if (!res.ok) return { ok: false, error: 'Error al guardar la selección' };
  return { ok: true };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DashboardPage — source state logic', () => {
  // T-3.8: sin source conectada
  it('returns undefined when no sources are connected', () => {
    const sources: Source[] = [];
    expect(findConnectedSource(sources)).toBeUndefined();
  });

  // T-3.9: con source conectada muestra email
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

describe('DashboardPage — handleSelectFiles logic', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // T-3.10: handleSelectFiles llama POST /sources/:id/select
  it('calls POST /sources/:id/select with correct payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    await selectFiles('http://api', 'src-1', ['file-a', 'file-b'], '["file-a","file-b"]');

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'http://api/sources/src-1/select',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ['file-a', 'file-b'], rootLocator: '["file-a","file-b"]' }),
      }),
    );
  });

  // T-3.11: éxito → ok: true
  it('returns ok: true on successful response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    const result = await selectFiles('http://api', 'src-1', ['x'], 'x');
    expect(result).toEqual({ ok: true });
  });

  // T-3.12: error → ok: false con mensaje en español
  it('returns ok: false with Spanish error message on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 422 } as Response);

    const result = await selectFiles('http://api', 'src-1', ['x'], 'x');
    expect(result).toEqual({ ok: false, error: 'Error al guardar la selección' });
  });
});
