import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TestJobProcessor } from './test-job.processor';
import { QUEUE_NAMES } from '@assistai/shared';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.TEST,
    }),
  ],
  providers: [TestJobProcessor],
})
export class TestJobModule {}
