import { useRef, useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import envConfig from '../config';
import { getCsrfToken, invalidateCsrfToken } from '../auth/csrf';
import { showGhostText, clearGhostText } from './ghost-text-extension';
import type { EvidenceHit } from './use-evidence';

/** Debounce interval in ms — matches COMPLETION_CONFIG.debounceMs */
const DEBOUNCE_MS = 750;

/** Minimum prefix length before requesting completions */
const MIN_PREFIX_LENGTH = 20;

export type CompletionStatus = 'idle' | 'waiting' | 'streaming' | 'error';

interface UseCompletionOptions {
  editor: Editor | null;
  sessionId: string | null;
  enabled?: boolean;
  /** Callback when evidence data is received from the done event */
  onEvidenceReceived?: (data: {
    completionId: string;
    isGrounded: boolean;
    retrievalHits: EvidenceHit[];
  }) => void;
}

interface CompletionState {
  status: CompletionStatus;
  completionId: string | null;
  error: string | null;
}

/**
 * Hook for managing inline completions with debounce and SSE streaming (A-064, A-070).
 *
 * Flow:
 * 1. User types → debounce timer starts
 * 2. After DEBOUNCE_MS of inactivity → fire completion request
 * 3. SSE stream receives tokens → accumulate and show as ghost text
 * 4. Tab → accept, Escape/typing → dismiss
 * 5. Report feedback (accept/dismiss) to the server
 * 6. Parse evidence from 'done' event → pass to evidence panel (A-080)
 */
export function useCompletion({
  editor,
  sessionId,
  enabled = true,
  onEvidenceReceived,
}: UseCompletionOptions) {
  const [state, setState] = useState<CompletionState>({
    status: 'idle',
    completionId: null,
    error: null,
  });

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const lastRequestedPos = useRef<number | null>(null);

  /**
   * Cancel any in-flight completion request.
   */
  const cancelPending = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }

    if (editor) {
      clearGhostText(editor);
    }

    setState((prev) => ({
      ...prev,
      status: 'idle',
      error: null,
    }));
  }, [editor]);

  /**
   * Request a completion from the server via SSE.
   */
  const requestCompletion = useCallback(async () => {
    if (!editor || !sessionId || !enabled) return;

    const { from } = editor.state.selection;
    const prefix = editor.state.doc.textBetween(0, from, '\n');

    // Don't request for very short text
    if (prefix.trim().length < MIN_PREFIX_LENGTH) return;

    // Don't re-request at the same position
    if (lastRequestedPos.current === from) return;
    lastRequestedPos.current = from;

    // Cancel any previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    const ac = new AbortController();
    abortController.current = ac;

    setState({ status: 'waiting', completionId: null, error: null });

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(`${envConfig.apiUrl}/completions/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        signal: ac.signal,
        body: JSON.stringify({
          prefix,
          sessionId,
          cursorPosition: from,
        }),
      });

      if (!response.ok) {
        // If CSRF token is invalid, invalidate cache and retry once
        if (response.status === 403) {
          invalidateCsrfToken();
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';
      let completionId: string | null = null;

      setState({ status: 'streaming', completionId: null, error: null });

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer (format: "event: type\ndata: json\n\n")
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? ''; // Keep incomplete event in buffer

        for (const event of events) {
          if (!event.trim()) continue;

          const lines = event.split('\n');
          let eventType = 'message';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              data = line.slice(6);
            }
          }

          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (eventType === 'token' && parsed.text) {
              accumulated += parsed.text;
              const currentPos = editor.state.selection.from;
              showGhostText(editor, accumulated, currentPos);
            }

            if (eventType === 'meta' && parsed.completionId && !completionId) {
              completionId = parsed.completionId;
              setState((prev) => ({ ...prev, completionId }));
            }

            // Handle done event with evidence data (A-080)
            if (eventType === 'done' && parsed.retrievalHits) {
              onEvidenceReceived?.({
                completionId: parsed.completionId ?? completionId ?? '',
                isGrounded: parsed.isGrounded ?? false,
                retrievalHits: parsed.retrievalHits ?? [],
              });
              setState((prev) => ({ ...prev, status: 'idle' }));
            }

            if (eventType === 'error') {
              setState({
                status: 'error',
                completionId,
                error: parsed.error ?? 'Error desconocido',
              });
            }
          } catch {
            // Ignore parse errors on partial SSE data
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // Expected

      setState({
        status: 'error',
        completionId: null,
        error: err instanceof Error ? err.message : 'Error de conexión',
      });
    }
  }, [editor, sessionId, enabled, onEvidenceReceived]);

  /**
   * Trigger completion after debounce period (A-064).
   */
  const onTextChange = useCallback(() => {
    if (!enabled || !editor) return;

    // Clear existing ghost text on any change
    clearGhostText(editor);

    // Reset debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    lastRequestedPos.current = null;

    debounceTimer.current = setTimeout(() => {
      void requestCompletion();
    }, DEBOUNCE_MS);
  }, [enabled, editor, requestCompletion]);

  /**
   * Send feedback when a completion is accepted or dismissed.
   */
  const sendFeedback = useCallback(
    async (accepted: boolean) => {
      if (!state.completionId) return;

      try {
        const csrfToken = await getCsrfToken();

        await fetch(`${envConfig.apiUrl}/completions/${state.completionId}/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({ accepted }),
        });
      } catch {
        // Non-critical — swallow feedback errors
      }
    },
    [state.completionId],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPending();
    };
  }, [cancelPending]);

  return {
    status: state.status,
    error: state.error,
    completionId: state.completionId,
    onTextChange,
    cancelPending,
    sendFeedback,
  };
}
