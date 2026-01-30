import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async get(@Request() req: any) {
    return this.settingsService.get(req.user.organizationId);
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async update(@Body() updateDto: UpdateSettingsDto, @Request() req: any) {
    return this.settingsService.update(req.user.organizationId, updateDto);
  }
}
