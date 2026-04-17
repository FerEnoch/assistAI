import { useRef, useEffect, useCallback } from 'react';
import { useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { GhostText } from './ghost-text-extension';
import { useCompletion } from './use-completion';
import type { CompletionStatus } from './use-completion';
import { useEvidence } from './use-evidence';
import type { EvidenceState } from './use-evidence';

const STORAGE_KEY = 'assistai_editor_content';

export interface EditorSetupOptions {
  sessionId: string | null;
  evidencePanelOpen: boolean;
  /** Active template ID for completion requests */
  activeTemplateId?: string | null;
  /** Called when a completion returns at least one retrieval hit — used to auto-open the panel */
  onEvidenceWithHits?: () => void;
}

export interface EditorSetupState {
  editor: Editor | null;
  status: CompletionStatus;
  error: string | null;
  evidence: EvidenceState;
  updateEvidence: ReturnType<typeof useEvidence>['updateEvidence'];
  clearEvidence: ReturnType<typeof useEvidence>['clearEvidence'];
  toggleEvidencePanel?: undefined; // UI state stays in AssistEditor
}

/**
 * Hook that wires up the Tiptap editor, ghost-text completions, evidence,
 * and session-storage persistence (A-060, A-064, A-070, A-080, A-081).
 *
 * CRITICAL INVARIANT: feedbackRef, useEditor, and the feedbackRef sync
 * useEffect MUST all live in this single hook. Separating them would
 * break the stable-closure pattern that prevents editor re-creation.
 */
export function useEditorSetup({ sessionId, evidencePanelOpen, activeTemplateId, onEvidenceWithHits }: EditorSetupOptions): EditorSetupState {
  // ── Evidence panel state (A-081) ──
  const { evidence, updateEvidence, clearEvidence } = useEvidence({
    isOpen: evidencePanelOpen,
  });

  // ── CRITICAL INVARIANT: feedbackRef must live in the same hook as useEditor ──
  const feedbackRef = useRef<{ accepted: () => void; dismissed: () => void }>({
    accepted: () => void 0,
    dismissed: () => void 0,
  });

  // ── Set up Tiptap editor (A-060) ──
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
        onAccepted: () => feedbackRef.current.accepted(),
        onDismissed: () => feedbackRef.current.dismissed(),
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
    // Load initial content from session storage
    content: (() => {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        return saved ?? '';
      } catch {
        return '';
      }
    })(),
  });

  // ── Persist content to session storage on changes ──
  useEffect(() => {
    if (!editor) return;

    const saveContent = () => {
      try {
        const html = editor.getHTML();
        // Always save, even if empty (allows deletion to persist)
        sessionStorage.setItem(STORAGE_KEY, html);
      } catch (err) {
        console.error('[Editor] Failed to save content:', err);
      }
    };

    editor.on('update', saveContent);

    return () => {
      editor.off('update', saveContent);
    };
  }, [editor]);

  // ── Completion hook with evidence callback (A-064, A-070, A-080) ──
  const { status, error, onTextChange, sendFeedback } = useCompletion({
    editor,
    sessionId,
    enabled: !!sessionId,
    templateId: activeTemplateId,
    onEvidenceReceived: (data) => {
      updateEvidence(data);
      if (data.retrievalHits.length > 0) {
        onEvidenceWithHits?.();
      }
    },
  });

  // ── CRITICAL INVARIANT: sync feedbackRef with latest sendFeedback reference ──
  useEffect(() => {
    feedbackRef.current.accepted = () => void sendFeedback(true);
    feedbackRef.current.dismissed = () => void sendFeedback(false);
  }, [sendFeedback]);

  // ── Listen for text changes to trigger completions ──
  // IMPORTANT: don't clear evidence here - it gets cleared in use-completion.ts
  // when a new completion request starts, preserving evidence until user acts
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      onTextChange();
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, onTextChange]);

  return {
    editor,
    status,
    error,
    evidence,
    updateEvidence,
    clearEvidence,
  };
}
