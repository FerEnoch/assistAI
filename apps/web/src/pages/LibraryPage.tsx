import { useState } from 'react';
import { useTemplates, type Template, type CreateTemplateInput, type TemplateSection } from '../hooks/useTemplates';
import { useCorpusStats, type DocTypeBreakdown } from '../hooks/useCorpusStats';

/* ─── Template Modal ─── */

interface TemplateModalProps {
  template: Template | null; // null = create mode
  onClose: () => void;
  onSave: (input: CreateTemplateInput) => Promise<void>;
}

function TemplateModal({ template, onClose, onSave }: TemplateModalProps) {
  const [name, setName] = useState(template?.name ?? '');
  const [docType, setDocType] = useState(template?.docType ?? 'CONTRATO');
  const [description, setDescription] = useState(template?.description ?? '');
  const [sections, setSections] = useState<Omit<TemplateSection, 'id'>[]>(
    template?.sections.map((s) => ({ name: s.name, content: s.content })) ?? [
      { name: '', content: '' },
    ],
  );
  const [saving, setSaving] = useState(false);

  const handleAddSection = () => {
    setSections([...sections, { name: '', content: '' }]);
  };

  const handleRemoveSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const handleSectionChange = (idx: number, field: 'name' | 'content', value: string) => {
    setSections(sections.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        docType,
        description: description.trim() || undefined,
        sections: sections.filter((s) => s.name.trim()),
      });
      onClose();
    } catch {
      // error handled by hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalStyles.title}>
          {template ? 'Editar Template' : 'Nuevo Template'}
        </h2>

        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Nombre</label>
          <input
            style={modalStyles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Contrato de Locación"
          />
        </div>

        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Tipo de documento</label>
          <select
            style={modalStyles.input}
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            <option value="CONTRATO">Contrato</option>
            <option value="DEMANDA">Demanda</option>
            <option value="CONTESTACION">Contestación</option>
            <option value="RECURSO">Recurso</option>
            <option value="DICTAMEN">Dictamen</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>

        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Descripción (opcional)</label>
          <textarea
            style={{ ...modalStyles.input, minHeight: '60px', resize: 'vertical' as const }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve descripción del template"
          />
        </div>

        <div style={modalStyles.sectionsHeader}>
          <label style={modalStyles.label}>Secciones</label>
          <button style={modalStyles.addSectionBtn} onClick={handleAddSection}>
            + Agregar sección
          </button>
        </div>

        <div style={modalStyles.sectionsList}>
          {sections.map((section, idx) => (
            <div key={idx} style={modalStyles.sectionItem}>
              <div style={modalStyles.sectionRow}>
                <input
                  style={{ ...modalStyles.input, flex: 1 }}
                  value={section.name}
                  onChange={(e) => handleSectionChange(idx, 'name', e.target.value)}
                  placeholder="Nombre de la sección"
                />
                {sections.length > 1 && (
                  <button
                    style={modalStyles.removeSectionBtn}
                    onClick={() => handleRemoveSection(idx)}
                    title="Eliminar sección"
                  >
                    ×
                  </button>
                )}
              </div>
              <textarea
                style={{ ...modalStyles.input, minHeight: '80px', resize: 'vertical' as const }}
                value={section.content}
                onChange={(e) => handleSectionChange(idx, 'content', e.target.value)}
                placeholder="Contenido o instrucciones para esta sección"
              />
            </div>
          ))}
        </div>

        <div style={modalStyles.actions}>
          <button style={modalStyles.cancelBtn} onClick={onClose}>
            Cancelar
          </button>
          <button
            style={{
              ...modalStyles.saveBtn,
              opacity: saving || !name.trim() ? 0.6 : 1,
            }}
            onClick={() => void handleSubmit()}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-8)',
    maxWidth: '560px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-lg)',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 var(--space-6)',
  },
  field: {
    marginBottom: 'var(--space-4)',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 'var(--space-1)',
  },
  input: {
    width: '100%',
  },
  sectionsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-3)',
    marginTop: 'var(--space-4)',
  },
  addSectionBtn: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--accent-default)',
    cursor: 'pointer',
  },
  sectionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-6)',
  },
  sectionItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    padding: 'var(--space-3)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
  },
  sectionRow: {
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'center',
  },
  removeSectionBtn: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    color: 'var(--error)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--space-3)',
  },
  cancelBtn: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-on-accent)',
    backgroundColor: 'var(--accent-default)',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
  },
};

/* ─── Progress Bar Colors ─── */

const DOC_TYPE_COLORS: Record<string, string> = {
  CONTRATO: '#2a2420',
  DEMANDA: '#6b6560',
};
const DEFAULT_BAR_COLOR = '#9e9691';

function getBarColor(docType: string): string {
  return DOC_TYPE_COLORS[docType] ?? DEFAULT_BAR_COLOR;
}

/* ─── Stats Card ─── */

function StatsCard({
  stats,
  isLoading,
}: {
  stats: { totalDocuments: number; totalChunks: number; docTypeBreakdown: DocTypeBreakdown[] } | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div style={s.card}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
          Cargando estadísticas...
        </p>
      </div>
    );
  }

  const total = stats?.totalDocuments ?? 0;
  const chunks = stats?.totalChunks ?? 0;
  const breakdown = stats?.docTypeBreakdown ?? [];

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
                <div
                  style={{
                    height: '100%',
                    width: `${item.percentage}%`,
                    backgroundColor: getBarColor(item.docType),
                    borderRadius: 'var(--radius-pill)',
                    transition: 'width var(--duration-normal) var(--ease-out)',
                  }}
                />
              </div>
            </div>
          ))}
        </>
      )}

      {/* Help FAB */}
      <button style={s.helpFab} title="Ayuda">
        ?
      </button>
    </div>
  );
}

/* ─── Template Card ─── */

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={s.templateCard}>
      <div style={s.templateCardLeft}>
        <span style={s.docTypeBadge}>{template.docType}</span>
        <div>
          <p style={s.templateName}>{template.name}</p>
          <span style={s.sectionTag}>{template.sections.length} secciones</span>
        </div>
      </div>
      <div style={s.templateCardRight}>
        <button style={s.iconBtn} onClick={onEdit} title="Editar">
          ✎
        </button>
        <button style={s.iconBtn} onClick={onDelete} title="Eliminar">
          🗑
        </button>
      </div>
    </div>
  );
}

/* ─── Library Page ─── */

export function LibraryPage() {
  const {
    templates,
    isLoading: templatesLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useTemplates();
  const { stats, isLoading: statsLoading } = useCorpusStats();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.docType.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = () => {
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const handleEdit = (t: Template) => {
    setEditingTemplate(t);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este template?')) return;
    try {
      await deleteTemplate(id);
    } catch {
      // error handled by hook
    }
  };

  const handleSave = async (input: CreateTemplateInput) => {
    if (editingTemplate) {
      await updateTemplate({ ...input, id: editingTemplate.id });
    } else {
      await createTemplate(input);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.columns}>
        {/* Left column */}
        <div style={s.leftCol}>
          <h1 style={s.pageTitle}>Mi Biblioteca</h1>

          <div style={s.actionBar}>
            <input
              style={s.searchInput}
              placeholder="Buscar templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button style={s.newBtn} onClick={handleCreate}>
              + Nuevo Template
            </button>
          </div>

          {templatesLoading && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
              Cargando templates...
            </p>
          )}

          {!templatesLoading && filtered.length === 0 && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
              {search ? 'No se encontraron templates.' : 'No tenés templates todavía.'}
            </p>
          )}

          <div style={s.templateList}>
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={() => handleEdit(t)}
                onDelete={() => void handleDelete(t.id)}
              />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={s.rightCol}>
          <StatsCard stats={stats} isLoading={statsLoading} />
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

/* ─── Styles ─── */

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: 'var(--space-8) var(--space-4)',
  },
  columns: {
    display: 'flex',
    gap: 'var(--space-8)',
    alignItems: 'flex-start',
  },
  leftCol: {
    flex: '7 1 0%',
    minWidth: 0,
  },
  rightCol: {
    flex: '3 1 0%',
    minWidth: '260px',
  },
  pageTitle: {
    fontFamily: 'var(--font-serif)',
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 var(--space-6)',
  },
  actionBar: {
    display: 'flex',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-6)',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderRadius: 'var(--radius-pill)',
    padding: '0.625rem 1.25rem',
  },
  newBtn: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-on-accent)',
    backgroundColor: 'var(--accent-default)',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  templateList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  templateCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-4) var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
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
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.1rem 0.5rem',
    marginTop: '0.25rem',
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

  /* Stats card */
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
