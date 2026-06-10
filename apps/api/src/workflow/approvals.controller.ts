import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@sherpa/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtPayload } from '@sherpa/shared';
import { WorkflowService } from './workflow.service';
import { DecisionDto, SecurityCheckDto } from './dto';

/**
 * Ops approval queue + applicant review. The engine enforces that the current
 * stage's responsible role (or admin) is the one acting.
 */
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get('queue')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  queue(@CurrentUser() user: JwtPayload) {
    return this.workflow.queue(user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  detail(@Param('id') id: string) {
    return this.workflow.detail(id);
  }

  @Post(':id/security-check')
  @Roles(Role.ADMIN, Role.SECURITY_OFFICER)
  securityCheck(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SecurityCheckDto,
  ) {
    return this.workflow.setSecurityCheck(user, id, dto.check, dto.result);
  }

  @Post(':id/decision')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  decide(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.workflow.decide(user, id, dto.outcome, dto.reason);
  }
}
