interface DocumentTypeBadgeProps {
  docType: string | null;
}

/**
 * Chip badge that displays the detected document type (e.g. CONTRATO, DEMANDA).
 * Returns null when no type is detected — the badge should only appear on detection.
 */
export function DocumentTypeBadge({ docType }: DocumentTypeBadgeProps) {
  if (!docType) return null;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.125rem 0.5rem',
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--accent-default)',
      border: '1px solid var(--accent-default)',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'transparent',
    }}>
      {docType}
    </span>
  );
}
