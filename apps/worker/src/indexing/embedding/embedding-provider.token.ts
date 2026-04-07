/**
 * NestJS injection token for the active `EmbeddingProvider`.
 *
 * Consumers inject via:
 *   @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider
 *
 * The `IndexingModule` resolves this token to the concrete provider
 * based on the `EMBEDDING_PROVIDER_NAME` env var.
 */
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
