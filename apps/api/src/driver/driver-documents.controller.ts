import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as path from 'path';
import { JwtPayload, Role } from '@sherpa/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { DriverDocumentsService } from './driver-documents.service';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
};
const mimeFor = (ref: string) => MIME[path.extname(ref).toLowerCase()] ?? 'application/octet-stream';

/**
 * Signed-in drivers manage (re-upload / renew) their own documents after
 * onboarding — e.g. a renewed licence or insurance. A new/replaced upload
 * resets the document to PENDING for Ops to re-review.
 */
@Controller()
export class DriverDocumentsController {
  constructor(private readonly svc: DriverDocumentsService) {}

  private did(user: JwtPayload): string {
    if (!user.driverId) throw new ForbiddenException('No driver profile for this account');
    return user.driverId;
  }

  @Get('driver/documents')
  @Roles(Role.DRIVER)
  list(@CurrentUser() user: JwtPayload) {
    return this.svc.list(this.did(user));
  }

  @Post('driver/documents')
  @Roles(Role.DRIVER)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: any,
    @Body() body: { docKey: string; issueDate?: string; expiryDate?: string },
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.svc.upload(this.did(user), body.docKey, file, { issueDate: body.issueDate, expiryDate: body.expiryDate });
  }

  @Get('driver/documents/:id/file')
  @Roles(Role.DRIVER)
  async file(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Res() res: Response) {
    const { buffer, fileRef } = await this.svc.fileFor(this.did(user), id);
    res.setHeader('Content-Type', mimeFor(fileRef));
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fileRef)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }
}
