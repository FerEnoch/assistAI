import { useState, useCallback } from 'react';
import type { Template } from '../hooks/useTemplates';

const STORAGE_KEY = 'assistai_active_template';

interface ActiveTemplateState {
  activeTemplateId: string | null;
  activeTemplate: Template | null;
  setActiveTemplate: (template: Template | null) => void;
  clearTemplate: () => void;
}

/**
 * Manages the active template selection in the editor.
 * Stores the full Template object so consumers don't need a second lookup.
 * Persists to sessionStorage as JSON so it survives page refreshes within a session.
 */
export function useActiveTemplate(): ActiveTemplateState {
  const [activeTemplate, setActiveTemplateState] = useState<Template | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Template;
    } catch {
      return null;
    }
  });

  const setActiveTemplate = useCallback((template: Template | null) => {
    setActiveTemplateState(template);
    try {
      if (template) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(template));
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

  return {
    activeTemplateId: activeTemplate?.id ?? null,
    activeTemplate,
    setActiveTemplate,
    clearTemplate,
  };
}
