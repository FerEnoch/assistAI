import { Logger } from '@nestjs/common';
import { PROVIDER_CONFIG } from '@assistai/shared';
import { validateUrlForSsrf } from '@assistai/shared';
import type {
  ProviderAdapter,
  StreamCompletionOptions,
  CompletionToken,
} from './provider-adapter.interface';

/**
 * BYO (Bring Your Own) provider adapter (A-074).
 *
 * Supports any OpenAI-compatible endpoint. Validates URLs against
 * SSRF protections at setup time (A-092).
 */
export class ByoAdapter implements ProviderAdapter {
  private readonly logger = new Logger(ByoAdapter.name);

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly modelName: string,
  ) {}

  /**
   * Stream completion tokens from the BYO endpoint (A-074).
   */
  async *streamCompletion(
    options: StreamCompletionOptions,
  ): AsyncGenerator<CompletionToken, void, unknown> {
    const model = options.model ?? this.modelName;
    const timeout = options.timeoutMs ?? PROVIDER_CONFIG.totalTimeoutMs;

    const { default: OpenAI } = await import('openai');

    const client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      timeout,
    });

    this.logger.debug(
      `[BYO] Streaming: url=${this.baseUrl} model=${model} maxTokens=${options.maxTokens}`,
    );

    const stream = await client.chat.completions.create({
      model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
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
   * Validate BYO endpoint at setup time (A-074, A-092).
   *
   * Steps:
   * 1. SSRF check on the base URL
   * 2. Send a minimal completion request to verify compatibility
   */
  async validateHealth(): Promise<string | null> {
    // Step 1: SSRF protection (A-092)
    const ssrfError = await validateUrlForSsrf(this.baseUrl);
    if (ssrfError) {
      return `SSRF blocked: ${ssrfError}`;
    }

    // Step 2: OpenAI compatibility check — send a minimal request
    try {
      const { default: OpenAI } = await import('openai');

      const client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        timeout: PROVIDER_CONFIG.connectTimeoutMs,
      });

      const response = await client.chat.completions.create({
        model: this.modelName,
        max_tokens: 5,
        temperature: 0,
        messages: [{ role: 'user', content: 'test' }],
      });

      if (!response.choices?.length) {
        return 'BYO endpoint returned no choices — incompatible response format';
      }

      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[BYO] Health check failed: ${msg}`);
      return `BYO endpoint validation failed: ${msg}`;
    }
  }
}
