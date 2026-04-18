import { useState } from 'react';
import type { Template, CreateTemplateInput } from '../hooks/useTemplates';

interface TemplateFormModalProps {
  template: Template | null;
  onClose: () => void;
  onSave: (input: CreateTemplateInput) => Promise<void>;
}

/**
 * Modal form for creating/editing a template with sections.
 * Uses new field names: sampleContent, order, clauseType.
 * Extracted from LibraryPage for reusability.
 */
export function TemplateFormModal({ template, onClose, onSave }: TemplateFormModalProps) {
  const [name, setName] = useState(template?.name ?? '');
  const [docType, setDocType] = useState(template?.docType ?? 'CONTRATO');
  const [description, setDescription] = useState(template?.description ?? '');
  const [sections, setSections] = useState(
    template?.sections.map((s) => ({
      name: s.name,
      sampleContent: s.sampleContent,
      clauseType: s.clauseType ?? '',
    })) ?? [{ name: '', sampleContent: '', clauseType: '' }],
  );
  const [saving, setSaving] = useState(false);

  const handleAddSection = () =>
    setSections([...sections, { name: '', sampleContent: '', clauseType: '' }]);
  const handleRemoveSection = (idx: number) =>
    setSections(sections.filter((_, i) => i !== idx));
  const handleSectionChange = (
    idx: number,
    field: 'name' | 'sampleContent' | 'clauseType',
    value: string,
  ) => setSections(sections.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        docType,
        description: description.trim() || undefined,
        sections: sections
          .filter((s) => s.name.trim())
          .map((s, idx) => ({
            name: s.name,
            sampleContent: s.sampleContent,
            order: idx,
            clauseType: s.clauseType || undefined,
          })),
      });
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={modal.container} onClick={(e) => e.stopPropagation()}>
        <h2 style={modal.title}>{template ? 'Editar Template' : 'Nuevo Template'}</h2>

        <div style={modal.field}>
          <label style={modal.label}>Nombre</label>
          <input style={modal.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Contrato de Locación" />
        </div>

        <div style={modal.field}>
          <label style={modal.label}>Tipo de documento</label>
          <select style={modal.input} value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="CONTRATO">Contrato</option>
            <option value="DEMANDA">Demanda</option>
            <option value="CONTESTACION">Contestación</option>
            <option value="RECURSO">Recurso</option>
            <option value="DICTAMEN">Dictamen</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>

        <div style={modal.field}>
          <label style={modal.label}>Descripción (opcional)</label>
          <textarea style={{ ...modal.input, minHeight: '60px', resize: 'vertical' as const }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descripción del template" />
        </div>

        <div style={modal.sectionsHeader}>
          <label style={modal.label}>Secciones</label>
          <button style={modal.addSectionBtn} onClick={handleAddSection}>+ Agregar sección</button>
        </div>

        <div style={modal.sectionsList}>
          {sections.map((section, idx) => (
            <div key={idx} style={modal.sectionItem}>
              <div style={modal.sectionRow}>
                <input style={{ ...modal.input, flex: 1 }} value={section.name} onChange={(e) => handleSectionChange(idx, 'name', e.target.value)} placeholder="Nombre de la sección" />
                {sections.length > 1 && (
                  <button style={modal.removeSectionBtn} onClick={() => handleRemoveSection(idx)} title="Eliminar sección">×</button>
                )}
              </div>
              <textarea style={{ ...modal.input, minHeight: '80px', resize: 'vertical' as const }} value={section.sampleContent} onChange={(e) => handleSectionChange(idx, 'sampleContent', e.target.value)} placeholder="Contenido de ejemplo para esta sección" />
              <input style={modal.input} value={section.clauseType} onChange={(e) => handleSectionChange(idx, 'clauseType', e.target.value)} placeholder="Tipo de cláusula (opcional)" />
            </div>
          ))}
        </div>

        <div style={modal.actions}>
          <button style={modal.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={{ ...modal.saveBtn, opacity: saving || !name.trim() ? 0.6 : 1 }} onClick={() => void handleSubmit()} disabled={saving || !name.trim()}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const modal: Record<string, React.CSSProperties> = {
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
  field: { marginBottom: 'var(--space-4)' },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: 'var(--space-1)',
  },
  input: { width: '100%' },
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
  sectionRow: { display: 'flex', gap: 'var(--space-2)', alignItems: 'center' },
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
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' },
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
