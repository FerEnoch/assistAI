import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import envConfig from '../config';

export interface Source {
  id: string;
  workspaceId: string;
  sourceType: 'google_drive';
  status: 'connected' | 'syncing' | 'error' | 'disconnected' | 'needs_reauth';
  connectedAccountEmail: string | null;
  rootLocator: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UseSourcesReturn {
  sources: Source[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches workspace sources from GET /sources.
 * Follows the same pattern as IndexingStatus (useState + useEffect + useCallback).
 */
export function useSources(): UseSourcesReturn {
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const hasHandledRedirect = useRef(false);

  const fetchSources = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${envConfig.apiUrl}/sources`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Error al cargar las fuentes de datos');
      }

      const data = (await res.json()) as Source[];
      setSources(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSources();
  }, [fetchSources]);

  // One-shot refetch when returning from Google OAuth (?source=connected)
  useEffect(() => {
    if (searchParams.get('source') === 'connected' && !hasHandledRedirect.current) {
      hasHandledRedirect.current = true;
      void fetchSources();
      window.history.replaceState({}, '', '/library');
    }
  }, [searchParams, fetchSources]);

  return { sources, isLoading, error, refetch: fetchSources };
}

/**
 * Pure fetch function — extracted for testability without React hooks.
 * @internal
 */
export async function fetchSourcesFromApi(apiUrl: string, fetchFn: typeof fetch = fetch): Promise<Source[]> {
  const res = await fetchFn(`${apiUrl}/sources`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Error al cargar las fuentes de datos');
  }
  return (await res.json()) as Source[];
}
