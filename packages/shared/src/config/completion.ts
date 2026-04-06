/**
 * Retrieval service configuration (A-053).
 *
 * Controls vector similarity search behavior and quality thresholds.
 * Per backlog: HNSW ef_search=100, top-k=4, cosine threshold=0.72.
 */
export const RETRIEVAL_CONFIG = {
  /** Number of results to return from similarity search */
  topK: 4,

  /** Minimum cosine similarity threshold (1 - cosine_distance) */
  similarityThreshold: 0.72,

  /** HNSW search tuning parameter — higher = more accurate, slower */
  hnswEfSearch: 100,

  /** Maximum context window characters to inject into prompt */
  maxContextChars: 6000,
} as const;

/**
 * Free-tier provider configuration for round-robin.
 * Each provider has its API key from environment and a default model.
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH for provider URLs and model IDs.
 * COMPLETION_CONFIG and PROVIDER_CONFIG derive their values from here.
 *
 * Model IDs — keep these up to date:
 *  - OpenRouter: https://openrouter.ai/models (filter by :free)
 *  - Cerebras:   https://inference-docs.cerebras.ai/api-reference/models
 *  - Groq:       https://console.groq.com/docs/models (check deprecations page)
 */
export const FREE_PROVIDERS = [
  {
    name: 'openrouter',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    // Free-tier model — no credits consumed. Top-weekly free model on OpenRouter.
    model: 'minimax/minimax-m2.5:free',
  },
  {
    name: 'cerebras',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    baseUrl: 'https://api.cerebras.ai/v1',
    // Cerebras uses dot notation for model versions, not dashes.
    // Verified production model in docs.
    model: 'llama3.1-8b',
  },
  {
    name: 'groq',
    apiKeyEnv: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    // llama-3.1-70b-versatile was deprecated Jan 24, 2025 → replaced by 3.3.
    model: 'llama-3.3-70b-versatile',
  },
] as const;

export type FreeProviderName = typeof FREE_PROVIDERS[number]['name'];

/**
 * Completion service configuration (A-070, A-071).
 *
 * Controls debounce timing, gating heuristics, and prompt assembly.
 */
export const COMPLETION_CONFIG = {
  /**
   * Minimum characters of prefix text required before triggering retrieval.
   * Short continuations (< threshold) skip retrieval entirely (A-071).
   */
  retrievalGateMinChars: 50,

  /**
   * Debounce interval in ms for completion requests (A-064).
   * Typing pause must exceed this before triggering a request.
   */
  debounceMs: 750,

  /**
   * Maximum number of tokens in the prefix context sent to the LLM.
   * Prevents overly large prompts for long documents.
   */
  maxPrefixChars: 3000,

  /**
   * Maximum completion length in tokens.
   */
  maxCompletionTokens: 150,

  /**
   * Default model for completions — derived from FREE_PROVIDERS (single source of truth).
   * Resolves to OpenRouter's free-tier model.
   */
  defaultModel: FREE_PROVIDERS.find((p) => p.name === 'openrouter')!.model,

  /**
   * System prompt template for inline completions.
   * {evidence} and {prefix} are replaced at assembly time.
   */
  systemPrompt: `Sos un asistente de escritura legal en español. Tu tarea es continuar el texto del usuario de forma natural y coherente.

Reglas:
- Continuá el texto desde donde el usuario dejó de escribir
- Mantené el mismo tono, estilo y registro que el texto existente
- Si hay evidencia de documentos relevantes, usala para dar contexto preciso
- Escribí SOLO la continuación, sin repetir lo que ya está escrito
- Máximo 1-2 oraciones de continuación
- No agregues títulos, bullet points ni formato especial`,

  /**
   * Evidence injection template.
   * Each evidence chunk is formatted with this template.
   */
  evidenceTemplate: `\n\n---\nEvidencia relevante de tus documentos:\n{chunks}\n---\n`,
} as const;

/**
 * Provider timeout and response cap configuration (A-077).
 *
 * Enforces safe timeout budgets for completion requests.
 * Long-running responses fail safely within these limits.
 */
export const PROVIDER_CONFIG = {
  /** Total timeout for a completion request (connect + generate) in ms */
  totalTimeoutMs: 30_000,

  /** Connection timeout for initial handshake in ms */
  connectTimeoutMs: 5_000,

  /** Maximum response body size in bytes (1MB) */
  maxResponseBytes: 1_048_576,

  /** OpenRouter base URL — derived from FREE_PROVIDERS (single source of truth) */
  openRouterBaseUrl: FREE_PROVIDERS.find((p) => p.name === 'openrouter')!.baseUrl,

  /** Default model for managed provider — derived from FREE_PROVIDERS (single source of truth) */
  defaultManagedModel: FREE_PROVIDERS.find((p) => p.name === 'openrouter')!.model,
} as const;

/**
 * Rate limit configuration (A-095).
 *
 * Per spec: magic-link 5/15min per IP, completions 60/min + 1000/day per user.
 * Uses @nestjs/throttler with Redis store.
 */
export const RATE_LIMIT_CONFIG = {
  /** Magic-link auth: 5 requests per 15 minutes per IP */
  auth: { limit: 5, ttlSeconds: 900 },

  /** Completions: 60 requests per 60 seconds per user */
  completionsPerMinute: { limit: 60, ttlSeconds: 60 },

  /** Completions: 1000 requests per day per user */
  completionsPerDay: { limit: 1000, ttlSeconds: 86_400 },
} as const;

/**
 * Completion request payload from client to API.
 */
export interface CompletionRequestPayload {
  /** Text before the cursor (prefix context) */
  prefix: string;
  /** Text after the cursor (suffix context) */
  suffix?: string;
  /** Editor session ID for tracking */
  sessionId: string;
  /** Cursor position in the document */
  cursorPosition: number;
}

/**
 * Retrieval hit result from vector search.
 */
export interface RetrievalHit {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  documentTitle?: string | null;
}
