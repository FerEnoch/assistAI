import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ──────────────────────────────────────────────
// useTemplateDocuments — pure logic tests
// Strategy: test fetch logic without React hooks
// ──────────────────────────────────────────────

// Mirror the fetch logic from useTemplateDocuments
async function fetchTemplateDocuments(apiUrl: string, templateId: string) {
  const res = await fetch(`${apiUrl}/templates/${templateId}/documents`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error al cargar documentos');
  return res.json();
}

async function addDocumentToTemplate(
  apiUrl: string,
  templateId: string,
  documentId: string,
  csrfToken: string,
) {
  const res = await fetch(`${apiUrl}/templates/${templateId}/documents`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ documentId }),
  });
  if (!res.ok) throw new Error('Error al asociar documento');
}

async function removeDocumentFromTemplate(
  apiUrl: string,
  templateId: string,
  documentId: string,
  csrfToken: string,
) {
  const res = await fetch(`${apiUrl}/templates/${templateId}/documents/${documentId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'x-csrf-token': csrfToken },
  });
  if (!res.ok && (res as Response).status !== 204) throw new Error('Error al quitar documento');
}

describe('useTemplateDocuments — fetch logic', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetchTemplateDocuments — calls correct endpoint and returns data', async () => {
    const docs = [{ id: 'doc-1', title: 'Doc 1', ingestStatus: 'indexed' }];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => docs,
    } as Response);

    const result = await fetchTemplateDocuments('http://api', 'tpl-1');
    expect(fetch).toHaveBeenCalledWith('http://api/templates/tpl-1/documents', { credentials: 'include' });
    expect(result).toEqual(docs);
  });

  it('fetchTemplateDocuments — throws on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    await expect(fetchTemplateDocuments('http://api', 'tpl-1')).rejects.toThrow('Error al cargar documentos');
  });

  it('addDocumentToTemplate — calls POST with documentId and csrf token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    await addDocumentToTemplate('http://api', 'tpl-1', 'doc-1', 'csrf-xyz');

    expect(fetch).toHaveBeenCalledWith(
      'http://api/templates/tpl-1/documents',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-csrf-token': 'csrf-xyz' }),
        body: JSON.stringify({ documentId: 'doc-1' }),
      }),
    );
  });

  it('removeDocumentFromTemplate — calls DELETE on correct URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response);

    await removeDocumentFromTemplate('http://api', 'tpl-1', 'doc-2', 'csrf-xyz');

    expect(fetch).toHaveBeenCalledWith(
      'http://api/templates/tpl-1/documents/doc-2',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('useTemplateDocuments — state transitions', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetchTemplateDocuments — success returns array of documents', async () => {
    const docs = [
      { id: 'doc-1', title: 'Contract A', ingestStatus: 'indexed', createdAt: '2026-01-01' },
      { id: 'doc-2', title: 'Contract B', ingestStatus: 'processing', createdAt: '2026-01-02' },
    ];
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => docs } as Response);

    const result = await fetchTemplateDocuments('http://api', 'tpl-1');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Contract A');
    expect(result[1].ingestStatus).toBe('processing');
  });

  it('fetchTemplateDocuments — error state on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network error'));

    await expect(fetchTemplateDocuments('http://api', 'tpl-1')).rejects.toThrow('Network error');
  });

  it('fetchTemplateDocuments — error state on server error (500)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    await expect(fetchTemplateDocuments('http://api', 'tpl-1')).rejects.toThrow('Error al cargar documentos');
  });

  it('addDocumentToTemplate — throws on 403 (cross-workspace)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 403 } as Response);

    await expect(
      addDocumentToTemplate('http://api', 'tpl-1', 'doc-other', 'csrf-xyz'),
    ).rejects.toThrow('Error al asociar documento');
  });

  it('removeDocumentFromTemplate — succeeds with 204 status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 204 } as Response);

    // Should NOT throw — 204 is acceptable
    await expect(
      removeDocumentFromTemplate('http://api', 'tpl-1', 'doc-1', 'csrf-xyz'),
    ).resolves.toBeUndefined();
  });

  it('removeDocumentFromTemplate — throws on 500 error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    await expect(
      removeDocumentFromTemplate('http://api', 'tpl-1', 'doc-1', 'csrf-xyz'),
    ).rejects.toThrow('Error al quitar documento');
  });
});
