import { useState, useCallback } from 'react';
import { EditorContent } from '@tiptap/react';
import type { CompletionStatus } from './use-completion';
import { useEditorSession } from './use-editor-session';
import { useEditorSetup } from './use-editor-setup';
import { EvidencePanel } from './EvidencePanel';
import { DocumentTypeBadge } from './DocumentTypeBadge';
import { useTemplates } from '../hooks/useTemplates';
import { useActiveTemplate } from './use-active-template';
import { TemplateSelector } from './TemplateSelector';

/**
 * AssistAI Editor — Tiptap-based writing editor with inline completions (A-060 through A-065, A-081).
 *
 * Orchestrates session creation, editor setup, and layout rendering.
 * All session logic lives in useEditorSession; all editor wiring in useEditorSetup.
 */
export function AssistEditor() {
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false);
  const { sessionId, isCreatingSession } = useEditorSession();
  const { templates } = useTemplates();
  const { activeTemplateId, activeTemplate, setActiveTemplate } = useActiveTemplate();
  const { editor, status, error, evidence, clearEvidence, updateEvidence } =
    useEditorSetup({
      sessionId,
      evidencePanelOpen,
      activeTemplateId,
      onEvidenceWithHits: () => setEvidencePanelOpen(true),
    });

  const handleSelectTemplate = useCallback(
    (templateId: string | null) => {
      if (!templateId) {
        setActiveTemplate(null);
        return;
      }
      const found = templates.find((t) => t.id === templateId) ?? null;
      setActiveTemplate(found);
    },
    [templates, setActiveTemplate],
  );

  const toggleEvidencePanel = useCallback(() => {
    setEvidencePanelOpen((prev) => !prev);
  }, []);

  // Loading state
  if (isCreatingSession) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <p style={styles.loadingText}>Iniciando el editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.outerContainer}>
      {/* Page header — outside editor card */}
      <div style={styles.pageHeaderRow}>
        <div style={styles.pageHeader}>
          <span style={styles.logo}>AssistAI</span>
          <TemplateSelector
            templates={templates}
            activeTemplateId={activeTemplateId}
            onSelect={handleSelectTemplate}
          />
        </div>
      </div>

      <div style={styles.editorArea}>
        <div style={styles.container}>
          {/* Template info banner */}
          {activeTemplate && (
            <div style={styles.templateBanner}>
              Completando con estructura de: <strong>{activeTemplate.name}</strong>
            </div>
          )}

        {/* Status bar */}
        <StatusBar
          status={status}
          error={error}
          structuralMatch={evidence.structuralMatch}
          documentTitle={evidence.hits[0]?.documentTitle}
          docType={evidence.docType}
        />

        {/* Editor */}
        <div style={styles.editorWrapper}>
          <EditorContent editor={editor} />
        </div>

        {/* Ghost text styles */}
        <style>{ghostTextStyles}</style>
      </div>

      {/* Evidence panel sidebar (A-081) */}
      <EvidencePanel
        isOpen={evidencePanelOpen}
        onToggle={toggleEvidencePanel}
        isGrounded={evidence.isGrounded}
        hits={evidence.hits}
        structuralMatch={evidence.structuralMatch}
        docType={evidence.docType}
      />
      </div>
    </div>
  );
}

/**
 * Status bar — shows completion status in Spanish (A-065).
 */
function StatusBar({
  status,
  error,
  structuralMatch,
  documentTitle,
  docType,
}: {
  status: CompletionStatus;
  error: string | null;
  structuralMatch?: boolean;
  documentTitle?: string | null;
  docType?: string | null;
}) {
  const getStatusDisplay = (): { text: string; color: string } => {
    switch (status) {
      case 'idle':
        return { text: '', color: 'transparent' };
      case 'waiting':
        return { text: 'Buscando sugerencias...', color: 'var(--warning)' };
      case 'streaming':
        if (structuralMatch && documentTitle) {
          return {
            text: `Completando con estructura de: ${documentTitle}`,
            color: 'var(--accent-blue, #3b82f6)',
          };
        }
        return { text: 'Generando sugerencia (Tab para aceptar, Esc para descartar)', color: 'var(--success)' };
      case 'error':
        return {
          text: error ?? 'Error al generar la sugerencia. Intentá de nuevo.',
          color: 'var(--error)',
        };
    }
  };

  const display = getStatusDisplay();

  if (!display.text) return null;

  return (
    <div style={{ ...styles.statusBar, borderLeftColor: display.color }}>
      {docType && <DocumentTypeBadge docType={docType} />}
      <span style={{ ...styles.statusDot, backgroundColor: display.color }} />
      <span style={styles.statusText}>{display.text}</span>
    </div>
  );
}

/**
 * Empty state shown when no evidence sources are connected (A-065).
 */
export function EditorEmptyState() {
  return (
    <div style={styles.emptyState}>
      <h3 style={styles.emptyTitle}>Sin fuentes conectadas</h3>
      <p style={styles.emptyDescription}>
        Conectá tu Google Drive para que AssistAI use tus documentos como
        referencia al sugerir completaciones.
      </p>
      <p style={styles.emptyHint}>
        Mientras tanto, podés escribir y las sugerencias se basarán solo en
        el contexto de tu texto actual.
      </p>
    </div>
  );
}

/**
 * Error state for the editor (A-065).
 */
export function EditorErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div style={styles.errorState}>
      <p style={styles.errorText}>
        {message ?? 'Hubo un error al cargar el editor. Intentá recargando la página.'}
      </p>
      {onRetry && (
        <button style={styles.retryButton} onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/**
 * Zero evidence state — shown when retrieval returns no results (A-065).
 */
export function ZeroEvidenceNotice() {
  return (
    <div style={styles.zeroEvidence}>
      <span style={styles.zeroEvidenceIcon}>📄</span>
      <span style={styles.zeroEvidenceText}>
        No se encontró evidencia relevante en tus documentos para este contexto.
      </span>
    </div>
  );
}

// ──────────────────────────────────────────
// Ghost text CSS injection (A-062)
// ──────────────────────────────────────────
const ghostTextStyles = `
.ProseMirror {
  outline: none;
  flex: 1;
  padding: 1.5rem;
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.75;
  color: var(--text-primary);
  min-height: 0;
  overflow-y: auto;
}

.ProseMirror p {
  margin: 0 0 0.75rem;
}

.ProseMirror h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 1.5rem 0 0.75rem;
  color: var(--text-primary);
}

.ProseMirror h2 {
  font-size: 1.375rem;
  font-weight: 600;
  margin: 1.25rem 0 0.625rem;
  color: var(--text-primary);
}

.ProseMirror h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: var(--text-secondary);
}

/* Placeholder text */
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--text-tertiary);
  pointer-events: none;
  height: 0;
  font-style: italic;
}

/* Ghost text decoration */
.ghost-text {
  opacity: 0.4;
  pointer-events: none;
  user-select: none;
  color: var(--accent-default);
  font-style: italic;
}

/* ProseMirror focus ring */
.ProseMirror-focused {
  outline: none;
}
`;

// ──────────────────────────────────────────
// Styles
// ──────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  outerContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  pageHeaderRow: {
    padding: '0.75rem 1rem',
    flexShrink: 0,
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.375rem',
    fontWeight: 700,
    color: 'var(--accent-default)',
    letterSpacing: '-0.01em',
  },
  editorArea: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  templateBanner: {
    padding: '0.625rem 0.75rem',
    fontSize: '0.8125rem',
    color: 'var(--accent-info)',
    backgroundColor: '#eff6ff',
    borderLeft: '4px solid #0284c7',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '0.5rem',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
  editorWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    borderLeft: '3px solid transparent',
    marginBottom: '0.5rem',
    transition: 'all 0.2s ease',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusText: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: 'var(--text-secondary)',
  },
  emptyTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem',
  },
  emptyDescription: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    margin: '0 0 0.5rem',
  },
  emptyHint: {
    fontSize: '0.8rem',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic',
    margin: 0,
  },
  errorState: {
    textAlign: 'center' as const,
    padding: '2rem',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-default)',
  },
  errorText: {
    fontSize: '0.875rem',
    color: 'var(--error)',
    margin: '0 0 1rem',
  },
  retryButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--error)',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  zeroEvidence: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.75rem',
    fontSize: '0.8rem',
    color: 'var(--text-tertiary)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '0.5rem',
  },
  zeroEvidenceIcon: {
    fontSize: '1rem',
  },
  zeroEvidenceText: {
    fontSize: '0.8rem',
  },
};
