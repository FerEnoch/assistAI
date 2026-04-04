import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelEndpoint } from '@assistai/entities';
import { decrypt, PROVIDER_CONFIG } from '@assistai/shared';
import type { ProviderAdapter } from './provider-adapter.interface';
import { OpenRouterAdapter } from './openrouter.adapter';
import { ByoAdapter } from './byo.adapter';
import { FreeTierProvider } from './free-tier.provider';

/**
 * Provider router — selects and creates the appropriate adapter for a workspace (A-075).
 *
 * Routing priority:
 * 1. Workspace default provider (if configured and active)
 * 2. Fallback to FreeTierProvider (round-robin across openrouter, cerebras, groq)
 *
 * Includes completion request logging (A-076).
 */
@Injectable()
export class ProviderRouter {
  private readonly logger = new Logger(ProviderRouter.name);
  private readonly freeTierProvider = new FreeTierProvider();

  constructor(
    @InjectRepository(ModelEndpoint)
    private readonly endpointRepo: Repository<ModelEndpoint>,
  ) {}

  /**
   * Get the provider adapter for a workspace (A-075).
   *
   * Tries workspace default first, falls back to FreeTierProvider (round-robin).
   * Returns the adapter and the endpoint ID for logging.
   */
  async getProvider(
    workspaceId: string,
  ): Promise<{ adapter: ProviderAdapter; endpointId: string | null; providerType: string }> {
    // Try workspace default endpoint first
    const defaultEndpoint = await this.endpointRepo.findOne({
      where: { workspaceId, isDefault: true, status: 'active' },
    });

    if (defaultEndpoint) {
      this.logger.debug(
        `[Router] Using workspace default: id=${defaultEndpoint.id} type=${defaultEndpoint.providerType}`,
      );

      try {
        const adapter = this.createAdapter(defaultEndpoint);
        return {
          adapter,
          endpointId: defaultEndpoint.id,
          providerType: defaultEndpoint.providerType,
        };
      } catch (err) {
        // Default endpoint failed to initialize — fall through to free tier
        this.logger.warn(
          `[Router] Default endpoint failed, falling back to FreeTier: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Fallback: FreeTierProvider (round-robin across 3 providers)
    this.logger.debug('[Router] Using FreeTier provider (round-robin)');

    return {
      adapter: this.freeTierProvider,
      endpointId: null,
      providerType: 'free_tier',
    };
  }

  /**
   * Create an adapter from a model endpoint record.
   */
  private createAdapter(endpoint: ModelEndpoint): ProviderAdapter {
    if (endpoint.providerType === 'managed') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
      return new OpenRouterAdapter(apiKey);
    }

    // BYO provider
    if (!endpoint.baseUrl) {
      throw new Error('BYO endpoint missing base_url');
    }
    if (!endpoint.encryptedApiKey) {
      throw new Error('BYO endpoint missing encrypted API key');
    }

    const encKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!encKey) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY not configured');
    }

    const apiKey = decrypt(endpoint.encryptedApiKey, encKey);
    const modelName = endpoint.modelName ?? PROVIDER_CONFIG.defaultManagedModel;

    return new ByoAdapter(endpoint.baseUrl, apiKey, modelName);
  }

  /**
   * Validate and create a new BYO endpoint (A-074).
   *
   * Steps:
   * 1. SSRF validation on the URL
   * 2. Health check with the provider
   * 3. Encrypt and store the API key
   * 4. Save the endpoint record
   */
  async createByoEndpoint(
    workspaceId: string,
    baseUrl: string,
    apiKey: string,
    modelName: string,
    setAsDefault: boolean,
  ): Promise<ModelEndpoint> {
    const { encrypt } = await import('@assistai/shared');
    const { validateUrlForSsrf } = await import('@assistai/shared');

    // SSRF validation (A-092)
    const ssrfError = await validateUrlForSsrf(baseUrl);
    if (ssrfError) {
      throw new Error(`SSRF blocked: ${ssrfError}`);
    }

    // Health check (A-074)
    const adapter = new ByoAdapter(baseUrl, apiKey, modelName);
    const healthError = await adapter.validateHealth();

    const encKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!encKey) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY not configured');
    }

    // Encrypt API key (A-083 from original tasks → using shared encrypt)
    const encryptedApiKey = encrypt(apiKey, encKey);

    // If setting as default, unset other defaults first
    if (setAsDefault) {
      await this.endpointRepo.update(
        { workspaceId, isDefault: true },
        { isDefault: false },
      );
    }

    const endpoint = this.endpointRepo.create({
      workspaceId,
      providerType: 'byo',
      baseUrl,
      modelName,
      encryptedApiKey,
      keyVersion: 1,
      isDefault: setAsDefault,
      status: healthError ? 'error' : 'active',
      errorReason: healthError,
    });

    return this.endpointRepo.save(endpoint);
  }

  /**
   * Create a managed OpenRouter endpoint for a workspace (A-073).
   */
  async createManagedEndpoint(
    workspaceId: string,
    setAsDefault: boolean,
  ): Promise<ModelEndpoint> {
    if (setAsDefault) {
      await this.endpointRepo.update(
        { workspaceId, isDefault: true },
        { isDefault: false },
      );
    }

    const endpoint = this.endpointRepo.create({
      workspaceId,
      providerType: 'managed',
      modelName: PROVIDER_CONFIG.defaultManagedModel,
      isDefault: setAsDefault,
      status: 'active',
    });

    return this.endpointRepo.save(endpoint);
  }
}
