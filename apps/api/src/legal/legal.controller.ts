import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { JwtPayload, Role } from '@sherpa/shared';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { LegalType } from '../database/entities';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  // ── public: current published content (driver app) ──
  @Public()
  @Get(':type')
  getCurrent(@Param('type') type: LegalType) {
    return this.legal.getCurrent(type);
  }

  // ── admin management ──
  @Get()
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  list() {
    return this.legal.list();
  }

  @Get(':type/versions')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  versions(@Param('type') type: LegalType) {
    return this.legal.versions(type);
  }

  @Get(':type/versions/:version')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  version(@Param('type') type: LegalType, @Param('version') version: string) {
    return this.legal.getVersion(type, parseInt(version, 10));
  }

  @Post(':type')
  @Roles(Role.ADMIN)
  publish(@Param('type') type: LegalType, @Body() body: { sections: any[] }, @CurrentUser() user: JwtPayload) {
    return this.legal.publish(type, body?.sections, user?.email || user?.sub);
  }
}
