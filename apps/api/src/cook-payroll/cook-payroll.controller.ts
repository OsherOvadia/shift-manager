import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { CookPayrollService } from './cook-payroll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCookHoursDto } from './dto/create-cook-hours.dto';
import { UpdateCookHoursDto } from './dto/update-cook-hours.dto';

@Controller('cook-payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class CookPayrollController {
  constructor(private readonly cookPayrollService: CookPayrollService) {}

  /**
   * Get all cook employees
   */
  @Get('cooks')
  getCooks(@Request() req: any) {
    return this.cookPayrollService.getCooks(req.user.organizationId);
  }

  /**
   * Get cook payroll for a specific week
   */
  @Get('week/:date')
  getWeeklyPayroll(@Param('date') date: string, @Request() req: any) {
    const weekDate = new Date(date);
    return this.cookPayrollService.getWeeklyCookPayroll(req.user.organizationId, weekDate);
  }

  /**
   * Get weekly comparison for charting
   */
  @Get('comparison')
  getWeeklyComparison(@Query('weeks') weeks: string, @Request() req: any) {
    const weeksBack = weeks ? parseInt(weeks, 10) : 4;
    return this.cookPayrollService.getWeeklyComparison(req.user.organizationId, weeksBack);
  }

  /**
   * Create or update cook hours
   */
  @Post()
  upsertCookHours(@Body() dto: CreateCookHoursDto, @Request() req: any) {
    return this.cookPayrollService.upsertCookHours(dto, req.user.organizationId);
  }

  /**
   * Update existing cook hours entry
   */
  @Patch(':id')
  updateCookHours(
    @Param('id') id: string,
    @Body() dto: UpdateCookHoursDto,
    @Request() req: any,
  ) {
    return this.cookPayrollService.updateCookHours(id, dto, req.user.organizationId);
  }

  /**
   * Delete cook hours entry
   */
  @Delete(':id')
  deleteCookHours(@Param('id') id: string, @Request() req: any) {
    return this.cookPayrollService.deleteCookHours(id, req.user.organizationId);
  }
}
