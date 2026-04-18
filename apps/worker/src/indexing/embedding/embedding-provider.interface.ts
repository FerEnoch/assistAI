/**
 * EmbeddingProvider interface (A-051).
 *
 * Abstracts embedding generation so the system can swap providers
 * (OpenAI, BYO endpoint, local model) without changing the pipeline.
 *
 * Contract: one method — `embedBatch` — takes an array of text strings
 * and returns an array of number arrays (embeddings).
 */
export interface EmbeddingProvider {
  /**
   * Generate embeddings for a batch of text strings.
   *
   * @param texts - Array of text strings to embed
   * @returns Array of embedding vectors, each of length `dimensions`
   * @throws If the provider is unreachable or returns an error
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** Human-readable provider name for logging */
  readonly providerName: string;

  /** Model version string stored alongside chunks (e.g. "qwen/qwen3-embedding-8b-2000d") */
  readonly modelVersion: string;

  /** Expected embedding dimensions */
  readonly dimensions: number;
}
