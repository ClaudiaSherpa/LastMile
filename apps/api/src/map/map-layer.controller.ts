import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { JwtPayload, Role } from '@sherpa/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MapLayerService } from './map-layer.service';

@Controller('map-layers')
export class MapLayerController {
  constructor(private readonly svc: MapLayerService) {}

  // all ops staff can see the overlays on the live map
  @Get()
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  list() {
    return this.svc.list();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: { name?: string; color?: string; features: any[]; visible?: boolean }, @CurrentUser() user: JwtPayload) {
    return this.svc.create(body, user?.email || user?.sub);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() body: { name?: string; color?: string; visible?: boolean }) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
