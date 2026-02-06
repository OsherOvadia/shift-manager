import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MonthlyExpensesService } from './monthly-expenses.service';
import { CreateMonthlyExpensesDto } from './dto/create-monthly-expenses.dto';
import { UpdateMonthlyExpensesDto } from './dto/update-monthly-expenses.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('monthly-expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonthlyExpensesController {
  constructor(private readonly service: MonthlyExpensesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async createOrUpdate(
    @Body() createDto: CreateMonthlyExpensesDto,
    @Request() req,
  ) {
    return this.service.createOrUpdate(createDto, req.user.organizationId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMonthlyExpensesDto,
    @Request() req,
  ) {
    return this.service.update(id, updateDto, req.user.organizationId);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  async findOne(@Query('year') year: string, @Query('month') month: string, @Request() req) {
    return this.service.findOne(
      parseInt(year),
      parseInt(month),
      req.user.organizationId,
    );
  }

  @Get('range')
  @Roles('ADMIN', 'MANAGER')
  async findByRange(
    @Query('startYear') startYear: string,
    @Query('startMonth') startMonth: string,
    @Query('endYear') endYear: string,
    @Query('endMonth') endMonth: string,
    @Request() req,
  ) {
    return this.service.findByYearRange(
      parseInt(startYear),
      parseInt(startMonth),
      parseInt(endYear),
      parseInt(endMonth),
      req.user.organizationId,
    );
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(id, req.user.organizationId);
  }
}
