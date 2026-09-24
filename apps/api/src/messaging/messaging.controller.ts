import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import { DriverGroupService } from './driver-group.service';
import { MessagingService } from './messaging.service';

class GroupDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) driverIds?: string[];
}
class SendDto {
  @IsString() text: string;
}
class BroadcastDto {
  @IsString() text: string;
  @IsOptional() @IsString() groupId?: string;
}
class SendMultiDto {
  @IsString() text: string;
  @IsOptional() @IsArray() @IsString({ each: true }) driverIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) groupIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) numbers?: string[];
}

@Controller()
export class MessagingController {
  constructor(
    private readonly groups: DriverGroupService,
    private readonly messaging: MessagingService,
  ) {}

  // ── driver groups ──
  @Get('driver-groups')
  @Roles(Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER)
  listGroups() {
    return this.groups.list();
  }

  @Post('driver-groups')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  createGroup(@Body() dto: GroupDto) {
    return this.groups.create(dto);
  }

  @Patch('driver-groups/:id')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  updateGroup(@Param('id') id: string, @Body() dto: GroupDto) {
    return this.groups.update(id, dto);
  }

  @Delete('driver-groups/:id')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  removeGroup(@Param('id') id: string) {
    return this.groups.remove(id);
  }

  // ── messaging ──
  @Post('messages/driver/:id')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  sendToDriver(@Param('id') id: string, @Body() dto: SendDto) {
    return this.messaging.sendToDriver(id, dto.text);
  }

  @Post('messages/broadcast')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  broadcast(@Body() dto: BroadcastDto) {
    return this.messaging.broadcast(dto.text, dto.groupId);
  }

  @Post('messages/send')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  sendMulti(@Body() dto: SendMultiDto) {
    return this.messaging.sendMulti(dto);
  }
}
