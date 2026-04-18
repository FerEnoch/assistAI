import { useState, useEffect, useCallback } from 'react';
import envConfig from '../config';
import type { IngestStatus } from '@assistai/entities';
import { getCsrfToken } from '../auth/csrf';

export interface TemplateDocument {
  id: string;
  title: string;
  ingestStatus: IngestStatus;
  externalDocumentId: string | null;
  createdAt: string;
}

export interface UseTemplateDocumentsReturn {
  documents: TemplateDocument[];
  isLoading: boolean;
  error: string | null;
  addDocument: (documentId: string) => Promise<void>;
  removeDocument: (documentId: string) => Promise<void>;
  refetch: () => void;
}

export function useTemplateDocuments(templateId: string | null): UseTemplateDocumentsReturn {
  const [documents, setDocuments] = useState<TemplateDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!templateId) {
      setDocuments([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${envConfig.apiUrl}/templates/${templateId}/documents`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('Error al cargar documentos');
      const data = (await res.json()) as TemplateDocument[];
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const addDocument = useCallback(
    async (documentId: string) => {
      if (!templateId) return;
      const csrfToken = await getCsrfToken();
      const res = await fetch(
        `${envConfig.apiUrl}/templates/${templateId}/documents`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify({ documentId }),
        },
      );
      if (!res.ok) throw new Error('Error al asociar documento');
      await fetchDocuments();
    },
    [templateId, fetchDocuments],
  );

  const removeDocument = useCallback(
    async (documentId: string) => {
      if (!templateId) return;
      const csrfToken = await getCsrfToken();
      const res = await fetch(
        `${envConfig.apiUrl}/templates/${templateId}/documents/${documentId}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'x-csrf-token': csrfToken },
        },
      );
      if (!res.ok && res.status !== 204) throw new Error('Error al quitar documento');
      await fetchDocuments();
    },
    [templateId, fetchDocuments],
  );

  return { documents, isLoading, error, addDocument, removeDocument, refetch: fetchDocuments };
}
