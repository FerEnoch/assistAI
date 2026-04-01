import { Logger } from '@nestjs/common';
import { PROVIDER_CONFIG, COMPLETION_CONFIG } from '@assistai/shared';
import type {
  ProviderAdapter,
  StreamCompletionOptions,
  CompletionToken,
} from './provider-adapter.interface';

/**
 * OpenRouter managed provider adapter (A-073).
 *
 * Uses OpenRouter's OpenAI-compatible API with configured model and timeouts.
 * This is the default provider for workspaces without a BYO endpoint.
 */
export class OpenRouterAdapter implements ProviderAdapter {
  private readonly logger = new Logger(OpenRouterAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = PROVIDER_CONFIG.openRouterBaseUrl;
  }

  /**
   * Stream completion tokens from OpenRouter (A-073).
   */
  async *streamCompletion(
    options: StreamCompletionOptions,
  ): AsyncGenerator<CompletionToken, void, unknown> {
    const model = options.model ?? COMPLETION_CONFIG.defaultModel;
    const timeout = options.timeoutMs ?? PROVIDER_CONFIG.totalTimeoutMs;

    const { default: OpenAI } = await import('openai');

    const client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      timeout,
    });

    this.logger.debug(`[OpenRouter] Streaming: model=${model} maxTokens=${options.maxTokens}`);

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
   * Validate the OpenRouter connection with a minimal request.
   */
  async validateHealth(): Promise<string | null> {
    try {
      const { default: OpenAI } = await import('openai');

      const client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        timeout: PROVIDER_CONFIG.connectTimeoutMs,
      });

      // List models as a lightweight health check
      await client.models.list();
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[OpenRouter] Health check failed: ${msg}`);
      return `OpenRouter unreachable: ${msg}`;
    }
  }
}
