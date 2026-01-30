import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { BulkAssignmentDto } from './dto/bulk-assignment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  async create(@Body() createDto: CreateAssignmentDto, @Request() req: any) {
    return this.assignmentsService.create(createDto, req.user.organizationId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAssignmentDto,
    @Request() req: any,
  ) {
    return this.assignmentsService.update(id, updateDto, req.user.organizationId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.assignmentsService.remove(id, req.user.organizationId);
  }

  @Post('bulk')
  async bulkCreate(@Body() bulkDto: BulkAssignmentDto, @Request() req: any) {
    return this.assignmentsService.bulkCreate(bulkDto, req.user.organizationId);
  }

  @Get('conflicts')
  async checkConflicts(@Query('scheduleId') scheduleId: string, @Request() req: any) {
    return this.assignmentsService.checkConflicts(scheduleId, req.user.organizationId);
  }
}
