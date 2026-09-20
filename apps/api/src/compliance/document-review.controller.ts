import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtPayload, Role } from '@sherpa/shared';
import { DocumentReviewService } from './document-review.service';

/**
 * Post-onboarding document review queue. Administrators and security officers
 * approve or reject documents drivers upload/renew; a rejection notifies the
 * driver over WhatsApp so they can re-submit.
 */
@Controller()
export class DocumentReviewController {
  constructor(private readonly svc: DocumentReviewService) {}

  @Get('document-reviews')
  @Roles(Role.ADMIN, Role.SECURITY_OFFICER)
  list() {
    return this.svc.listPending();
  }

  @Get('document-reviews/count')
  @Roles(Role.ADMIN, Role.SECURITY_OFFICER, Role.DISPATCHER)
  count() {
    return this.svc.count();
  }

  @Post('documents/:id/approve')
  @Roles(Role.ADMIN, Role.SECURITY_OFFICER)
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.approve(id, user?.email || user?.sub);
  }

  @Post('documents/:id/reject')
  @Roles(Role.ADMIN, Role.SECURITY_OFFICER)
  reject(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: JwtPayload) {
    return this.svc.reject(id, body?.reason, user?.email || user?.sub);
  }
}
