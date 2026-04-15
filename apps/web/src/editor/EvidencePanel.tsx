import type { EvidenceHit } from './use-evidence';

/**
 * Evidence panel sidebar — displays retrieval sources for the current completion (A-081, A-082).
 *
 * Shows:
 * - Source document title and type
 * - Relevance score (cosine similarity percentage)
 * - Text excerpt from the matching chunk
 * - Grounded/ungrounded status indicator
 *
 * All copy in Spanish (es-ES) per spec.
 */

interface EvidencePanelProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Toggle the panel */
  onToggle: () => void;
  /** Whether the completion is grounded in sources */
  isGrounded: boolean;
  /** Retrieval hits to display */
  hits: EvidenceHit[];
  /** Whether the completion came from the structural fast-path */
  structuralMatch?: boolean;
  /** Detected document type (e.g. CONTRATO, DEMANDA) */
  docType?: string | null;
}

export function EvidencePanel({ isOpen, onToggle, isGrounded, hits, structuralMatch, docType }: EvidencePanelProps) {
  // Botón siempre visible — el usuario debe poder ver qué fuentes se usaron (o que no hay)
  const hasHits = hits.length > 0;

  if (!isOpen) {
    return (
      <button
        style={styles.toggleButton}
        onClick={onToggle}
        title={hasHits ? `Ver fuentes de evidencia (${hits.length})` : 'Ver fuentes de evidencia'}
        aria-label="Abrir panel de evidencia"
      >
        <span style={styles.toggleIcon}>📚</span>
        {hasHits && (
          <span style={styles.badge}>{hits.length}</span>
        )}
      </button>
    );
  }

  return (
    <aside style={styles.panel} role="complementary" aria-label="Panel de evidencia">
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Fuentes de evidencia</h3>
        <button
          style={styles.closeButton}
          onClick={onToggle}
          aria-label="Cerrar panel de evidencia"
        >
          ✕
        </button>
      </div>

      {/* Grounding indicator */}
      <div style={{
        ...styles.groundingBadge,
        backgroundColor: 'var(--bg-secondary)',
        borderColor: structuralMatch ? 'var(--accent-info)' : (isGrounded ? 'var(--success)' : 'var(--warning)'),
        color: structuralMatch ? 'var(--accent-info)' : (isGrounded ? 'var(--success)' : 'var(--warning)'),
      }}>
        <span>{structuralMatch ? '📋' : (isGrounded ? '✓' : '○')}</span>
        <span>
          {structuralMatch
            ? `Completando desde tu documento: ${hits[0]?.documentTitle ?? 'tu documento'}`
            : (isGrounded ? 'Respuesta basada en tus documentos' : 'Respuesta sin evidencia documental')
          }
        </span>
      </div>

      {/* Evidence hits list */}
      {hits.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>
            No se encontraron fuentes relevantes para esta sugerencia.
          </p>
        </div>
      ) : (
        <ul style={styles.hitList}>
          {hits.map((hit) => (
            <EvidenceHitCard key={hit.chunkId} hit={hit} isStructural={structuralMatch === true} />
          ))}
        </ul>
      )}
    </aside>
  );
}

/**
 * Individual evidence hit card (A-082).
 *
 * Shows title, source type, relevance score, and excerpt.
 */
function EvidenceHitCard({ hit, isStructural }: { hit: EvidenceHit; isStructural?: boolean }) {
  const relevancePercent = Math.round(hit.similarity * 100);

  // Color based on relevance
  const getRelevanceColor = (): string => {
    if (relevancePercent >= 85) return 'var(--success)';
    if (relevancePercent >= 75) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <li style={{
      ...styles.hitCard,
      ...(isStructural ? { borderLeft: '3px solid var(--accent-info)' } : {}),
    }}>
      <div style={styles.hitHeader}>
        <div style={styles.hitTitleRow}>
          <span style={styles.hitRank}>#{hit.rank}</span>
          <span style={styles.hitTitle}>
            {hit.documentTitle ?? 'Documento sin título'}
          </span>
        </div>
        <span style={{
          ...styles.relevanceBadge,
          color: getRelevanceColor(),
          borderColor: getRelevanceColor(),
        }}>
          {relevancePercent}%
        </span>
      </div>

      <div style={styles.hitMeta}>
        <span style={styles.metaLabel}>Tipo:</span>
        <span style={styles.metaValue}>
          {isStructural ? '📋 Estructura directa' : 'Documento'}
        </span>
      </div>

      <p style={styles.hitExcerpt}>
        {hit.excerpt}
        {hit.excerpt.length >= 200 && '…'}
      </p>
    </li>
  );
}

// ──────────────────────────────────────────
// Styles
// ──────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  toggleButton: {
    position: 'fixed',
    right: '1rem',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-elevated)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-md)',
    zIndex: 10,
  },
  toggleIcon: {
    fontSize: '1.25rem',
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-default)',
    color: 'var(--text-on-accent)',
    fontSize: '0.7rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: '340px',
    height: '100%',
    backgroundColor: 'var(--bg-elevated)',
    borderLeft: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.875rem 1rem',
    borderBottom: '1px solid var(--border-subtle)',
  },
  title: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  closeButton: {
    width: '28px',
    height: '28px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'var(--text-tertiary)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groundingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    margin: '0.75rem 1rem 0',
    borderRadius: 'var(--radius-md)',
    border: '1px solid',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
  emptyText: {
    fontSize: '0.825rem',
    color: 'var(--text-tertiary)',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: 0,
  },
  hitList: {
    flex: 1,
    overflow: 'auto',
    padding: '0.75rem 1rem',
    margin: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  hitCard: {
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-secondary)',
  },
  hitHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginBottom: '0.375rem',
  },
  hitTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    flex: 1,
    minWidth: 0,
  },
  hitRank: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--accent-default)',
    flexShrink: 0,
  },
  hitTitle: {
    fontSize: '0.825rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  relevanceBadge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.125rem 0.375rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid',
    flexShrink: 0,
  },
  hitMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    marginBottom: '0.375rem',
  },
  metaLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },
  metaValue: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
  },
  hitExcerpt: {
    fontSize: '0.775rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
};
