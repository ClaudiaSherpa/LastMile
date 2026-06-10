import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Application,
  ApprovalStage,
  ApprovalTask,
  ApprovalWorkflow,
  Document,
  DriverProfile,
} from '../database/entities';
import { WorkflowService } from './workflow.service';
import { ApprovalsController } from './approvals.controller';
import { WorkflowConfigController } from './workflow-config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      ApprovalStage,
      ApprovalTask,
      ApprovalWorkflow,
      Document,
      DriverProfile,
    ]),
  ],
  controllers: [ApprovalsController, WorkflowConfigController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
