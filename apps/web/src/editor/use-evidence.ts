import { useState, useEffect, useCallback, useRef } from 'react';
import envConfig from '../config';
import { getCsrfToken } from '../auth/csrf';

/**
 * A single retrieval hit from the completion pipeline.
 */
export interface EvidenceHit {
  rank: number;
  chunkId: string;
  documentId: string;
  documentTitle: string | null;
  similarity: number;
  excerpt: string;
}

/**
 * Evidence panel state from the completion stream.
 */
export interface EvidenceState {
  /** Whether the completion is grounded in sources */
  isGrounded: boolean;
  /** Retrieval hits from the last completion */
  hits: EvidenceHit[];
  /** Completion ID for event tracking */
  completionId: string | null;
  /** Whether the completion came from the structural fast-path */
  structuralMatch: boolean;
  /** Detected document type (e.g. CONTRATO, DEMANDA) or null */
  docType: string | null;
}

interface UseEvidenceOptions {
  /** Whether the panel is currently open */
  isOpen: boolean;
  /** Callback when the panel is opened (for analytics) */
  onPanelOpen?: (completionId: string) => void;
}

/**
 * Hook to manage evidence panel state (A-081, A-082, A-084).
 *
 * Receives evidence data from the completion stream's 'done' event
 * and tracks panel opens for analytics.
 */
export function useEvidence({ isOpen, onPanelOpen }: UseEvidenceOptions) {
  const [evidence, setEvidence] = useState<EvidenceState>({
    isGrounded: false,
    hits: [],
    completionId: null,
    structuralMatch: false,
    docType: null,
  });

  /**
   * Update evidence from the completion stream's done event data.
   */
  const updateEvidence = useCallback((data: {
    completionId: string;
    isGrounded: boolean;
    retrievalHits: EvidenceHit[];
    structuralMatch?: boolean;
    docType?: string | null;
  }) => {
    setEvidence({
      isGrounded: data.isGrounded,
      hits: data.retrievalHits ?? [],
      completionId: data.completionId,
      structuralMatch: data.structuralMatch ?? false,
      docType: data.docType ?? null,
    });
  }, []);

  /**
   * Clear evidence state (when a new completion starts or is dismissed).
   */
  const clearEvidence = useCallback(() => {
    setEvidence({
      isGrounded: false,
      hits: [],
      completionId: null,
      structuralMatch: false,
      docType: null,
    });
  }, []);

  // Track panel open events (A-084)
  const trackedCompletionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && evidence.completionId && evidence.completionId !== trackedCompletionIdRef.current) {
      trackedCompletionIdRef.current = evidence.completionId;
      onPanelOpen?.(evidence.completionId);

      // Fire analytics event
      void trackSourceInspection(evidence.completionId);
    }
  }, [isOpen, evidence.completionId, onPanelOpen]);

  return {
    evidence,
    updateEvidence,
    clearEvidence,
  };
}

/**
 * Fire a source inspection analytics event (A-084).
 */
async function trackSourceInspection(completionId: string): Promise<void> {
  try {
    const csrfToken = await getCsrfToken();
    await fetch(`${envConfig.apiUrl}/analytics/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({
        eventType: 'source_inspection',
        metadata: { completionId },
      }),
    });
  } catch {
    // Non-critical — swallow analytics errors silently
  }
}
