import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
config({ path: resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { validateEnv, workerEnvSchema } from '@assistai/shared';

async function bootstrap() {
  const env = validateEnv(workerEnvSchema, process.env as Record<string, string | undefined>, {
    serviceName: 'worker',
  });

  const app = await NestFactory.create(WorkerModule);

  await app.listen(env.PORT_WORKER);

  console.log(`🚀 [worker] Running on port ${env.PORT_WORKER} (${env.NODE_ENV})`);
}

bootstrap();
