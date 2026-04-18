import { useState, useEffect, useCallback } from 'react';
import envConfig from '../config';
import { getCsrfToken } from '../auth/csrf';

export interface TemplateSection {
  id?: string;
  name: string;
  sampleContent: string;
  order: number;
  clauseType?: string | null;
}

export interface Template {
  id: string;
  workspaceId: string;
  name: string;
  docType: string;
  description: string | null;
  sections: TemplateSection[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  docType: string;
  description?: string;
  sections: Array<{ name: string; sampleContent: string; order: number; clauseType?: string }>;
}

export interface UpdateTemplateInput extends CreateTemplateInput {
  id: string;
}

export interface UseTemplatesReturn {
  templates: Template[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  createTemplate: (input: CreateTemplateInput) => Promise<void>;
  updateTemplate: (input: UpdateTemplateInput) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

/**
 * Fetches and manages templates from GET/POST/PUT/DELETE /templates.
 * Same pattern as useSources (useState + useEffect + useCallback).
 */
export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${envConfig.apiUrl}/templates`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al cargar los templates');
      const data = (await res.json()) as Template[];
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(async (input: CreateTemplateInput) => {
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${envConfig.apiUrl}/templates`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Error al crear el template');
    await fetchTemplates();
  }, [fetchTemplates]);

  const updateTemplate = useCallback(async (input: UpdateTemplateInput) => {
    const { id, ...body } = input;
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${envConfig.apiUrl}/templates/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Error al actualizar el template');
    await fetchTemplates();
  }, [fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${envConfig.apiUrl}/templates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'x-csrf-token': csrfToken },
    });
    if (!res.ok) throw new Error('Error al eliminar el template');
    await fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    isLoading,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
