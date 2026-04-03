import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { AssistEditor } from '../editor/AssistEditor';

/**
 * Editor page — main writing interface with inline completions.
 * All copy in Rioplatense Spanish per A-065.
 */
export function EditorPage() {
  const { user, logout } = useAuth();
  const { toggleTheme, isDark } = useTheme();

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
          <button 
            style={styles.themeToggle} 
            onClick={toggleTheme}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
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
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 2rem',
    backgroundColor: 'var(--bg-elevated)',
    borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  backLink: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  },
  logo: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  email: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  themeToggle: {
    padding: '0.375rem 0.75rem',
    fontSize: '1rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  logoutButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    color: 'var(--error)',
    backgroundColor: 'transparent',
    border: '1px solid var(--error)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    padding: '1rem',
  },
  footer: {
    padding: '0.75rem 2rem',
    backgroundColor: 'var(--bg-elevated)',
    borderTop: '1px solid var(--border-subtle)',
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  footerHint: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
  },
};
