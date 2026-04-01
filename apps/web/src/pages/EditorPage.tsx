import { useAuth } from '../auth/AuthContext';
import { AssistEditor } from '../editor/AssistEditor';
import envConfig from '../config';

/**
 * Editor page — main writing interface with inline completions.
 * All copy in Rioplatense Spanish per A-065.
 */
export function EditorPage() {
  const { user, logout } = useAuth();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <a href="/dashboard" style={styles.backLink}>
            &larr; Panel
          </a>
          <h1 style={styles.logo}>AssistAI Editor</h1>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.email}>{user?.email}</span>
          <button style={styles.logoutButton} onClick={logout}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <AssistEditor />
      </main>

      <footer style={styles.footer}>
        <span style={styles.footerHint}>
          Tab: aceptar sugerencia &middot; Esc: descartar &middot;
          Las sugerencias se generan automaticamente mientras escribis
        </span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8f9fa',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 2rem',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e7eb',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  backLink: {
    fontSize: '0.8rem',
    color: '#6b7280',
    textDecoration: 'none',
  },
  logo: {
    fontSize: '1.125rem',
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
    fontSize: '0.8rem',
    color: '#6b7280',
  },
  logoutButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    color: '#dc2626',
    backgroundColor: 'transparent',
    border: '1px solid #dc2626',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    maxWidth: '800px',
    width: '100%',
    margin: '1.5rem auto',
    padding: '0 1rem',
  },
  footer: {
    padding: '0.75rem 2rem',
    backgroundColor: '#fff',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center' as const,
  },
  footerHint: {
    fontSize: '0.75rem',
    color: '#9ca3af',
  },
};
