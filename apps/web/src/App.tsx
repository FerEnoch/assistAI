import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { LoginPage } from './pages/LoginPage';
import { VerifyPage } from './pages/VerifyPage';
import { DashboardPage } from './pages/DashboardPage';
import { EditorPage } from './pages/EditorPage';
import { LibraryPage } from './pages/LibraryPage';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { useAuth as useAuthContext } from './auth/AuthContext';

/**
 * Global header with theme toggle — visible on all authenticated pages.
 */
function AppHeader() {
  const { user, logout } = useAuthContext();
  const { toggleTheme, isDark } = useTheme();

  return (
    <header style={styles.header}>
      <div style={styles.headerLeft}>
        <a href="/dashboard" style={styles.logo}>AssistAI</a>
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
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthContext();
  
  // Wait for session check to complete before redirecting
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <p>Cargando...</p>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

/**
 * Layout wrapper for authenticated pages — includes global header.
 */
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.layout}>
      <AppHeader />
      <main style={styles.main}>{children}</main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="*" element={<Navigate to="/auth/login" replace />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/verify" element={<VerifyPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AuthLayout>
                    <DashboardPage />
                  </AuthLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/library"
              element={
                <ProtectedRoute>
                  <AuthLayout>
                    <LibraryPage />
                  </AuthLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/editor"
              element={
                <ProtectedRoute>
                  <EditorPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
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
  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textDecoration: 'none',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  email: {
    fontSize: '0.875rem',
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
    fontSize: '0.8rem',
    color: 'var(--error)',
    backgroundColor: 'transparent',
    border: '1px solid var(--error)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
};
