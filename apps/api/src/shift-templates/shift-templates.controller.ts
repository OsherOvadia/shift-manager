import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ShiftTemplatesService } from './shift-templates.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('shift-templates')
@UseGuards(JwtAuthGuard)
export class ShiftTemplatesController {
  constructor(private readonly shiftTemplatesService: ShiftTemplatesService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.shiftTemplatesService.findAll(req.user.organizationId);
  }

  @Get('active')
  async findActive(@Request() req: any) {
    return this.shiftTemplatesService.findActive(req.user.organizationId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.shiftTemplatesService.findOne(id, req.user.organizationId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async create(@Body() createDto: CreateShiftTemplateDto, @Request() req: any) {
    return this.shiftTemplatesService.create(createDto, req.user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateShiftTemplateDto,
    @Request() req: any,
  ) {
    return this.shiftTemplatesService.update(id, updateDto, req.user.organizationId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async deactivate(@Param('id') id: string, @Request() req: any) {
    return this.shiftTemplatesService.deactivate(id, req.user.organizationId);
  }
}
