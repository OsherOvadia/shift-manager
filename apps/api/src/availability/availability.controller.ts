import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // Employee endpoints

  @Get('week/:date')
  async getWeekAvailability(@Param('date') date: string, @Request() req: any) {
    return this.availabilityService.getWeekAvailability(req.user.sub, new Date(date));
  }

  @Post()
  async submitAvailability(@Body() createDto: CreateAvailabilityDto, @Request() req: any) {
    return this.availabilityService.submitAvailability(req.user.sub, createDto);
  }

  @Patch(':id')
  async updateSubmission(
    @Param('id') id: string,
    @Body() updateDto: UpdateAvailabilityDto,
    @Request() req: any,
  ) {
    return this.availabilityService.updateSubmission(id, req.user.sub, updateDto);
  }

  @Get('deadline')
  async getDeadline(@Request() req: any) {
    return this.availabilityService.getSubmissionDeadline(req.user.organizationId);
  }

  // Manager endpoints

  @Get('submissions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async getAllSubmissions(@Query('weekStartDate') weekStartDate: string, @Request() req: any) {
    return this.availabilityService.getAllSubmissions(req.user.organizationId, new Date(weekStartDate));
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.availabilityService.updateSubmissionStatus(id, updateStatusDto.status, req.user.organizationId);
  }

  @Get('missing')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async getMissingSubmissions(@Query('weekStartDate') weekStartDate: string, @Request() req: any) {
    return this.availabilityService.getMissingSubmissions(req.user.organizationId, new Date(weekStartDate));
  }
}
