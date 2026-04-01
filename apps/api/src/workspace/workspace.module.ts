import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from '@assistai/entities';
import { DeletionService } from './deletion.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace])],
  providers: [DeletionService],
  exports: [DeletionService],
})
export class WorkspaceModule {}
