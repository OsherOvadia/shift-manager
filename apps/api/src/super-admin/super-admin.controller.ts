import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('stats')
  async getPlatformStats() {
    return this.superAdminService.getPlatformStats();
  }

  @Get('organizations')
  async getAllOrganizations() {
    return this.superAdminService.getAllOrganizations();
  }

  @Get('organizations/pending')
  async getPendingOrganizations() {
    return this.superAdminService.getPendingOrganizations();
  }

  @Get('organizations/:id')
  async getOrganizationDetails(@Param('id') id: string) {
    return this.superAdminService.getOrganizationDetails(id);
  }

  @Post('organizations/:id/approve')
  async approveOrganization(@Param('id') id: string, @Req() req: any) {
    return this.superAdminService.approveOrganization(id, req.user.id);
  }

  @Post('organizations/:id/reject')
  async rejectOrganization(@Param('id') id: string) {
    return this.superAdminService.rejectOrganization(id);
  }

  @Post('organizations/:id/suspend')
  async suspendOrganization(@Param('id') id: string, @Req() req: any) {
    return this.superAdminService.suspendOrganization(id, req.user.id);
  }

  @Post('organizations/:id/reactivate')
  async reactivateOrganization(@Param('id') id: string, @Req() req: any) {
    return this.superAdminService.reactivateOrganization(id, req.user.id);
  }

  @Put('organizations/:id')
  async updateOrganization(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      contactEmail?: string;
      contactPhone?: string;
      timezone?: string;
    },
  ) {
    return this.superAdminService.updateOrganization(id, data);
  }

  @Delete('organizations/:id')
  async deleteOrganization(@Param('id') id: string) {
    return this.superAdminService.deleteOrganization(id);
  }
}
