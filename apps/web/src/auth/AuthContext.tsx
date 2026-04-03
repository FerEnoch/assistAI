import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import envConfig from '../config';
import { getCsrfToken, invalidateCsrfToken } from './csrf';

interface AuthUser {
  id: string;
  email: string;
  locale: string;
}

interface AuthWorkspace {
  id: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  isLoading: boolean;
  error: string | null;
  sendMagicLink: (email: string) => Promise<boolean>;
  devLogin: (email: string) => Promise<boolean>;
  verifyToken: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<AuthWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true to check session on mount
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Check session on mount — restore user if valid session exists
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`${envConfig.apiUrl}/auth/me`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user && data.workspace) {
            setUser(data.user);
            setWorkspace(data.workspace);
          }
        }
      } catch {
        // No session — user stays logged out
      } finally {
        setIsLoading(false);
      }
    }

    checkSession();
  }, []);

  const sendMagicLink = useCallback(async (email: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${envConfig.apiUrl}/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Support both old format { message: ... } and new format { error: { message: ... } }
        const message = data.error?.message ?? data.message ?? 'Error en la solicitud';
        throw new Error(message);
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const devLogin = useCallback(async (email: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${envConfig.apiUrl}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Support both old format { message: ... } and new format { error: { message: ... } }
        const message = data.error?.message ?? data.message ?? 'Error en login dev';
        throw new Error(message);
      }

      const data = await res.json();
      setUser(data.user);
      setWorkspace(data.workspace);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyToken = useCallback(async (token: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${envConfig.apiUrl}/auth/verify?token=${encodeURIComponent(token)}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Support both old format { message: ... } and new format { error: { message: ... } }
        const message = data.error?.message ?? data.message ?? 'Enlace inválido o expirado';
        throw new Error(message);
      }

      const data = await res.json();
      setUser(data.user);
      setWorkspace(data.workspace);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de verificación');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const csrfToken = await getCsrfToken();

      await fetch(`${envConfig.apiUrl}/auth/session`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'x-csrf-token': csrfToken,
        },
      });
    } catch {
      // Logout even if the request fails
    } finally {
      setUser(null);
      setWorkspace(null);
      invalidateCsrfToken();
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, workspace, isLoading, error, sendMagicLink, devLogin, verifyToken, logout, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
