import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { IndexingStatus } from '../components/IndexingStatus';
import { DrivePicker } from '../components/DrivePicker';
import { useSources } from '../hooks/useSources';
import { getCsrfToken } from '../auth/csrf';
import envConfig from '../config';

/**
 * Dashboard page — main authenticated view.
 * Shows workspace info, Drive connection status, indexing status.
 * All copy in Rioplatense Spanish per A-024.
 *
 * Key behaviors:
 * - Reads sources via useSources() to know if Drive is already connected
 * - One-shot refetch when landing with ?source=connected after OAuth redirect
 * - Shows DrivePicker modal when user clicks "Seleccionar archivos"
 * - Calls POST /sources/:id/select to save selected files
 */
export function DashboardPage() {
  const { workspace } = useAuth();
  const [searchParams] = useSearchParams();
  const { sources, isLoading: sourcesLoading, refetch } = useSources();
  const [showPicker, setShowPicker] = useState(false);
  const [selectSuccess, setSelectSuccess] = useState(false);
  const hasHandledRedirect = useRef(false);

  // T-3.3: One-shot refetch when returning from Google OAuth
  useEffect(() => {
    if (searchParams.get('source') === 'connected' && !hasHandledRedirect.current) {
      hasHandledRedirect.current = true;
      refetch();
      // Clean URL so back-navigation doesn't trigger again
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams, refetch]);

  const connectedSource = sources.find((s) => s.status === 'connected' || s.status === 'syncing');

  const handleConnectDrive = () => {
    window.location.href = `${envConfig.apiUrl}/sources/drive/connect`;
  };

  // T-3.5: handler that calls POST /sources/:id/select — guarded against double submit
  const isSubmitting = useRef(false);
  const handleSelectFiles = async (fileIds: string[], rootLocator: string) => {
    if (!connectedSource || isSubmitting.current) return;
    isSubmitting.current = true;
    setShowPicker(false);

    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(
        `${envConfig.apiUrl}/sources/${connectedSource.id}/select`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify({ fileIds, rootLocator }),
        },
      );

      if (!res.ok) throw new Error('Error al guardar la selección');

      setSelectSuccess(true);
      refetch();
    } catch {
      // silently fail — the user can try again
    } finally {
      isSubmitting.current = false;
    }
  };

  return (
    <div style={styles.container}>
      <main style={styles.main}>
        {/* Workspace info */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Espacio de trabajo</h2>
          <div style={styles.infoCard}>
            <p style={styles.infoLabel}>Nombre</p>
            <p style={styles.infoValue}>{workspace?.name ?? '—'}</p>
          </div>
        </section>

        {/* Drive connection section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Fuentes de documentos</h2>

          {sourcesLoading && (
            <p style={styles.description}>Verificando conexión...</p>
          )}

          {!sourcesLoading && !connectedSource && (
            <>
              <p style={styles.description}>
                Conectá tu Google Drive para indexar documentos y obtener sugerencias
                contextuales mientras escribís.
              </p>
              <button style={styles.connectButton} onClick={handleConnectDrive}>
                Conectar Google Drive
              </button>
            </>
          )}

          {!sourcesLoading && connectedSource && (
            <>
              <div style={styles.connectedBadge}>
                <span style={styles.connectedDot} />
                <span style={styles.connectedText}>
                  Google Drive conectado
                  {connectedSource.rootLocator ? ` · ${connectedSource.rootLocator}` : ''}
                </span>
              </div>

              {selectSuccess && (
                <p style={styles.successMessage}>
                  ¡Listo! Los archivos fueron enviados a indexación.
                </p>
              )}

              <button
                style={styles.selectButton}
                onClick={() => setShowPicker(true)}
              >
                Seleccionar archivos para indexar
              </button>
            </>
          )}
        </section>

        {/* Editor section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Editor</h2>
          <p style={styles.description}>
            Abrí el editor para empezar a escribir con sugerencias contextuales
            basadas en tus documentos indexados.
          </p>
          <a href="/editor" style={styles.editorLink}>
            Abrir editor
          </a>
        </section>

        {/* Indexing status */}
        <section style={styles.section}>
          <IndexingStatus />
        </section>
      </main>

      {/* DrivePicker modal */}
      {showPicker && connectedSource && (
        <DrivePicker
          sourceId={connectedSource.id}
          onSelect={(fileIds, rootLocator) => void handleSelectFiles(fileIds, rootLocator)}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100%',
  },
  main: {
    maxWidth: '640px',
    margin: '0 auto',
    padding: '2rem 1rem',
  },
  section: {
    marginBottom: '2rem',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.5rem',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-subtle)',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 1rem',
  },
  infoCard: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'baseline',
  },
  infoLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    margin: 0,
  },
  infoValue: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    margin: 0,
  },
  description: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 1rem',
  },
  connectButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: 'var(--accent-default)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  connectedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  connectedDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    flexShrink: 0,
  },
  connectedText: {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  selectButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: 'var(--accent-default)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  successMessage: {
    fontSize: '0.875rem',
    color: '#10b981',
    margin: '0 0 1rem',
    fontWeight: 500,
  },
  editorLink: {
    display: 'inline-block',
    padding: '0.625rem 1.25rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: 'var(--accent-default)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    cursor: 'pointer',
  },
};
