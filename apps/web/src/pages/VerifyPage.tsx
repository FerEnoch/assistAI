import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';

/**
 * Verify page — handles magic-link token verification.
 * Redirects to /dashboard on success, shows error on failure.
 * All copy in Spanish per A-024.
 */
export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyToken, isLoading, error } = useAuth();
  const verifiedRef = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token || verifiedRef.current) return;

    verifiedRef.current = true;

    verifyToken(token).then((success) => {
      if (success) {
        navigate('/dashboard', { replace: true });
      }
    });
  }, [searchParams, verifyToken, navigate]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>AssistAI</h1>

        {isLoading && (
          <div style={styles.loadingBox}>
            <p style={styles.loadingText}>Verificando tu enlace de acceso...</p>
            <div style={styles.spinner} />
          </div>
        )}

        {error && (
          <div style={styles.errorBox}>
            <h2 style={styles.errorTitle}>No se pudo verificar</h2>
            <p style={styles.errorText}>{error}</p>
            <p style={styles.hintText}>
              El enlace puede haber expirado. Solicitá uno nuevo desde la página de inicio de sesión.
            </p>
            <button style={styles.button} onClick={() => navigate('/auth/login', { replace: true })}>
              Volver al inicio de sesión
            </button>
          </div>
        )}

        {!isLoading && !error && !searchParams.get('token') && (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>No se encontró un token de verificación.</p>
            <button style={styles.button} onClick={() => navigate('/auth/login', { replace: true })}>
              Ir a iniciar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8f9fa',
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '2.5rem 2rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 2rem',
  },
  loadingBox: {
    padding: '2rem 0',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '1rem',
    margin: '0 0 1rem',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  errorBox: {
    padding: '1rem 0',
  },
  errorTitle: {
    color: '#dc2626',
    fontSize: '1.125rem',
    margin: '0 0 0.75rem',
  },
  errorText: {
    color: '#4b5563',
    fontSize: '0.9rem',
    margin: '0 0 1rem',
    lineHeight: 1.5,
  },
  hintText: {
    color: '#9ca3af',
    fontSize: '0.8rem',
    margin: '0 0 1.5rem',
    lineHeight: 1.5,
  },
  button: {
    padding: '0.625rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
