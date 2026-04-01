import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@assistai/shared';

@Processor(QUEUE_NAMES.TEST)
export class TestJobProcessor extends WorkerHost {
  private readonly logger = new Logger(TestJobProcessor.name);

  async process(job: Job<{ message: string }>): Promise<{ processed: true; message: string }> {
    this.logger.log(`Processing test job ${job.id}: ${job.data.message}`);

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.logger.log(`Test job ${job.id} completed`);

    return { processed: true, message: job.data.message };
  }
}
