/**
 * NestJS injection token for the active query embedding service.
 *
 * Consumers inject via:
 *   @Inject(QUERY_EMBEDDING) private readonly queryEmbedding: QueryEmbeddingPort
 *
 * The `RetrievalModule` resolves this token to the concrete provider
 * based on the `EMBEDDING_PROVIDER_NAME` env var.
 */
export const QUERY_EMBEDDING = Symbol('QUERY_EMBEDDING');

/**
 * Minimal port that any query-embedding provider must satisfy.
 * Used for typing the injected dependency without coupling to a concrete class.
 */
export interface QueryEmbeddingPort {
  embed(text: string): Promise<number[] | null>;
}
