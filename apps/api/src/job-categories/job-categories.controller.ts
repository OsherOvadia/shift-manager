import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JobCategoriesService } from './job-categories.service';
import { CreateJobCategoryDto } from './dto/create-job-category.dto';
import { UpdateJobCategoryDto } from './dto/update-job-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('job-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobCategoriesController {
  constructor(private readonly jobCategoriesService: JobCategoriesService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.jobCategoriesService.findAll(req.user.organizationId);
  }

  @Get('active')
  findActive(@Request() req: any) {
    return this.jobCategoriesService.findActive(req.user.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.jobCategoriesService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() createDto: CreateJobCategoryDto, @Request() req: any) {
    return this.jobCategoriesService.create(createDto, req.user.organizationId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() updateDto: UpdateJobCategoryDto, @Request() req: any) {
    return this.jobCategoriesService.update(id, updateDto, req.user.organizationId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.jobCategoriesService.delete(id, req.user.organizationId);
  }
}
