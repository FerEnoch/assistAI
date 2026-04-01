import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState, useCallback } from 'react';
import { GhostText } from './ghost-text-extension';
import { useCompletion } from './use-completion';
import type { CompletionStatus } from './use-completion';
import { useEvidence } from './use-evidence';
import { EvidencePanel } from './EvidencePanel';
import envConfig from '../config';
import { getCsrfToken } from '../auth/csrf';

/**
 * AssistAI Editor — Tiptap-based writing editor with inline completions (A-060 through A-065, A-081).
 *
 * Features:
 * - Rich text editing via Tiptap (StarterKit)
 * - Inline ghost-text completions from RAG pipeline
 * - Tab to accept, Escape/typing to dismiss
 * - Debounced completion requests (750ms)
 * - Editor session tracking
 * - Evidence panel sidebar (A-081, A-082)
 * - Source inspection analytics (A-084)
 * - Spanish (es-ES) copy for all states
 */
export function AssistEditor() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(true);
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false);

  // Evidence panel state (A-081)
  const { evidence, updateEvidence, clearEvidence } = useEvidence({
    isOpen: evidencePanelOpen,
  });

  // Initialize editor session (A-061)
  useEffect(() => {
    let cancelled = false;

    async function createSession() {
      try {
        const csrfToken = await getCsrfToken();

        const res = await fetch(`${envConfig.apiUrl}/completions/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({}),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as { sessionId: string };

        if (!cancelled) {
          setSessionId(data.sessionId);
        }
      } catch (err) {
        console.error('[Editor] Failed to create session:', err);
      } finally {
        if (!cancelled) {
          setIsCreatingSession(false);
        }
      }
    }

    void createSession();
    return () => { cancelled = true; };
  }, []);

  // Set up Tiptap editor (A-060)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Empezá a escribir tu documento...',
        emptyEditorClass: 'is-editor-empty',
      }),
      GhostText.configure({
        className: 'ghost-text',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'assist-editor-content',
        spellcheck: 'true',
        lang: 'es',
      },
    },
    autofocus: 'end',
  });

  // Set up completion hook with evidence callback (A-064, A-070, A-080)
  const { status, error, onTextChange } = useCompletion({
    editor,
    sessionId,
    enabled: !!sessionId,
    onEvidenceReceived: updateEvidence,
  });

  // Listen for text changes to trigger completions
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      onTextChange();
      // Clear evidence on new input
      clearEvidence();
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, onTextChange, clearEvidence]);

  // Toggle evidence panel
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
      <div style={styles.container}>
        {/* Status bar */}
        <StatusBar status={status} error={error} />

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
      />
    </div>
  );
}

/**
 * Status bar — shows completion status in Spanish (A-065).
 */
function StatusBar({ status, error }: { status: CompletionStatus; error: string | null }) {
  const getStatusDisplay = (): { text: string; color: string } => {
    switch (status) {
      case 'idle':
        return { text: '', color: 'transparent' };
      case 'waiting':
        return { text: 'Buscando sugerencias...', color: '#f59e0b' };
      case 'streaming':
        return { text: 'Generando sugerencia (Tab para aceptar, Esc para descartar)', color: '#10b981' };
      case 'error':
        return {
          text: error ?? 'Error al generar la sugerencia. Intentá de nuevo.',
          color: '#ef4444',
        };
    }
  };

  const display = getStatusDisplay();

  if (!display.text) return null;

  return (
    <div style={{ ...styles.statusBar, borderLeftColor: display.color }}>
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
.assist-editor-content {
  outline: none;
  min-height: 400px;
  padding: 1.5rem;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 1rem;
  line-height: 1.75;
  color: #1a1a2e;
}

.assist-editor-content p {
  margin: 0 0 0.75rem;
}

.assist-editor-content h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 1.5rem 0 0.75rem;
  color: #0f172a;
}

.assist-editor-content h2 {
  font-size: 1.375rem;
  font-weight: 600;
  margin: 1.25rem 0 0.625rem;
  color: #1e293b;
}

.assist-editor-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #334155;
}

/* Placeholder text */
.assist-editor-content p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
  font-style: italic;
}

/* Ghost text decoration (A-062) */
.ghost-text {
  opacity: 0.4;
  pointer-events: none;
  user-select: none;
  color: #6366f1;
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
    height: '100%',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
  },
  loadingText: {
    fontSize: '0.875rem',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  editorWrapper: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    overflow: 'auto',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
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
    color: '#6b7280',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: '#6b7280',
  },
  emptyTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#374151',
    margin: '0 0 0.5rem',
  },
  emptyDescription: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    margin: '0 0 0.5rem',
  },
  emptyHint: {
    fontSize: '0.8rem',
    color: '#9ca3af',
    fontStyle: 'italic',
    margin: 0,
  },
  errorState: {
    textAlign: 'center' as const,
    padding: '2rem',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    border: '1px solid #fecaca',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#dc2626',
    margin: '0 0 1rem',
  },
  retryButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#dc2626',
    backgroundColor: '#fff',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  zeroEvidence: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.75rem',
    fontSize: '0.8rem',
    color: '#9ca3af',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    marginBottom: '0.5rem',
  },
  zeroEvidenceIcon: {
    fontSize: '1rem',
  },
  zeroEvidenceText: {
    fontSize: '0.8rem',
  },
};
