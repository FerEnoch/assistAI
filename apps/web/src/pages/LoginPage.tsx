import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import envConfig from '../config';

/**
 * Login page — magic-link form.
 * All copy in Spanish per A-024.
 * 
 * Dev mode: shows a direct login button when dev mode is enabled.
 */
export function LoginPage() {
  const navigate = useNavigate();
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
        navigate('/dashboard');
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
    const devEmail = email ?? '';
    const success = await devLogin(devEmail);
    if (success) {
      navigate('/dashboard');
    }
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
    backgroundColor: 'var(--bg-primary)',
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-lg)',
    padding: '2.5rem 2rem',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-subtle)',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    fontFamily: 'var(--font-serif)',
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
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
    color: 'var(--text-primary)',
  },
  input: {
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: 'border-color 0.15s',
    backgroundColor: '#ffffff',
    color: 'var(--text-primary)',
  },
  button: {
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    color: 'var(--text-on-accent)',
    backgroundColor: 'var(--accent-default)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  error: {
    color: 'var(--error)',
    fontSize: '0.875rem',
    margin: 0,
  },
  hint: {
    fontSize: '0.8rem',
    color: 'var(--text-tertiary)',
    textAlign: 'center' as const,
    margin: 0,
  },
  successBox: {
    textAlign: 'center' as const,
    padding: '1rem 0',
  },
  successTitle: {
    fontSize: '1.25rem',
    color: 'var(--success)',
    margin: '0 0 1rem',
  },
  successText: {
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 1.5rem',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-default)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    textDecoration: 'underline',
  },
  footer: {
    marginTop: '2rem',
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
  },
  devBanner: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    marginBottom: '1.5rem',
    backgroundColor: 'var(--warning)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-default)',
  },
  devBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-on-accent)',
    backgroundColor: 'var(--accent-default)',
    padding: '0.15rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    textTransform: 'uppercase' as const,
  },
  devButton: {
    padding: '0.6rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-on-accent)',
    backgroundColor: 'var(--accent-default)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
};
