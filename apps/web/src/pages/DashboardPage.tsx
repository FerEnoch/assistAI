import { useAuth } from '../auth/AuthContext';
import { IndexingStatus } from '../components/IndexingStatus';
import envConfig from '../config';

/**
 * Dashboard page — main authenticated view.
 * Shows workspace info, Drive connection button, indexing status, and logout.
 * All copy in Spanish per A-024.
 */
export function DashboardPage() {
  const { user, workspace, logout } = useAuth();

  const handleConnectDrive = () => {
    // Redirect to backend which redirects to Google OAuth
    window.location.href = `${envConfig.apiUrl}/sources/drive/connect`;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>AssistAI</h1>
        <div style={styles.headerRight}>
          <span style={styles.email}>{user?.email}</span>
          <button style={styles.logoutButton} onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

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
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8f9fa',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e7eb',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  email: {
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  logoutButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.8rem',
    color: '#dc2626',
    backgroundColor: 'transparent',
    border: '1px solid #dc2626',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  main: {
    maxWidth: '640px',
    margin: '0 auto',
    padding: '2rem 1rem',
  },
  section: {
    marginBottom: '2rem',
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '1.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#1a1a2e',
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
    color: '#6b7280',
    margin: 0,
  },
  infoValue: {
    fontSize: '0.9rem',
    color: '#111827',
    margin: 0,
  },
  description: {
    fontSize: '0.875rem',
    color: '#6b7280',
    lineHeight: 1.6,
    margin: '0 0 1rem',
  },
  connectButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  editorLink: {
    display: 'inline-block',
    padding: '0.625rem 1.25rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#7c3aed',
    border: 'none',
    borderRadius: '8px',
    textDecoration: 'none',
    cursor: 'pointer',
  },
};
