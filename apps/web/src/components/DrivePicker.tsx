import { useState, useEffect, useCallback } from 'react';
import envConfig from '../config';

/**
 * MIME types supported for ingestion. Must stay in sync with SUPPORTED_MIME_TYPES
 * in @assistai/shared. Folders are always allowed for navigation/selection context.
 */
const SUPPORTED_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
  'application/vnd.google-apps.folder',
]);

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

interface DrivePickerProps {
  sourceId: string;
  onSelect: (fileIds: string[], rootLocator: string) => void;
  onCancel: () => void;
  /** Called when Drive auth has expired and user needs to reconnect */
  onReauthRequired?: () => void;
  /** When true, only one file can be selected and folders are hidden */
  singleSelect?: boolean;
}

/**
 * Drive file/folder picker UI (A-033).
 * Allows users to select files or folders for indexing.
 * All copy in Spanish.
 */
export function DrivePicker({ sourceId, onSelect, onCancel, onReauthRequired, singleSelect = false }: DrivePickerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  const fetchFiles = useCallback(
    async (pageToken?: string) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (pageToken) params.set('pageToken', pageToken);

        const res = await fetch(
          `${envConfig.apiUrl}/sources/${sourceId}/files?${params.toString()}`,
          { credentials: 'include' },
        );

        if (!res.ok) {
          // Detect reauth signal from API
          if (res.status === 401) {
            try {
              const body = await res.json();
              if (body?.error?.code === 'REAUTH_REQUIRED') {
                setNeedsReauth(true);
                setFiles([]);
                setSelected(new Set());
                setNextPageToken(undefined);
                setError(null);
                return;
              }
            } catch { /* fall through to generic error */ }
          }
          throw new Error('Error al cargar archivos');
        }

        const data = await res.json();
        setFiles((prev) => (pageToken ? [...prev, ...data.files] : data.files));
        setNextPageToken(data.nextPageToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    },
    [sourceId],
  );

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const toggleSelect = (fileId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        if (singleSelect) {
          next.clear();
        }
        next.add(fileId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const ids = Array.from(selected);
    // Build a human-readable label from selected file names (not serialized IDs)
    const selectedFiles = files.filter((f) => selected.has(f.id));
    const label =
      selectedFiles.length === 1
        ? selectedFiles[0].name
        : `${selectedFiles.length} archivos seleccionados`;
    onSelect(ids, label);
  };

  const isFolder = (mimeType: string) => mimeType === 'application/vnd.google-apps.folder';

  // Compute the visible (filtered) list once — used for both rendering and empty state
  const visibleFiles = files
    .filter((file) => SUPPORTED_MIME_TYPES.has(file.mimeType))
    .filter((file) => !singleSelect || !isFolder(file.mimeType));

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Seleccionar archivos</h2>
          <button style={styles.closeButton} onClick={onCancel}>
            ✕
          </button>
        </div>

        <p style={styles.description}>
          Elegí los archivos o carpetas que querés indexar para obtener sugerencias contextuales.
        </p>

        {needsReauth && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Tu conexión con Drive expiró</p>
            <p style={styles.emptyHint}>
              Necesitás volver a conectar tu cuenta de Google Drive para acceder a tus archivos.
            </p>
            <button
              style={{ ...styles.loadMoreButton, marginTop: '1rem', color: 'var(--accent-default)', borderColor: 'var(--accent-default)' }}
              onClick={() => {
                onCancel();
                onReauthRequired?.();
              }}
            >
              Re-conectar Google Drive
            </button>
          </div>
        )}

        {error && !needsReauth && <p style={styles.error}>{error}</p>}

        {!needsReauth && <div style={styles.fileList}>
          {visibleFiles.map((file) => (
            <label key={file.id} style={styles.fileItem}>
              <input
                type="checkbox"
                checked={selected.has(file.id)}
                onChange={() => toggleSelect(file.id)}
                style={styles.checkbox}
              />
              <span style={styles.fileIcon}>{isFolder(file.mimeType) ? '📁' : '📄'}</span>
              <span style={styles.fileName}>{file.name}</span>
            </label>
          ))}

          {visibleFiles.length === 0 && !loading && (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>No se encontraron archivos compatibles.</p>
              <p style={styles.emptyHint}>
                {files.length > 0
                  ? 'Los archivos en Drive no son de un formato compatible (PDF, DOCX, TXT, Markdown). Verificá que los archivos estén en un formato soportado.'
                  : 'Esto puede pasar si la conexión con Drive está desactualizada. Cerrá este panel y reconectá tu Google Drive desde el dashboard.'}
              </p>
            </div>
          )}
        </div>}

        {!needsReauth && nextPageToken && (
          <button
            style={styles.loadMoreButton}
            onClick={() => fetchFiles(nextPageToken)}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Cargar más archivos'}
          </button>
        )}

        {!needsReauth && loading && files.length === 0 && <p style={styles.loadingText}>Cargando archivos...</p>}

        {!needsReauth && (
          <div style={styles.footer}>
            <button style={styles.cancelButton} onClick={onCancel}>
              Cancelar
            </button>
            <button
              style={styles.confirmButton}
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              Indexar {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'oklch(0% 0 0 / 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    width: '100%',
    maxWidth: '520px',
    maxHeight: '80vh',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1.5rem 0',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  description: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    padding: '0.75rem 1.5rem',
    margin: 0,
    lineHeight: 1.5,
  },
  error: {
    color: 'var(--error)',
    fontSize: '0.8rem',
    padding: '0 1.5rem',
    margin: 0,
  },
  fileList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 1.5rem',
    maxHeight: '40vh',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    borderBottom: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  checkbox: {
    accentColor: 'var(--accent-default)',
  },
  fileIcon: {
    fontSize: '1rem',
  },
  fileName: {
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyState: {
    padding: '2rem 0',
    textAlign: 'center' as const,
  },
  emptyTitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 500,
    margin: '0 0 0.5rem',
  },
  emptyHint: {
    color: 'var(--text-tertiary)',
    fontSize: '0.8rem',
    lineHeight: 1.5,
    margin: 0,
    padding: '0 1rem',
  },
  loadMoreButton: {
    margin: '0.5rem 1.5rem',
    padding: '0.5rem',
    fontSize: '0.8rem',
    color: 'var(--accent-default)',
    backgroundColor: 'transparent',
    border: '1px solid var(--accent-muted)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    textAlign: 'center',
    padding: '1.5rem',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--border-subtle)',
  },
  cancelButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  confirmButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-on-accent)',
    backgroundColor: 'var(--accent-default)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
};
