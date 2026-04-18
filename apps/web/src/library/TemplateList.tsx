import type { Template } from '../hooks/useTemplates';

interface TemplateListProps {
  templates: Template[];
  expandedTemplateId: string | null;
  onEdit: (template: Template) => void;
  onDelete: (id: string) => void;
  onToggleCorpus: (id: string) => void;
}

/**
 * Renders the list of template cards with edit/delete/corpus actions.
 * Extracted from LibraryPage for reusability.
 */
export function TemplateList({
  templates,
  expandedTemplateId,
  onEdit,
  onDelete,
  onToggleCorpus,
}: TemplateListProps) {
  if (templates.length === 0) return null;

  return (
    <div style={s.templateList}>
      {templates.map((t) => (
        <div
          key={t.id}
          style={{
            ...s.templateCard,
            ...(expandedTemplateId === t.id ? s.templateCardExpanded : {}),
          }}
        >
          <div style={s.templateCardBody}>
            <div style={s.templateCardLeft}>
              <span style={s.docTypeBadge}>{t.docType ?? 'DOC'}</span>
              <div>
                <p style={s.templateName}>{t.name}</p>
                <button
                  style={s.sectionTag}
                  onClick={() => onToggleCorpus(t.id)}
                  title="Ver corpus"
                >
                  {t.sections.length} secciones
                </button>
              </div>
            </div>
            <div style={s.templateCardRight}>
              <button style={s.iconBtn} onClick={() => onEdit(t)} title="Editar">✎</button>
              <button style={s.iconBtn} onClick={() => onDelete(t.id)} title="Eliminar">🗑</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  templateList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  templateCard: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  },
  templateCardExpanded: {
    border: '1px solid var(--accent-muted)',
  },
  templateCardBody: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-4) var(--space-6)',
  },
  templateCardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    minWidth: 0,
  },
  templateCardRight: {
    display: 'flex',
    gap: 'var(--space-2)',
    flexShrink: 0,
  },
  docTypeBadge: {
    display: 'inline-block',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--text-on-accent)',
    backgroundColor: 'var(--accent-default)',
    borderRadius: 'var(--radius-pill)',
    padding: '0.2rem 0.7rem',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
  },
  templateName: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  sectionTag: {
    display: 'inline-block',
    fontSize: '0.75rem',
    color: 'var(--accent-default)',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.1rem 0',
    marginTop: '0.25rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
  },
  iconBtn: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
  },
};
