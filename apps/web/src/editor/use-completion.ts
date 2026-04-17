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
  /** Active template ID to include in completion requests */
  templateId?: string | null;
  /** Callback when evidence data is received from the done event */
  onEvidenceReceived?: (data: {
    completionId: string;
    isGrounded: boolean;
    retrievalHits: EvidenceHit[];
    structuralMatch?: boolean;
    docType?: string | null;
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
  templateId,
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
          templateId: templateId ?? undefined,
        }),
      });

      if (!response.ok) {
        // If CSRF token is invalid, invalidate cache and retry once
        if (response.status === 403) {
          invalidateCsrfToken();
        }

        // Try to extract a useful message from JSON/text payloads
        let errorMessage = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
        try {
          const raw = await response.text();
          if (raw.trim()) {
            try {
              const parsed: unknown = JSON.parse(raw);
              if (typeof parsed === 'string' && parsed.trim()) {
                errorMessage = parsed.trim();
              } else if (parsed && typeof parsed === 'object') {
                const obj = parsed as Record<string, unknown>;
                const candidate = [
                  obj.error,
                  obj.message,
                  obj.detail,
                  obj.details,
                  (obj.error as Record<string, unknown> | undefined)?.message,
                ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

                if (candidate) {
                  errorMessage = candidate;
                } else {
                  errorMessage = JSON.stringify(parsed);
                }
              }
            } catch {
              errorMessage = raw.trim();
            }
          }
        } catch {
          // Ignore body read failures; keep HTTP fallback
        }

        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';
      let completionId: string | null = null;
      let docType: string | null = null;

      setState({ status: 'streaming', completionId: null, error: null });

      let buffer = '';

      const processSseEvent = (rawEvent: string) => {
        if (!rawEvent.trim()) return;

        const lines = rawEvent.split('\n');
        let eventType = 'message';
        const dataLines: string[] = [];

        for (const rawLine of lines) {
          const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
          if (!line || line.startsWith(':')) continue;

          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.charAt(5) === ' ' ? line.slice(6) : line.slice(5));
          }
        }

        const data = dataLines.join('\n');
        if (!data || data === '[DONE]') return;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data) as Record<string, unknown>;
        } catch {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: 'Respuesta inválida del servidor de completions.',
          }));
          return;
        }

        if (eventType === 'token' && typeof parsed.text === 'string') {
          accumulated += parsed.text;
          const currentPos = editor.state.selection.from;
          showGhostText(editor, accumulated, currentPos);
        }

        if (eventType === 'meta' && typeof parsed.completionId === 'string' && !completionId) {
          completionId = parsed.completionId;
          setState((prev) => ({ ...prev, completionId }));
        }

        if (eventType === 'meta') {
          if (typeof parsed.docType === 'string' || parsed.docType === null) {
            docType = parsed.docType as string | null;
          }
        }

        if (eventType === 'done') {
          if (Array.isArray(parsed.retrievalHits)) {
            onEvidenceReceived?.({
              completionId: typeof parsed.completionId === 'string' ? parsed.completionId : completionId ?? '',
              isGrounded: Boolean(parsed.isGrounded),
              retrievalHits: parsed.retrievalHits as EvidenceHit[],
              structuralMatch: Boolean(parsed.structuralMatch),
              docType,
            });
          }
          setState((prev) => ({ ...prev, status: 'idle' }));
        }

        if (eventType === 'error') {
          const payloadError = typeof parsed.error === 'string'
            ? parsed.error
            : ((parsed.error as Record<string, unknown> | undefined)?.message as string | undefined);

          setState({
            status: 'error',
            completionId,
            error: payloadError ?? 'Error en stream de completado',
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder
          .decode(value, { stream: true })
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n');

        // Parse SSE events from buffer (format: "event: type\ndata: json\n\n")
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? ''; // Keep incomplete event in buffer

        for (const event of events) {
          processSseEvent(event);
        }
      }

      buffer += decoder.decode().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (buffer.trim()) {
        processSseEvent(buffer);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // Expected

      setState({
        status: 'error',
        completionId: null,
        error: err instanceof Error ? err.message : 'Error de conexión',
      });
    }
  }, [editor, sessionId, enabled, templateId, onEvidenceReceived]);

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
