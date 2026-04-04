import { Logger } from '@nestjs/common';
import { FREE_PROVIDERS, PROVIDER_CONFIG } from '@assistai/shared';
import type {
  ProviderAdapter,
  StreamCompletionOptions,
  CompletionToken,
} from './provider-adapter.interface';

/**
 * Free-tier provider that implements round-robin across multiple providers.
 * 
 * Each request tries providers in sequence. If one fails (rate limit, quota exhausted, 
 * network error), it moves to the next. Only fails if ALL providers are unavailable.
 * 
 * Uses the official OpenAI SDK with OpenAI-compatible endpoints for all providers:
 * - OpenRouter: https://openrouter.ai/api/v1
 * - Cerebras: https://api.cerebras.ai/v1
 * - Groq: https://api.groq.com/openai/v1
 */
export class FreeTierProvider implements ProviderAdapter {
  private readonly logger = new Logger(FreeTierProvider.name);
  private readonly providers = FREE_PROVIDERS;
  private currentIndex = 0;

  /**
   * Return only providers that have API keys configured.
   */
  private getConfiguredProviders(): Array<{ name: string; apiKey: string; baseUrl: string; model: string }> {
    return this.providers
      .map((provider) => ({
        name: provider.name,
        apiKey: process.env[provider.apiKeyEnv] ?? '',
        baseUrl: provider.baseUrl,
        model: provider.model,
      }))
      .filter((provider) => Boolean(provider.apiKey));
  }

  /**
   * Stream completion tokens, trying providers in round-robin until one succeeds.
   */
  async *streamCompletion(
    options: StreamCompletionOptions,
  ): AsyncGenerator<CompletionToken, void, unknown> {
    const configured = this.getConfiguredProviders();

    if (configured.length === 0) {
      this.logger.error('[FreeTier] No API keys configured for any provider');
      throw new Error('NO_PROVIDER_CONFIGURED: No hay proveedores de IA disponibles.');
    }

    const start = this.currentIndex % configured.length;
    this.currentIndex = (start + 1) % configured.length;

    const attempts: Array<{ provider: string; code: string; message: string }> = [];

    for (let attempt = 0; attempt < configured.length; attempt++) {
      const provider = configured[(start + attempt) % configured.length];

      this.logger.log(
        `[FreeTier] attempt=${attempt + 1}/${configured.length} provider=${provider.name} model=${provider.model}`,
      );

      try {
        const stream = this.streamFromProvider(provider, options);

        for await (const token of stream) {
          yield token;
        }

        this.logger.log(`[FreeTier] SUCCESS: provider=${provider.name} model=${provider.model}`);
        return;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const classified = this.classifyProviderError(error);

        attempts.push({
          provider: provider.name,
          code: classified.code,
          message: error.message,
        });

        this.logger.warn(
          `[FreeTier] Provider ${provider.name} failed: code=${classified.code} retryable=${classified.retryable} msg=${error.message}`,
        );

        if (!classified.retryable) {
          this.logger.warn(
            `[FreeTier] Non-retryable classification for ${provider.name}, continuing to next provider for resilience`,
          );
        }
      }
    }

    const finalCode = this.pickFinalErrorCode(attempts);
    const summary = attempts.map((a) => `${a.provider}:${a.code}`).join(',');
    this.logger.error(`[FreeTier] ALL PROVIDERS FAILED: attempts=${summary}`);

    throw new Error(`${finalCode}: No se pudo completar la solicitud con proveedores gratuitos.`);
  }

  /**
   * Stream from a single provider using OpenAI SDK with OpenAI-compatible endpoints.
   * All three providers (OpenRouter, Cerebras, Groq) are OpenAI-compatible.
   */
  private async *streamFromProvider(
    provider: { name: string; apiKey: string; baseUrl: string; model: string },
    options: StreamCompletionOptions,
  ): AsyncGenerator<CompletionToken, void, unknown> {
    const { default: OpenAI } = await import('openai');

    const client = new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
      timeout: options.timeoutMs ?? PROVIDER_CONFIG.totalTimeoutMs,
    });

    const model = options.model ?? provider.model;

    this.logger.debug(
      `[${provider.name}] Streaming: model=${model} maxTokens=${options.maxTokens}`,
    );

    const stream = await client.chat.completions.create({
      model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      const finishReason = chunk.choices?.[0]?.finish_reason;

      if (content) {
        yield { text: content, done: false };
      }

      if (finishReason) {
        yield { text: '', done: true };
        return;
      }
    }

    yield { text: '', done: true };
  }

  /**
   * Check if an error is retryable (should try next provider).
   */
  private classifyProviderError(error: Error): { code: string; retryable: boolean } {
    const anyError = error as Error & { status?: number; code?: string; type?: string };
    const status = typeof anyError.status === 'number' ? anyError.status : undefined;
    const message = error.message.toLowerCase();

    if (status === 400 || message.includes('invalid_request') || message.includes('bad_request')) {
      // Provider-specific bad requests (model/param mismatch) should still try the next provider.
      return { code: 'BAD_REQUEST', retryable: true };
    }

    if (
      status === 429 ||
      message.includes('rate_limit') ||
      message.includes('rate limit') ||
      message.includes('quota') ||
      message.includes('insufficient_quota') ||
      message.includes('daily limit') ||
      message.includes('monthly limit') ||
      message.includes('exceeded')
    ) {
      return { code: 'QUOTA_OR_RATE_LIMIT', retryable: true };
    }

    if (
      status === 408 ||
      (status !== undefined && status >= 500) ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('network') ||
      message.includes('503') ||
      message.includes('502')
    ) {
      return { code: 'UPSTREAM_UNAVAILABLE', retryable: true };
    }

    if (
      status === 401 ||
      status === 403 ||
      message.includes('authentication') ||
      message.includes('api_key')
    ) {
      return { code: 'AUTH_PROVIDER_ERROR', retryable: true };
    }

    if (status === 404 || message.includes('model') || message.includes('not found')) {
      return { code: 'MODEL_PROVIDER_ERROR', retryable: true };
    }

    return { code: 'PROVIDER_ERROR', retryable: true };
  }

  /**
   * Pick final error code based on all provider attempts.
   */
  private pickFinalErrorCode(attempts: Array<{ code: string }>): string {
    if (attempts.length === 0) {
      return 'ALL_PROVIDERS_FAILED';
    }

    const codes = attempts.map((attempt) => attempt.code);

    if (codes.every((code) => code === 'QUOTA_OR_RATE_LIMIT')) {
      return 'QUOTA_EXHAUSTED';
    }

    if (codes.every((code) => code === 'UPSTREAM_UNAVAILABLE')) {
      return 'PROVIDERS_UNAVAILABLE';
    }

    if (codes.some((code) => code === 'BAD_REQUEST')) {
      return 'BAD_REQUEST';
    }

    return 'ALL_PROVIDERS_FAILED';
  }

  /**
   * Validate health — check if at least one provider is available.
   */
  async validateHealth(): Promise<string | null> {
    const availableProviders = this.providers.filter(p => process.env[p.apiKeyEnv]);

    if (availableProviders.length === 0) {
      return 'No hay proveedores de IA configurados';
    }

    this.logger.log(
      `[FreeTier] Health check: ${availableProviders.length} providers available: ${availableProviders.map(p => p.name).join(', ')}`,
    );

    return null;
  }
}
