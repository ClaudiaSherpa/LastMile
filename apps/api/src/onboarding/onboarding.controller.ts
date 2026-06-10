import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/decorators';
import { OnboardingService } from './onboarding.service';

/**
 * Public applicant onboarding flow. Protected by a per-application resumeToken
 * rather than a user session (drivers have no account until they submit).
 */
@Public()
@Controller()
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** Form renders from this config — adding a type in admin changes onboarding. */
  @Get('document-types')
  documentTypes() {
    return this.onboarding.listDocumentTypes();
  }

  @Get('operating-areas')
  operatingAreas() {
    return this.onboarding.listOperatingAreas();
  }

  @Post('applications')
  create() {
    return this.onboarding.create();
  }

  @Get('applications/:id')
  get(@Param('id') id: string, @Query('token') token: string) {
    return this.onboarding.get(id, token);
  }

  @Patch('applications/:id')
  update(@Param('id') id: string, @Body() body: { token: string; patch: Record<string, any> }) {
    return this.onboarding.updateDraft(id, body.token, body.patch || {});
  }

  @Post('applications/:id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() body: { token: string; docKey: string },
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (!body.docKey) throw new BadRequestException('docKey is required');
    return this.onboarding.addDocument(id, body.token, body.docKey, file);
  }

  @Post('applications/:id/submit')
  submit(@Param('id') id: string, @Body() body: { token: string; password?: string }) {
    return this.onboarding.submit(id, body.token, body.password);
  }
}
