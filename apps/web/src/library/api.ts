import envConfig from '../config';
import { getCsrfToken } from '../auth/csrf';
import type { Template, CreateTemplateInput, UpdateTemplateInput } from '../hooks/useTemplates';
import type { CorpusStats } from '../hooks/useCorpusStats';

/**
 * Library API helpers — thin wrappers around fetch for template & stats endpoints.
 * Centralises URL construction and auth headers so hooks/components stay clean.
 */

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch(`${envConfig.apiUrl}/templates`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error al cargar los templates');
  return (await res.json()) as Template[];
}

export async function createTemplate(input: CreateTemplateInput): Promise<Template> {
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
  return (await res.json()) as Template;
}

export async function updateTemplate(input: UpdateTemplateInput): Promise<Template> {
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
  return (await res.json()) as Template;
}

export async function deleteTemplate(id: string): Promise<void> {
  const csrfToken = await getCsrfToken();
  const res = await fetch(`${envConfig.apiUrl}/templates/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'x-csrf-token': csrfToken },
  });
  if (!res.ok) throw new Error('Error al eliminar el template');
}

export async function fetchLibraryStats(): Promise<CorpusStats> {
  const res = await fetch(`${envConfig.apiUrl}/library/stats`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error al cargar estadísticas del corpus');
  return (await res.json()) as CorpusStats;
}
