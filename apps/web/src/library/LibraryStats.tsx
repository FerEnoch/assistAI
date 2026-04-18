import type { CorpusStats } from '../hooks/useCorpusStats';

const DOC_TYPE_COLORS: Record<string, string> = {
  CONTRATO: '#2a2420',
  DEMANDA: '#6b6560',
};
const DEFAULT_BAR_COLOR = '#9e9691';

function getBarColor(docType: string): string {
  return DOC_TYPE_COLORS[docType] ?? DEFAULT_BAR_COLOR;
}

interface LibraryStatsProps {
  stats: CorpusStats | null;
  isLoading: boolean;
}

/**
 * Corpus stats card — displays total documents, chunks, and doc-type breakdown.
 * Extracted from LibraryPage for reusability.
 */
export function LibraryStats({ stats, isLoading }: LibraryStatsProps) {
  if (isLoading) {
    return (
      <div style={s.card}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Cargando estadísticas...</p>
      </div>
    );
  }

  const total = stats?.totalDocuments ?? 0;
  const chunks = stats?.totalChunks ?? 0;
  const rawBreakdown = stats?.docTypeBreakdown ?? {};
  const totalBreakdown = Object.values(rawBreakdown).reduce((sum, c) => sum + c, 0);
  const breakdown = Object.entries(rawBreakdown).map(([docType, count]) => ({
    docType,
    count,
    percentage: totalBreakdown > 0 ? Math.round((count / totalBreakdown) * 100) : 0,
  }));

  return (
    <div style={{ ...s.card, position: 'relative' as const }}>
      <h3 style={s.statsTitle}>Tu corpus</h3>

      <p style={s.bigNumber}>{total.toLocaleString()}</p>
      <p style={s.statsLabel}>Total Documentos Indexados</p>

      <p style={{ ...s.bigNumber, marginTop: 'var(--space-4)' }}>{chunks.toLocaleString()}</p>
      <p style={s.statsLabel}>Total Chunks</p>

      {breakdown.length > 0 && (
        <>
          <hr style={s.divider} />
          <p style={{ ...s.statsLabel, marginBottom: 'var(--space-3)', fontWeight: 600 }}>
            Distribución por tipos
          </p>
          {breakdown.map((item) => (
            <div key={item.docType} style={{ marginBottom: 'var(--space-3)' }}>
              <div style={s.breakdownRow}>
                <span style={s.breakdownType}>{item.docType}</span>
                <span style={s.breakdownBadge}>{item.percentage}%</span>
                <span style={s.breakdownCount}>{item.count}</span>
              </div>
              <div style={s.barTrack}>
                <div style={{ height: '100%', width: `${item.percentage}%`, backgroundColor: getBarColor(item.docType), borderRadius: 'var(--radius-pill)', transition: 'width var(--duration-normal) var(--ease-out)' }} />
              </div>
            </div>
          ))}
        </>
      )}

      <button style={s.helpFab} title="Ayuda">?</button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
  },
  statsTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 var(--space-4)',
  },
  bigNumber: {
    fontFamily: 'var(--font-serif)',
    fontSize: '2.75rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.1,
    margin: 0,
  },
  statsLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    margin: '0.25rem 0 0',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid var(--border-subtle)',
    margin: 'var(--space-6) 0',
  },
  breakdownRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-1)',
  },
  breakdownType: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    flex: 1,
  },
  breakdownBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--text-on-accent)',
    backgroundColor: 'var(--accent-default)',
    borderRadius: 'var(--radius-pill)',
    padding: '0.1rem 0.5rem',
  },
  breakdownCount: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    minWidth: '2rem',
    textAlign: 'right',
  },
  barTrack: {
    height: '6px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-pill)',
    overflow: 'hidden',
  },
  helpFab: {
    position: 'absolute',
    bottom: 'var(--space-4)',
    right: 'var(--space-4)',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-default)',
    color: 'var(--text-on-accent)',
    fontSize: '1rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-md)',
  },
};
