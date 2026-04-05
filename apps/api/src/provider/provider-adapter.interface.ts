/**
 * Provider adapter interface — abstraction over completion providers (A-073, A-074).
 *
 * Both OpenRouter (managed) and BYO endpoints implement this interface.
 * The ProviderRouter selects the appropriate adapter per workspace config.
 */

/**
 * Options for streaming a completion.
 */
export interface StreamCompletionOptions {
  /** System prompt */
  system: string;
  /** User message (prefix context) */
  user: string;
  /** Maximum tokens to generate */
  maxTokens: number;
  /** Temperature for sampling */
  temperature: number;
  /** Total timeout in ms */
  timeoutMs: number;
  /** Model name override (optional) */
  model?: string;
  /** AbortSignal for cancellation on client disconnect */
  signal?: AbortSignal;
}

/**
 * A single token from the completion stream.
 */
export interface CompletionToken {
  /** The text content of this token */
  text: string;
  /** Whether the stream is finished */
  done: boolean;
}

/**
 * Provider adapter — implemented by both managed and BYO providers.
 */
export interface ProviderAdapter {
  /**
   * Stream completion tokens from the provider.
   *
   * @yields CompletionToken objects as they arrive
   * @throws If the provider fails or times out
   */
  streamCompletion(
    options: StreamCompletionOptions,
  ): AsyncGenerator<CompletionToken, void, unknown>;

  /**
   * Validate that the provider is reachable and configured correctly.
   * Used for health checks and BYO setup validation.
   *
   * @returns null if healthy, error message if not
   */
  validateHealth(): Promise<string | null>;
}
