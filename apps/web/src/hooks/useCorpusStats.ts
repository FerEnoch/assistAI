import { useState, useEffect, useCallback } from 'react';
import envConfig from '../config';

export interface CorpusStats {
  totalDocuments: number;
  totalChunks: number;
  totalTemplates: number;
  docTypeBreakdown: Record<string, number>;
}

export interface UseCorpusStatsReturn {
  stats: CorpusStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches corpus stats from GET /documents/stats.
 * Same pattern as useSources.
 */
export function useCorpusStats(): UseCorpusStatsReturn {
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${envConfig.apiUrl}/library/stats`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al cargar estadísticas del corpus');
      const data = (await res.json()) as CorpusStats;
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}
