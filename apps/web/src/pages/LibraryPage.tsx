import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useTemplates, type Template, type CreateTemplateInput } from '../hooks/useTemplates';
import { useCorpusStats, type DocTypeBreakdown } from '../hooks/useCorpusStats';
import { useTemplateDocuments } from '../hooks/useTemplateDocuments';
import { useSources } from '../hooks/useSources';
import { DrivePicker } from '../components/DrivePicker';
import { IndexingStatus } from '../components/IndexingStatus';
import { getCsrfToken } from '../auth/csrf';
import envConfig from '../config';

/* ═══════════════════════════════════════════════════════════════
   Template Modal (define manually)
   ═══════════════════════════════════════════════════════════════ */

interface TemplateModalProps {
  template: Template | null;
  onClose: () => void;
  onSave: (input: CreateTemplateInput) => Promise<void>;
}

function TemplateModal({ template, onClose, onSave }: TemplateModalProps) {
  const [name, setName] = useState(template?.name ?? '');
  const [docType, setDocType] = useState(template?.docType ?? 'CONTRATO');
  const [description, setDescription] = useState(template?.description ?? '');
  const [sections, setSections] = useState(
    template?.sections.map((s) => ({ name: s.name, content: s.content })) ?? [
      { name: '', content: '' },
    ],
  );
  const [saving, setSaving] = useState(false);

  const handleAddSection = () => setSections([...sections, { name: '', content: '' }]);
  const handleRemoveSection = (idx: number) => setSections(sections.filter((_, i) => i !== idx));
  const handleSectionChange = (idx: number, field: 'name' | 'content', value: string) =>
    setSections(sections.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

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
              <textarea style={{ ...modal.input, minHeight: '80px', resize: 'vertical' as const }} value={section.content} onChange={(e) => handleSectionChange(idx, 'content', e.target.value)} placeholder="Contenido o instrucciones para esta sección" />
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

/* ═══════════════════════════════════════════════════════════════
   Upload confirm mini-modal
   ═══════════════════════════════════════════════════════════════ */

interface UploadConfirmModalProps {
  file: File;
  onConfirm: (name: string, docType: string) => Promise<void>;
  onCancel: () => void;
}

function UploadConfirmModal({ file, onConfirm, onCancel }: UploadConfirmModalProps) {
  const [name, setName] = useState(file.name.replace(/\.[^.]+$/, ''));
  const [docType, setDocType] = useState('CONTRATO');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onConfirm(name.trim(), docType);
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modal.overlay} onClick={onCancel}>
      <div style={{ ...modal.container, maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={modal.title}>Subir archivo</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Archivo: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </p>
        <div style={modal.field}>
          <label style={modal.label}>Nombre del template</label>
          <input style={modal.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del template" />
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
        <div style={modal.actions}>
          <button style={modal.cancelBtn} onClick={onCancel}>Cancelar</button>
          <button style={{ ...modal.saveBtn, opacity: saving || !name.trim() ? 0.6 : 1 }} onClick={() => void handleConfirm()} disabled={saving || !name.trim()}>
            {saving ? 'Subiendo...' : 'Confirmar y subir'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   New Template dropdown menu
   ═══════════════════════════════════════════════════════════════ */

interface NewTemplateMenuProps {
  driveConnected: boolean;
  onManual: () => void;
  onUpload: () => void;
  onDrive: () => void;
  onClose: () => void;
}

function NewTemplateMenu({ driveConnected, onManual, onUpload, onDrive, onClose }: NewTemplateMenuProps) {
  return (
    <div style={s.dropdownOverlay} onClick={onClose}>
      <div style={s.dropdown} onClick={(e) => e.stopPropagation()}>
        <button style={s.dropdownItem} onClick={() => { onManual(); onClose(); }}>
          <span style={s.dropdownIcon}>✎</span>
          <div>
            <p style={s.dropdownLabel}>Definir manualmente</p>
            <p style={s.dropdownHint}>Creá el template con secciones y contenido propio</p>
          </div>
        </button>
        <button style={s.dropdownItem} onClick={() => { onUpload(); onClose(); }}>
          <span style={s.dropdownIcon}>⬆</span>
          <div>
            <p style={s.dropdownLabel}>Subir archivo local</p>
            <p style={s.dropdownHint}>PDF, DOCX o TXT — máximo 20MB</p>
          </div>
        </button>
        <button style={s.dropdownItem} onClick={() => { onDrive(); onClose(); }}>
          <span style={s.dropdownIcon}>▲</span>
          <div>
            <p style={s.dropdownLabel}>Importar desde Drive</p>
            <p style={s.dropdownHint}>
              {driveConnected ? 'Elegí un archivo de tu Google Drive' : 'Requiere conectar Google Drive primero'}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Ingest status badge
   ═══════════════════════════════════════════════════════════════ */

function IngestBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    indexed:    { label: 'Indexado',    color: '#059669', bg: '#ecfdf5' },
    processing: { label: 'Procesando', color: '#d97706', bg: '#fffbeb' },
    queued:     { label: 'En cola',    color: '#6b7280', bg: '#f3f4f6' },
    failed:     { label: 'Fallido',    color: '#dc2626', bg: '#fef2f2' },
  };
  const cfg = config[status] ?? config.queued;
  return (
    <span style={{ ...s.ingestBadge, color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.color}40` }}>
      <span style={{ ...s.ingestDot, backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Template corpus panel (expandable)
   ═══════════════════════════════════════════════════════════════ */

interface TemplateCorpusPanelProps {
  templateId: string;
  onClose: () => void;
}

function TemplateCorpusPanel({ templateId, onClose }: TemplateCorpusPanelProps) {
  const { documents, isLoading, removeDocument } = useTemplateDocuments(templateId);

  return (
    <div style={s.corpusPanel}>
      <div style={s.corpusPanelHeader}>
        <h3 style={s.corpusPanelTitle}>Corpus del template</h3>
        <button style={s.corpusPanelClose} onClick={onClose} title="Cerrar">×</button>
      </div>

      {isLoading && <p style={s.corpusEmpty}>Cargando...</p>}

      {!isLoading && documents.length === 0 && (
        <p style={s.corpusEmpty}>Sin documentos asociados todavía.</p>
      )}

      {documents.map((doc) => (
        <div key={doc.id} style={s.corpusDocRow}>
          <div style={s.corpusDocInfo}>
            <span style={s.corpusDocName}>{doc.title}</span>
            <IngestBadge status={doc.ingestStatus} />
          </div>
          <button
            style={s.corpusRemoveBtn}
            onClick={() => void removeDocument(doc.id)}
            title="Quitar documento"
          >
            Quitar
          </button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Template Card
   ═══════════════════════════════════════════════════════════════ */

interface TemplateCardProps {
  template: Template;
  expanded: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleCorpus: () => void;
}

function TemplateCard({ template, expanded, onEdit, onDelete, onToggleCorpus }: TemplateCardProps) {
  return (
    <div style={{ ...s.templateCard, ...(expanded ? s.templateCardExpanded : {}) }}>
      <div style={s.templateCardBody}>
        <div style={s.templateCardLeft}>
          <span style={s.docTypeBadge}>{template.docType ?? 'DOC'}</span>
          <div>
            <p style={s.templateName}>{template.name}</p>
            <button style={s.sectionTag} onClick={onToggleCorpus} title="Ver corpus">
              {template.sections.length} secciones · corpus
            </button>
          </div>
        </div>
        <div style={s.templateCardRight}>
          <button style={s.iconBtn} onClick={onEdit} title="Editar">✎</button>
          <button style={s.iconBtn} onClick={onDelete} title="Eliminar">🗑</button>
        </div>
      </div>

      {expanded && (
        <TemplateCorpusPanel
          templateId={template.id}
          onClose={onToggleCorpus}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Stats Card
   ═══════════════════════════════════════════════════════════════ */

const DOC_TYPE_COLORS: Record<string, string> = {
  CONTRATO: '#2a2420',
  DEMANDA: '#6b6560',
};
const DEFAULT_BAR_COLOR = '#9e9691';

function getBarColor(docType: string): string {
  return DOC_TYPE_COLORS[docType] ?? DEFAULT_BAR_COLOR;
}

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
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Cargando estadísticas...</p>
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

/* ═══════════════════════════════════════════════════════════════
   Empty state
   ═══════════════════════════════════════════════════════════════ */

function EmptyState({
  driveConnected,
  onNewTemplate,
  onConnectDrive,
}: {
  driveConnected: boolean;
  onNewTemplate: () => void;
  onConnectDrive: () => void;
}) {
  return (
    <div style={s.emptyState}>
      <p style={s.emptyTitle}>Tu biblioteca está vacía</p>
      <p style={s.emptyDesc}>
        Creá tu primer template para empezar a trabajar con el asistente de redacción.
      </p>
      <div style={s.emptyCtas}>
        <button style={s.newBtn} onClick={onNewTemplate}>+ Nuevo Template</button>
        {!driveConnected && (
          <button style={s.connectDriveBtn} onClick={onConnectDrive}>
            Conectar Google Drive
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Library Page
   ═══════════════════════════════════════════════════════════════ */

type ModalMode = 'manual' | 'upload' | 'drive' | null;

export function LibraryPage() {
  const { templates, isLoading: templatesLoading, createTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const { stats, isLoading: statsLoading } = useCorpusStats();
  const { sources, isLoading: sourcesLoading, refetch: refetchSources } = useSources();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasHandledRedirect = useRef(false);

  // One-shot refetch when returning from Google OAuth
  useEffect(() => {
    if (searchParams.get('source') === 'connected' && !hasHandledRedirect.current) {
      hasHandledRedirect.current = true;
      refetchSources();
      window.history.replaceState({}, '', '/library');
    }
  }, [searchParams, refetchSources]);

  const connectedSource = sources.find((s) => s.status === 'connected' || s.status === 'syncing');

  const handleConnectDrive = () => {
    window.location.href = `${envConfig.apiUrl}/sources/drive/connect`;
  };

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.docType ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = () => { setEditingTemplate(null); setModalMode('manual'); };
  const handleEdit = (t: Template) => { setEditingTemplate(t); setModalMode('manual'); };
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este template?')) return;
    try { await deleteTemplate(id); } catch { /* handled by hook */ }
  };
  const handleSave = async (input: CreateTemplateInput) => {
    if (editingTemplate) {
      await updateTemplate({ ...input, id: editingTemplate.id });
    } else {
      await createTemplate(input);
    }
  };

  const handleToggleCorpus = (id: string) => {
    setExpandedTemplateId((prev) => (prev === id ? null : id));
  };

  // File upload flow
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setModalMode('upload');
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadConfirm = async (name: string, docType: string) => {
    if (!pendingFile) return;
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('name', name);
    formData.append('docType', docType);

    const csrfToken = await getCsrfToken();
    const res = await fetch(`${envConfig.apiUrl}/templates/from-upload`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': csrfToken },
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 413) setUploadError('El archivo supera el límite de 20MB');
      else if (res.status === 415) setUploadError('Formato no soportado. Usá PDF, DOCX o TXT');
      else setUploadError('Error al subir el archivo. Intentá de nuevo');
      throw new Error('Upload failed');
    }

    setPendingFile(null);
  };

  // Drive import flow
  const handleDriveImport = async (fileIds: string[], rootLocator: string) => {
    if (!connectedSource || fileIds.length === 0) return;
    const fileId = fileIds[0];
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${envConfig.apiUrl}/templates/from-drive`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({
        fileId,
        sourceId: connectedSource.id,
        name: rootLocator || fileId,
      }),
    });
    if (!res.ok) setUploadError('Error al importar desde Drive');
    setModalMode(null);
  };

  const showEmpty = !templatesLoading && filtered.length === 0 && !search;

  return (
    <div style={s.container}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <div style={s.columns}>
        {/* ── Left column ── */}
        <div style={s.leftCol}>
          <div style={s.pageTitleRow}>
            <h1 style={s.pageTitle}>Mi Biblioteca</h1>
            {/* Drive status badge */}
            {!sourcesLoading && connectedSource && (
              <span style={s.driveBadge}>
                <span style={s.driveDot} /> Drive conectado
              </span>
            )}
          </div>

          {uploadError && (
            <div style={s.errorBanner}>
              <span>{uploadError}</span>
              <button style={s.errorBannerClose} onClick={() => setUploadError(null)}>×</button>
            </div>
          )}

          <div style={s.actionBar}>
            <input
              style={s.searchInput}
              placeholder="Buscar en la biblioteca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ position: 'relative' as const }}>
              <button style={s.newBtn} onClick={() => setShowNewMenu((v) => !v)}>
                + Nuevo Template
              </button>
              {showNewMenu && (
                <NewTemplateMenu
                  driveConnected={!!connectedSource}
                  onManual={handleCreate}
                  onUpload={() => fileInputRef.current?.click()}
                  onDrive={() => {
                    if (connectedSource) {
                      setModalMode('drive');
                    } else {
                      handleConnectDrive();
                    }
                  }}
                  onClose={() => setShowNewMenu(false)}
                />
              )}
            </div>
          </div>

          {templatesLoading && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Cargando templates...</p>
          )}

          {!templatesLoading && search && filtered.length === 0 && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No se encontraron templates.</p>
          )}

          {showEmpty && (
            <EmptyState
              driveConnected={!!connectedSource}
              onNewTemplate={handleCreate}
              onConnectDrive={handleConnectDrive}
            />
          )}

          <div style={s.templateList}>
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                expanded={expandedTemplateId === t.id}
                onEdit={() => handleEdit(t)}
                onDelete={() => void handleDelete(t.id)}
                onToggleCorpus={() => handleToggleCorpus(t.id)}
              />
            ))}
          </div>

          {/* Indexing status at the bottom */}
          <div style={{ marginTop: 'var(--space-6)' }}>
            <IndexingStatus />
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={s.rightCol}>
          <StatsCard stats={stats} isLoading={statsLoading} />
        </div>
      </div>

      {/* ── Modals ── */}
      {modalMode === 'manual' && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => { setModalMode(null); setEditingTemplate(null); }}
          onSave={handleSave}
        />
      )}

      {modalMode === 'upload' && pendingFile && (
        <UploadConfirmModal
          file={pendingFile}
          onConfirm={handleUploadConfirm}
          onCancel={() => { setModalMode(null); setPendingFile(null); }}
        />
      )}

      {modalMode === 'drive' && connectedSource && (
        <DrivePicker
          sourceId={connectedSource.id}
          singleSelect
          onSelect={(fileIds, rootLocator) => void handleDriveImport(fileIds, rootLocator)}
          onCancel={() => setModalMode(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════════ */

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
  leftCol: { flex: '7 1 0%', minWidth: 0 },
  rightCol: { flex: '3 1 0%', minWidth: '260px' },

  pageTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-6)',
  },
  pageTitle: {
    fontFamily: 'var(--font-serif)',
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  driveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#059669',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 'var(--radius-pill)',
    padding: '0.2rem 0.65rem',
  },
  driveDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: '#059669',
    flexShrink: 0,
  },
  errorBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderLeft: '4px solid #dc2626',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem',
    marginBottom: 'var(--space-4)',
    fontSize: '0.875rem',
    color: '#dc2626',
  },
  errorBannerClose: {
    fontSize: '1.1rem',
    color: '#dc2626',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: '0 0.25rem',
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

  /* New template dropdown */
  dropdownOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 500,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-lg)',
    minWidth: '280px',
    zIndex: 600,
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    width: '100%',
    padding: '0.875rem 1rem',
    borderBottom: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    textAlign: 'left' as const,
    transition: 'background-color 0.15s',
  },
  dropdownIcon: {
    fontSize: '1.1rem',
    flexShrink: 0,
    color: 'var(--accent-default)',
    marginTop: '0.1rem',
  },
  dropdownLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  dropdownHint: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    margin: '0.1rem 0 0',
  },

  /* Template list */
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

  /* Corpus panel */
  corpusPanel: {
    borderTop: '1px solid var(--border-subtle)',
    padding: 'var(--space-4) var(--space-6)',
    backgroundColor: 'var(--bg-secondary)',
  },
  corpusPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-3)',
  },
  corpusPanelTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  corpusPanelClose: {
    fontSize: '1.1rem',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
  },
  corpusEmpty: {
    fontSize: '0.8rem',
    color: 'var(--text-tertiary)',
    margin: 0,
  },
  corpusDocRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  corpusDocInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: 0,
  },
  corpusDocName: {
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
  },
  ingestBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.7rem',
    fontWeight: 600,
    borderRadius: 'var(--radius-pill)',
    padding: '0.15rem 0.5rem',
    whiteSpace: 'nowrap',
  },
  ingestDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  corpusRemoveBtn: {
    fontSize: '0.75rem',
    color: 'var(--error)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    flexShrink: 0,
  },

  /* Empty state */
  emptyState: {
    padding: 'var(--space-10) var(--space-4)',
    textAlign: 'center' as const,
  },
  emptyTitle: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 var(--space-2)',
  },
  emptyDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: '0 0 var(--space-6)',
    lineHeight: 1.6,
  },
  emptyCtas: {
    display: 'flex',
    gap: 'var(--space-3)',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  connectDriveBtn: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--accent-default)',
    backgroundColor: 'transparent',
    border: '1px solid var(--accent-default)',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
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
