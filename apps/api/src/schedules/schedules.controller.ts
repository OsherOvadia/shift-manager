import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.schedulesService.findAll(req.user.organizationId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.schedulesService.findOne(id, req.user.organizationId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() createDto: CreateScheduleDto, @Request() req: any) {
    return this.schedulesService.create(createDto, req.user.sub, req.user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateScheduleDto,
    @Request() req: any,
  ) {
    return this.schedulesService.updateStatus(id, updateDto.status, req.user.organizationId);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async publish(@Param('id') id: string, @Request() req: any) {
    return this.schedulesService.publish(id, req.user.organizationId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.schedulesService.delete(id, req.user.organizationId);
  }
}
