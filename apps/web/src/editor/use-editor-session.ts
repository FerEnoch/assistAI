import { useState, useEffect } from 'react';
import envConfig from '../config';
import { getCsrfToken } from '../auth/csrf';

export interface EditorSessionState {
  sessionId: string | null;
  isCreatingSession: boolean;
}

/**
 * Hook that encapsulates editor session initialization (A-061).
 *
 * On mount:
 * 1. Fetches CSRF token via getCsrfToken()
 * 2. POSTs to /completions/session to create a new session
 * 3. Exposes sessionId and loading state
 *
 * Includes a cancellation flag to prevent state updates after unmount.
 */
export function useEditorSession(): EditorSessionState {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function createSession() {
      try {
        const csrfToken = await getCsrfToken();

        const res = await fetch(`${envConfig.apiUrl}/completions/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({}),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as { sessionId: string };

        if (!cancelled) {
          setSessionId(data.sessionId);
        }
      } catch (err) {
        console.error('[Editor] Failed to create session:', err);
      } finally {
        if (!cancelled) {
          setIsCreatingSession(false);
        }
      }
    }

    void createSession();
    return () => { cancelled = true; };
  }, []);

  return { sessionId, isCreatingSession };
}
