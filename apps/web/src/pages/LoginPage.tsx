import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import envConfig from '../config';

/**
 * Login page — magic-link form.
 * All copy in Spanish per A-024.
 * 
 * Dev mode: shows a direct login button when dev mode is enabled.
 */
export function LoginPage() {
  const { sendMagicLink, devLogin, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const devMode = envConfig.devMode;
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (devMode) {
      const success = await devLogin(email);
      if (success) {
        // AuthContext will handle redirect via useAuth in App.tsx
      }
    } else {
      const success = await sendMagicLink(email);
      if (success) {
        setSent(true);
      }
    }
  };

  const handleDevLogin = async () => {
    clearError();
    // Use a default dev email or the one in the input
    const devEmail = email || 'dev@localhost';
    await devLogin(devEmail);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>AssistAI</h1>
        <p style={styles.subtitle}>
          Asistente de escritura con IA para profesionales del derecho
        </p>

        {devMode && (
          <div style={styles.devBanner}>
            <span style={styles.devBadge}>DEV</span>
            <span>Modo desarrollo activado</span>
            <button
              type="button"
              style={styles.devButton}
              onClick={handleDevLogin}
              disabled={isLoading}
            >
              {isLoading ? 'Ingresando...' : 'Iniciar sesión directo'}
            </button>
          </div>
        )}

        {sent ? (
          <div style={styles.successBox}>
            <h2 style={styles.successTitle}>Revisá tu correo</h2>
            <p style={styles.successText}>
              Enviamos un enlace de acceso a <strong>{email}</strong>.
              <br />
              El enlace expira en 15 minutos.
            </p>
            <button
              style={styles.linkButton}
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
            >
              Usar otro correo electrónico
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <label htmlFor="email" style={styles.label}>
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              autoFocus
              disabled={isLoading}
              style={styles.input}
            />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" disabled={isLoading || !email} style={styles.button}>
              {isLoading ? 'Enviando...' : 'Enviar enlace de acceso'}
            </button>

            <p style={styles.hint}>
              Te enviaremos un enlace seguro para iniciar sesión sin contraseña.
            </p>
          </form>
        )}
      </div>

      <p style={styles.footer}>
        AssistAI — Tu asistente legal con inteligencia artificial
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
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
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 0.5rem',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#6b7280',
    textAlign: 'center' as const,
    margin: '0 0 2rem',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  button: {
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.875rem',
    margin: 0,
  },
  hint: {
    fontSize: '0.8rem',
    color: '#9ca3af',
    textAlign: 'center' as const,
    margin: 0,
  },
  successBox: {
    textAlign: 'center' as const,
    padding: '1rem 0',
  },
  successTitle: {
    fontSize: '1.25rem',
    color: '#059669',
    margin: '0 0 1rem',
  },
  successText: {
    color: '#4b5563',
    lineHeight: 1.6,
    margin: '0 0 1.5rem',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    fontSize: '0.875rem',
    textDecoration: 'underline',
  },
  footer: {
    marginTop: '2rem',
    fontSize: '0.75rem',
    color: '#9ca3af',
  },
  devBanner: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    marginBottom: '1.5rem',
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    border: '1px solid #f59e0b',
  },
  devBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#fff',
    backgroundColor: '#f59e0b',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
  },
  devButton: {
    padding: '0.6rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#f59e0b',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
