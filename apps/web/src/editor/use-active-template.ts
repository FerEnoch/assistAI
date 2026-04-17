import { useState, useCallback } from 'react';

const STORAGE_KEY = 'assistai_active_template';

interface ActiveTemplateState {
  activeTemplateId: string | null;
  setActiveTemplate: (templateId: string | null) => void;
  clearTemplate: () => void;
}

/**
 * Manages the active template selection in the editor.
 * Persists to sessionStorage so it survives page refreshes within a session.
 */
export function useActiveTemplate(): ActiveTemplateState {
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setActiveTemplate = useCallback((templateId: string | null) => {
    setActiveTemplateId(templateId);
    try {
      if (templateId) {
        sessionStorage.setItem(STORAGE_KEY, templateId);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // sessionStorage unavailable — state-only fallback
    }
  }, []);

  const clearTemplate = useCallback(() => {
    setActiveTemplate(null);
  }, [setActiveTemplate]);

  return { activeTemplateId, setActiveTemplate, clearTemplate };
}
