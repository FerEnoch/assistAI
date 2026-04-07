import { useState, useEffect, useCallback } from 'react';
import envConfig from '../config';
import { getCsrfToken } from '../auth/csrf';

interface StatusCounts {
  queued: number;
  processing: number;
  indexed: number;
  failed: number;
}

interface DocumentItem {
  id: string;
  title: string | null;
  mimeType: string | null;
  ingestStatus: 'queued' | 'processing' | 'indexed' | 'failed';
  errorReason: string | null;
  indexedAt: string | null;
  createdAt: string;
}

/**
 * Indexing Status Panel — shows document ingestion progress (A-044, A-046).
 *
 * Displays:
 * - Summary counts by status (queued, processing, indexed, failed)
 * - Individual document status with error details
 * - Delete button per document (any status)
 * - Auto-refreshes every 10 seconds while documents are being processed
 *
 * All copy in Rioplatense Spanish per A-024.
 */
export function IndexingStatus() {
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [countsRes, docsRes] = await Promise.all([
        fetch(`${envConfig.apiUrl}/documents/status-counts`, { credentials: 'include' }),
        fetch(
          `${envConfig.apiUrl}/documents${filter !== 'all' ? `?status=${filter}` : ''}`,
          { credentials: 'include' },
        ),
      ]);

      if (!countsRes.ok || !docsRes.ok) {
        throw new Error('Error al cargar el estado de indexación');
      }

      const [countsData, docsData] = await Promise.all([
        countsRes.json() as Promise<StatusCounts>,
        docsRes.json() as Promise<DocumentItem[]>,
      ]);

      setCounts(countsData);
      setDocuments(docsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  const handleDelete = useCallback(async (docId: string) => {
    setDeletingIds((prev) => new Set(prev).add(docId));
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${envConfig.apiUrl}/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken },
      });

      if (!res.ok) throw new Error('Error al eliminar el documento');

      // Optimistic removal from local state
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      // Refresh counts
      void fetchData();
    } catch {
      // silently fail — user can retry
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }, [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Auto-refresh while processing
  useEffect(() => {
    const hasActive = counts && (counts.queued > 0 || counts.processing > 0);
    if (!hasActive) return;

    const interval = setInterval(() => void fetchData(), 10_000);
    return () => clearInterval(interval);
  }, [counts, fetchData]);

  if (isLoading) {
    return <div style={styles.container}><p style={styles.loading}>Cargando estado de indexación...</p></div>;
  }

  if (error) {
    return <div style={styles.container}><p style={styles.error}>{error}</p></div>;
  }

  const total = counts ? counts.queued + counts.processing + counts.indexed + counts.failed : 0;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Estado de indexación</h3>

      {/* Summary counters */}
      {counts && (
        <div style={styles.counters}>
          <StatusBadge label="En cola" count={counts.queued} color="#6b7280" />
          <StatusBadge label="Procesando" count={counts.processing} color="#f59e0b" />
          <StatusBadge label="Indexados" count={counts.indexed} color="#10b981" />
          <StatusBadge label="Fallidos" count={counts.failed} color="#ef4444" />
        </div>
      )}

      {/* Progress bar */}
      {total > 0 && counts && (
        <div style={styles.progressBar}>
          <div
            style={{ ...styles.progressFill, width: `${(counts.indexed / total) * 100}%`, backgroundColor: '#10b981' }}
          />
          <div
            style={{ ...styles.progressFill, width: `${(counts.processing / total) * 100}%`, backgroundColor: '#f59e0b' }}
          />
          <div
            style={{ ...styles.progressFill, width: `${(counts.failed / total) * 100}%`, backgroundColor: '#ef4444' }}
          />
        </div>
      )}

      {/* Filter buttons */}
      <div style={styles.filters}>
        {(['all', 'queued', 'processing', 'indexed', 'failed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              ...styles.filterButton,
              ...(filter === status ? styles.filterActive : {}),
            }}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {/* Document list */}
      <div style={styles.docList}>
        {documents.length === 0 && (
          <p style={styles.emptyState}>
            No hay documentos{filter !== 'all' ? ` con estado "${STATUS_LABELS[filter]}"` : ''}.
            Conectá tu Google Drive para empezar a indexar.
          </p>
        )}
        {documents.map((doc) => (
          <div key={doc.id} style={styles.docRow}>
            <div style={styles.docInfo}>
              <span style={styles.docTitle}>{doc.title ?? 'Sin título'}</span>
              <span style={styles.docMime}>{MIME_LABELS[doc.mimeType ?? ''] ?? doc.mimeType}</span>
            </div>
            <div style={styles.docStatusRow}>
              <div style={styles.docStatus}>
                <span style={{ ...styles.statusDot, backgroundColor: STATUS_COLORS[doc.ingestStatus] }} />
                <span style={styles.statusText}>{STATUS_LABELS[doc.ingestStatus]}</span>
              </div>
              <button
                style={{
                  ...styles.deleteButton,
                  ...(deletingIds.has(doc.id) ? styles.deleteButtonDisabled : {}),
                }}
                onClick={() => void handleDelete(doc.id)}
                disabled={deletingIds.has(doc.id)}
                title="Eliminar documento"
                aria-label={`Eliminar ${doc.title ?? 'documento'}`}
              >
                {deletingIds.has(doc.id) ? '...' : '✕'}
              </button>
            </div>
            {doc.ingestStatus === 'failed' && doc.errorReason && (
              <p style={styles.errorDetail}>{friendlyError(doc.errorReason)}</p>
            )}
            {doc.ingestStatus === 'indexed' && doc.indexedAt && (
              <p style={styles.indexedDate}>
                Indexado: {new Date(doc.indexedAt).toLocaleDateString('es-AR')}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Manual refresh */}
      <button style={styles.refreshButton} onClick={() => void fetchData()}>
        Actualizar estado
      </button>
    </div>
  );
}

/**
 * Converts raw internal error reasons (e.g. "EMBEDDING_ERROR: ...") into
 * user-friendly messages in Rioplatense Spanish.
 */
function friendlyError(raw: string | null): string {
  if (!raw) return 'Error desconocido al procesar el documento.';
  if (raw.startsWith('EMBEDDING_ERROR:')) return 'No se pudo generar el índice del documento. Intentá reconectando la fuente.';
  if (raw.startsWith('EMBED_NO_CHUNKS:')) return 'El documento no tiene contenido legible para indexar.';
  if (raw.startsWith('PARSE_ERROR:')) return 'No se pudo leer el archivo. Verificá que no esté dañado.';
  if (raw.startsWith('FILE_REMOVED:')) return 'El archivo fue eliminado o movido a la papelera en Google Drive.';
  return 'Error al procesar el documento.';
}

function StatusBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={styles.badge}>
      <span style={{ ...styles.badgeCount, color }}>{count}</span>
      <span style={styles.badgeLabel}>{label}</span>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  queued: 'En cola',
  processing: 'Procesando',
  indexed: 'Indexados',
  failed: 'Fallidos',
};

const STATUS_COLORS: Record<string, string> = {
  queued: '#6b7280',
  processing: '#f59e0b',
  indexed: '#10b981',
  failed: '#ef4444',
};

const MIME_LABELS: Record<string, string> = {
  'text/plain': 'TXT',
  'text/markdown': 'Markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/pdf': 'PDF',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '1.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#1a1a2e',
    margin: '0 0 1rem',
  },
  loading: {
    fontSize: '0.875rem',
    color: '#6b7280',
    textAlign: 'center',
    padding: '2rem 0',
  },
  error: {
    fontSize: '0.875rem',
    color: '#ef4444',
    textAlign: 'center',
    padding: '1rem 0',
  },
  counters: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
  },
  badge: {
    flex: 1,
    textAlign: 'center' as const,
    padding: '0.75rem 0.5rem',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
  badgeCount: {
    display: 'block',
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  badgeLabel: {
    display: 'block',
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  progressBar: {
    display: 'flex',
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '1rem',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  filters: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    flexWrap: 'wrap' as const,
  },
  filterButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.8rem',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  filterActive: {
    color: '#1a1a2e',
    backgroundColor: '#e0e7ff',
    borderColor: '#818cf8',
    fontWeight: 600,
  },
  docList: {
    maxHeight: '320px',
    overflowY: 'auto' as const,
  },
  emptyState: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    textAlign: 'center' as const,
    padding: '2rem 0',
  },
  docRow: {
    padding: '0.75rem 0',
    borderBottom: '1px solid #f3f4f6',
  },
  docInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem',
  },
  docTitle: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#111827',
  },
  docMime: {
    fontSize: '0.7rem',
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
  },
  docStatusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  statusText: {
    fontSize: '0.8rem',
    color: '#6b7280',
  },
  deleteButton: {
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    color: '#9ca3af',
    backgroundColor: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    cursor: 'pointer',
    lineHeight: 1,
    transition: 'color 0.15s, border-color 0.15s',
  },
  deleteButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  errorDetail: {
    fontSize: '0.75rem',
    color: '#ef4444',
    margin: '0.25rem 0 0',
    fontStyle: 'italic',
  },
  indexedDate: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    margin: '0.25rem 0 0',
  },
  refreshButton: {
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: '6px',
    cursor: 'pointer',
    width: '100%',
  },
};
