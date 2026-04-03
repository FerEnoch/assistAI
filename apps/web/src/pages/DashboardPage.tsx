import { useAuth } from '../auth/AuthContext';
import { IndexingStatus } from '../components/IndexingStatus';
import envConfig from '../config';

/**
 * Dashboard page — main authenticated view.
 * Shows workspace info, Drive connection button, indexing status.
 * All copy in Spanish per A-024.
 */
export function DashboardPage() {
  const { workspace } = useAuth();

  const handleConnectDrive = () => {
    // Redirect to backend which redirects to Google OAuth
    window.location.href = `${envConfig.apiUrl}/sources/drive/connect`;
  };

  return (
    <div style={styles.container}>
      <main style={styles.main}>
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Espacio de trabajo</h2>
          <div style={styles.infoCard}>
            <p style={styles.infoLabel}>Nombre</p>
            <p style={styles.infoValue}>{workspace?.name ?? '—'}</p>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Fuentes de documentos</h2>
          <p style={styles.description}>
            Conectá tu Google Drive para indexar documentos legales y obtener sugerencias
            contextuales mientras escribís.
          </p>
          <button style={styles.connectButton} onClick={handleConnectDrive}>
            Conectar Google Drive
          </button>
        </section>

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

        <section style={styles.section}>
          <IndexingStatus />
        </section>
      </main>
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
