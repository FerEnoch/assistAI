import { useState, useEffect, useCallback } from 'react';
import envConfig from '../config';

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
}

/**
 * Drive file/folder picker UI (A-033).
 * Allows users to select files or folders for indexing.
 * All copy in Spanish.
 */
export function DrivePicker({ sourceId, onSelect, onCancel }: DrivePickerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

        if (!res.ok) throw new Error('Error al cargar archivos');

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
        next.add(fileId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const ids = Array.from(selected);
    const rootLocator = JSON.stringify(ids);
    onSelect(ids, rootLocator);
  };

  const isFolder = (mimeType: string) => mimeType === 'application/vnd.google-apps.folder';

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

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.fileList}>
          {files.map((file) => (
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

          {files.length === 0 && !loading && (
            <p style={styles.empty}>No se encontraron archivos.</p>
          )}
        </div>

        {nextPageToken && (
          <button
            style={styles.loadMoreButton}
            onClick={() => fetchFiles(nextPageToken)}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Cargar más archivos'}
          </button>
        )}

        {loading && files.length === 0 && <p style={styles.loadingText}>Cargando archivos...</p>}

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
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    backgroundColor: '#fff',
    borderRadius: '12px',
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
    color: '#1a1a2e',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  description: {
    fontSize: '0.8rem',
    color: '#6b7280',
    padding: '0.75rem 1.5rem',
    margin: 0,
    lineHeight: 1.5,
  },
  error: {
    color: '#dc2626',
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
    borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  checkbox: {
    accentColor: '#2563eb',
  },
  fileIcon: {
    fontSize: '1rem',
  },
  fileName: {
    color: '#374151',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  empty: {
    color: '#9ca3af',
    fontSize: '0.875rem',
    textAlign: 'center',
    padding: '2rem 0',
  },
  loadMoreButton: {
    margin: '0.5rem 1.5rem',
    padding: '0.5rem',
    fontSize: '0.8rem',
    color: '#2563eb',
    backgroundColor: 'transparent',
    border: '1px solid #2563eb',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '0.875rem',
    textAlign: 'center',
    padding: '1.5rem',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e5e7eb',
  },
  cancelButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    color: '#374151',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  confirmButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
