import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelEndpoint } from '@assistai/entities';
import { ProviderRouter } from './provider-router.service';

/**
 * Provider module — manages completion provider adapters (A-073, A-074, A-075).
 *
 * Handles:
 * - OpenRouter managed adapter (A-073)
 * - BYO adapter with SSRF validation (A-074, A-092)
 * - Provider routing and fallback (A-075)
 */
@Module({
  imports: [TypeOrmModule.forFeature([ModelEndpoint])],
  providers: [ProviderRouter],
  exports: [ProviderRouter],
})
export class ProviderModule {}
